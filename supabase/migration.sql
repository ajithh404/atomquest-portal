-- ============================================================
-- AtomQuest Goal Setting & Tracking Portal
-- Full Database Schema, RLS Policies, Demo Users, and Seed Data
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Profiles table (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'manager', 'admin')),
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thrust areas configured by admin
CREATE TABLE IF NOT EXISTS public.thrust_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN DEFAULT true
);

-- Goal sheets per employee per cycle
CREATE TABLE IF NOT EXISTS public.goal_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cycle_year INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'returned')),
  return_comment TEXT,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, cycle_year)
);

-- Individual goals inside a goal sheet
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES public.goal_sheets(id) ON DELETE CASCADE,
  thrust_area_id UUID NOT NULL REFERENCES public.thrust_areas(id),
  title TEXT NOT NULL,
  description TEXT,
  uom_type TEXT NOT NULL CHECK (uom_type IN ('min', 'max', 'timeline', 'zero')),
  target_value NUMERIC,
  target_date DATE,
  weightage NUMERIC NOT NULL CHECK (weightage >= 10 AND weightage <= 100),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'on_track', 'completed')),
  is_shared BOOLEAN DEFAULT false,
  shared_from UUID REFERENCES public.goals(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quarterly achievement entries
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  quarter TEXT NOT NULL CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4', 'Annual')),
  actual_value NUMERIC,
  actual_date DATE,
  progress_score NUMERIC,
  notes TEXT,
  logged_by UUID NOT NULL REFERENCES public.profiles(id),
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(goal_id, quarter)
);

-- Manager check-in comments
CREATE TABLE IF NOT EXISTS public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  quarter TEXT NOT NULL CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4', 'Annual')),
  manager_id UUID NOT NULL REFERENCES public.profiles(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit trail
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID NOT NULL REFERENCES public.profiles(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quarterly window management
CREATE TABLE IF NOT EXISTS public.quarterly_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_year INT NOT NULL,
  quarter TEXT NOT NULL CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_open BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cycle_year, quarter)
);

-- ============================================================
-- 2. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON public.profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_goal_sheets_employee_id ON public.goal_sheets(employee_id);
CREATE INDEX IF NOT EXISTS idx_goal_sheets_status ON public.goal_sheets(status);
CREATE INDEX IF NOT EXISTS idx_goals_sheet_id ON public.goals(sheet_id);
CREATE INDEX IF NOT EXISTS idx_achievements_goal_id ON public.achievements(goal_id);
CREATE INDEX IF NOT EXISTS idx_checkins_goal_id ON public.checkins(goal_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);

-- ============================================================
-- 3. UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_goal_sheets_updated
  BEFORE UPDATE ON public.goal_sheets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER on_goals_updated
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_locked_goal_edits()
RETURNS TRIGGER AS $$
DECLARE
  v_sheet_status TEXT;
  v_role TEXT;
BEGIN
  SELECT status INTO v_sheet_status
  FROM public.goal_sheets
  WHERE id = OLD.sheet_id;

  v_role := auth.jwt() -> 'user_metadata' ->> 'role';

  IF v_sheet_status = 'approved' AND v_role <> 'admin' THEN
    IF OLD.sheet_id IS DISTINCT FROM NEW.sheet_id
      OR OLD.thrust_area_id IS DISTINCT FROM NEW.thrust_area_id
      OR OLD.title IS DISTINCT FROM NEW.title
      OR OLD.description IS DISTINCT FROM NEW.description
      OR OLD.uom_type IS DISTINCT FROM NEW.uom_type
      OR OLD.target_value IS DISTINCT FROM NEW.target_value
      OR OLD.target_date IS DISTINCT FROM NEW.target_date
      OR OLD.weightage IS DISTINCT FROM NEW.weightage
      OR OLD.is_shared IS DISTINCT FROM NEW.is_shared
      OR OLD.shared_from IS DISTINCT FROM NEW.shared_from THEN
      RAISE EXCEPTION 'Approved goals are locked except for progress status updates';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER prevent_locked_goal_edits
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.prevent_locked_goal_edits();

