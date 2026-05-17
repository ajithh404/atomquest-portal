-- ============================================================
-- RLS FIX: Profiles table policies cause infinite recursion
-- because they SELECT from profiles to check role.
-- Fix: Use auth.jwt() to get role from user metadata instead.
-- ============================================================

-- Drop all existing profile policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view direct reports profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Recreate with non-recursive approach
-- Use auth.jwt() to get the role from JWT metadata (avoids querying profiles table)

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

-- Also fix other tables that reference profiles for role checks
-- to use auth.jwt() instead of querying profiles

-- THRUST AREAS: fix admin policy
DROP POLICY IF EXISTS "Admins can manage thrust areas" ON public.thrust_areas;
CREATE POLICY "Admins can manage thrust areas"
  ON public.thrust_areas FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- GOAL SHEETS: fix admin/manager policies
DROP POLICY IF EXISTS "Managers can update submitted goal sheets of direct reports" ON public.goal_sheets;
CREATE POLICY "Managers can update submitted goal sheets of direct reports"
  ON public.goal_sheets FOR UPDATE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.profiles emp
      WHERE emp.id = employee_id AND emp.manager_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all goal sheets" ON public.goal_sheets;
CREATE POLICY "Admins can view all goal sheets"
  ON public.goal_sheets FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admins can update all goal sheets" ON public.goal_sheets;
CREATE POLICY "Admins can update all goal sheets"
  ON public.goal_sheets FOR UPDATE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- GOALS: fix admin policy
DROP POLICY IF EXISTS "Admins can do everything with goals" ON public.goals;
CREATE POLICY "Admins can do everything with goals"
  ON public.goals FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ACHIEVEMENTS: fix admin policy
DROP POLICY IF EXISTS "Admins can view all achievements" ON public.achievements;
CREATE POLICY "Admins can view all achievements"
  ON public.achievements FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- CHECKINS: fix admin policy
DROP POLICY IF EXISTS "Admins can do everything with checkins" ON public.checkins;
CREATE POLICY "Admins can do everything with checkins"
  ON public.checkins FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- AUDIT LOGS: fix admin policies
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;
CREATE POLICY "Admins can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- QUARTERLY WINDOWS: fix admin policy
DROP POLICY IF EXISTS "Admins can manage quarterly windows" ON public.quarterly_windows;
CREATE POLICY "Admins can manage quarterly windows"
  ON public.quarterly_windows FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