CREATE OR REPLACE FUNCTION public.can_view_linked_shared_goal(p_goal_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.goals shared
    JOIN public.goals source_goal ON source_goal.id = shared.shared_from
    JOIN public.goal_sheets source_sheet ON source_sheet.id = source_goal.sheet_id
    WHERE shared.id = p_goal_id
      AND shared.is_shared = true
      AND source_sheet.employee_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 4. AUTO-CREATE PROFILE ON SIGNUP TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thrust_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quarterly_windows ENABLE ROW LEVEL SECURITY;

-- ----- PROFILES -----
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Managers can view direct reports profiles"
  ON public.profiles FOR SELECT
  USING (manager_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ----- THRUST AREAS -----
CREATE POLICY "Anyone authenticated can read active thrust areas"
  ON public.thrust_areas FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage thrust areas"
  ON public.thrust_areas FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ----- GOAL SHEETS -----
CREATE POLICY "Employees can view own goal sheets"
  ON public.goal_sheets FOR SELECT
  USING (employee_id = auth.uid());

CREATE POLICY "Employees can insert own goal sheets"
  ON public.goal_sheets FOR INSERT
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Managers can create direct report goal sheets for shared goals"
  ON public.goal_sheets FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
      AND EXISTS (
        SELECT 1 FROM public.profiles emp
        WHERE emp.id = employee_id AND emp.manager_id = auth.uid()
      )
    )
  );

CREATE POLICY "Employees can update own draft/returned goal sheets"
  ON public.goal_sheets FOR UPDATE
  USING (
    employee_id = auth.uid()
    AND status IN ('draft', 'returned')
  )
  WITH CHECK (
    employee_id = auth.uid()
    AND status IN ('draft', 'returned', 'submitted')
  );

CREATE POLICY "Managers can view direct reports goal sheets"
  ON public.goal_sheets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = employee_id AND p.manager_id = auth.uid()
    )
  );

CREATE POLICY "Managers can update submitted goal sheets of direct reports"
  ON public.goal_sheets FOR UPDATE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.profiles emp
      WHERE emp.id = employee_id AND emp.manager_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all goal sheets"
  ON public.goal_sheets FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can update all goal sheets"
  ON public.goal_sheets FOR UPDATE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ----- GOALS -----
CREATE POLICY "Employees can view own goals"
  ON public.goals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_sheets gs
      WHERE gs.id = sheet_id AND gs.employee_id = auth.uid()
    )
  );

CREATE POLICY "Employees can view linked shared goals from own source goals"
  ON public.goals FOR SELECT
  USING (
    public.can_view_linked_shared_goal(id)
  );

CREATE POLICY "Employees can insert goals in own draft sheets"
  ON public.goals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goal_sheets gs
      WHERE gs.id = sheet_id
      AND gs.employee_id = auth.uid()
      AND gs.status IN ('draft', 'returned')
    )
  );

CREATE POLICY "Managers can insert shared goals for direct reports"
  ON public.goals FOR INSERT
  WITH CHECK (
    is_shared = true
    AND shared_from IS NOT NULL
    AND (
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
      OR (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'manager'
        AND EXISTS (
          SELECT 1 FROM public.goal_sheets gs
          JOIN public.profiles emp ON emp.id = gs.employee_id
          WHERE gs.id = sheet_id AND emp.manager_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Employees can update goals in own draft sheets"
  ON public.goals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_sheets gs
      WHERE gs.id = sheet_id
      AND gs.employee_id = auth.uid()
      AND gs.status IN ('draft', 'returned')
    )
  );

CREATE POLICY "Employees can delete goals in own draft sheets"
  ON public.goals FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_sheets gs
      WHERE gs.id = sheet_id
      AND gs.employee_id = auth.uid()
      AND gs.status IN ('draft', 'returned')
    )
  );

CREATE POLICY "Employees can update own approved goal status"
  ON public.goals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_sheets gs
      WHERE gs.id = sheet_id
      AND gs.employee_id = auth.uid()
      AND gs.status = 'approved'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goal_sheets gs
      WHERE gs.id = sheet_id
      AND gs.employee_id = auth.uid()
      AND gs.status = 'approved'
    )
  );

CREATE POLICY "Managers can view direct reports goals"
  ON public.goals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_sheets gs
      JOIN public.profiles emp ON emp.id = gs.employee_id
      WHERE gs.id = sheet_id AND emp.manager_id = auth.uid()
    )
  );

CREATE POLICY "Managers can update direct reports submitted goals"
  ON public.goals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.goal_sheets gs
      JOIN public.profiles emp ON emp.id = gs.employee_id
      WHERE gs.id = sheet_id
      AND emp.manager_id = auth.uid()
      AND gs.status = 'submitted'
    )
  );

CREATE POLICY "Admins can do everything with goals"
  ON public.goals FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ----- ACHIEVEMENTS -----
CREATE POLICY "Employees can view own achievements"
  ON public.achievements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      JOIN public.goal_sheets gs ON gs.id = g.sheet_id
      WHERE g.id = goal_id AND gs.employee_id = auth.uid()
    )
  );

CREATE POLICY "Employees can insert own achievements"
  ON public.achievements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goals g
      JOIN public.goal_sheets gs ON gs.id = g.sheet_id
      WHERE g.id = goal_id AND gs.employee_id = auth.uid()
    )
    AND logged_by = auth.uid()
  );

CREATE POLICY "Employees can sync achievements to linked shared goals"
  ON public.achievements FOR INSERT
  WITH CHECK (
    logged_by = auth.uid()
    AND public.can_view_linked_shared_goal(goal_id)
  );

CREATE POLICY "Employees can update own achievements"
  ON public.achievements FOR UPDATE
  USING (
    logged_by = auth.uid()
  );

CREATE POLICY "Managers can view direct reports achievements"
  ON public.achievements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      JOIN public.goal_sheets gs ON gs.id = g.sheet_id
      JOIN public.profiles emp ON emp.id = gs.employee_id
      WHERE g.id = goal_id AND emp.manager_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all achievements"
  ON public.achievements FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ----- CHECKINS -----
CREATE POLICY "Employees can view checkins on own goals"
  ON public.checkins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      JOIN public.goal_sheets gs ON gs.id = g.sheet_id
      WHERE g.id = goal_id AND gs.employee_id = auth.uid()
    )
  );

CREATE POLICY "Managers can CRUD checkins for direct reports"
  ON public.checkins FOR ALL
  USING (
    manager_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.goals g
      JOIN public.goal_sheets gs ON gs.id = g.sheet_id
      JOIN public.profiles emp ON emp.id = gs.employee_id
      WHERE g.id = goal_id AND emp.manager_id = auth.uid()
    )
  );

CREATE POLICY "Managers can insert checkins for direct reports"
  ON public.checkins FOR INSERT
  WITH CHECK (
    manager_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.goals g
      JOIN public.goal_sheets gs ON gs.id = g.sheet_id
      JOIN public.profiles emp ON emp.id = gs.employee_id
      WHERE g.id = goal_id AND emp.manager_id = auth.uid()
    )
  );

CREATE POLICY "Admins can do everything with checkins"
  ON public.checkins FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ----- AUDIT LOGS -----
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Admins can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ----- QUARTERLY WINDOWS -----
CREATE POLICY "Anyone authenticated can read quarterly windows"
  ON public.quarterly_windows FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage quarterly windows"
  ON public.quarterly_windows FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ============================================================
-- 6. SEED DATA — THRUST AREAS
-- ============================================================
INSERT INTO public.thrust_areas (name, description, active) VALUES
  ('Sales Performance', 'Revenue targets, market share growth, and sales pipeline metrics', true),
  ('Cost Reduction', 'Initiatives to reduce operational costs and improve efficiency', true),
  ('Customer Experience', 'Customer satisfaction, NPS scores, and service quality improvements', true),
  ('Safety & Compliance', 'Workplace safety, regulatory compliance, and risk management', true),
  ('Process Efficiency', 'Streamlining workflows, reducing TAT, and improving productivity', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 7. SEED DATA — DEMO USERS
-- ============================================================
-- Create demo users in auth.users and their profiles.
-- Password for all: Demo@1234

-- We use fixed UUIDs so we can reference them in profiles.
DO $$
DECLARE
  v_employee_id UUID := '11111111-1111-1111-1111-111111111111';
  v_manager_id UUID := '22222222-2222-2222-2222-222222222222';
  v_admin_id UUID := '33333333-3333-3333-3333-333333333333';
BEGIN
  -- Delete existing demo users if they exist (idempotent)
  DELETE FROM auth.users WHERE email IN ('employee@demo.com', 'manager@demo.com', 'admin@demo.com');

  -- Insert Employee
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    is_super_admin, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_employee_id,
    'authenticated', 'authenticated',
    'employee@demo.com',
    crypt('Demo@1234', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"name": "Rahul Sharma", "role": "employee"}'::jsonb,
    '', '', '', '',
    false, false
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_employee_id, v_employee_id::text,
    jsonb_build_object('sub', v_employee_id::text, 'email', 'employee@demo.com', 'email_verified', true, 'phone_verified', false),
    'email', NOW(), NOW(), NOW()
  );

  -- Insert Manager
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    is_super_admin, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_manager_id,
    'authenticated', 'authenticated',
    'manager@demo.com',
    crypt('Demo@1234', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"name": "Priya Nair", "role": "manager"}'::jsonb,
    '', '', '', '',
    false, false
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_manager_id, v_manager_id::text,
    jsonb_build_object('sub', v_manager_id::text, 'email', 'manager@demo.com', 'email_verified', true, 'phone_verified', false),
    'email', NOW(), NOW(), NOW()
  );

  -- Insert Admin
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    is_super_admin, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_admin_id,
    'authenticated', 'authenticated',
    'admin@demo.com',
    crypt('Demo@1234', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"name": "Admin User", "role": "admin"}'::jsonb,
    '', '', '', '',
    false, false
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_admin_id, v_admin_id::text,
    jsonb_build_object('sub', v_admin_id::text, 'email', 'admin@demo.com', 'email_verified', true, 'phone_verified', false),
    'email', NOW(), NOW(), NOW()
  );

  -- ============================================================
  -- 8. SEED PROFILES
  -- ============================================================
  -- The trigger should auto-create these, but let's ensure they exist
  -- with the correct roles and manager assignments.
  
  -- Upsert profiles
  INSERT INTO public.profiles (id, name, email, role, manager_id, department) VALUES
    (v_employee_id, 'Rahul Sharma', 'employee@demo.com', 'employee', v_manager_id, 'Engineering'),
    (v_manager_id, 'Priya Nair', 'manager@demo.com', 'manager', NULL, 'Engineering'),
    (v_admin_id, 'Admin User', 'admin@demo.com', 'admin', NULL, 'HR')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    manager_id = EXCLUDED.manager_id,
    department = EXCLUDED.department;

  -- ============================================================
  -- 9. SEED QUARTERLY WINDOWS (FY 2025-26)
  -- ============================================================
  INSERT INTO public.quarterly_windows (cycle_year, quarter, start_date, end_date, is_open) VALUES
    (2025, 'Q1', '2025-07-01', '2025-09-30', true),
    (2025, 'Q2', '2025-10-01', '2025-12-31', false),
    (2025, 'Q3', '2026-01-01', '2026-03-31', false),
    (2025, 'Q4', '2026-04-01', '2026-06-30', false)
  ON CONFLICT (cycle_year, quarter) DO NOTHING;

END $$;
