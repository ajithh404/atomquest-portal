export type UserRole = 'employee' | 'manager' | 'admin';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  manager_id: string | null;
  department: string | null;
  created_at: string;
}

export interface ThrustArea {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}

export type GoalSheetStatus = 'draft' | 'submitted' | 'approved' | 'returned';

export interface GoalSheet {
  id: string;
  employee_id: string;
  cycle_year: number;
  status: GoalSheetStatus;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  return_comment: string | null;
  created_at: string;
  updated_at: string;
}

export type UomType = 'min' | 'max' | 'timeline' | 'zero';
export type GoalStatus = 'not_started' | 'on_track' | 'completed';

export interface Goal {
  id: string;
  sheet_id: string;
  thrust_area_id: string;
  title: string;
  description: string | null;
  uom_type: UomType;
  target_value: number | null;
  target_date: string | null;
  weightage: number;
  status: GoalStatus;
  is_shared: boolean;
  shared_from: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  thrust_area?: ThrustArea;
}

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Annual';

export interface Achievement {
  id: string;
  goal_id: string;
  quarter: Quarter;
  actual_value: number | null;
  actual_date: string | null;
  progress_score: number | null;
  notes: string | null;
  logged_by: string;
  logged_at: string;
}

export interface Checkin {
  id: string;
  goal_id: string;
  quarter: Quarter;
  manager_id: string;
  comment: string;
  created_at: string;
}

export interface QuarterlyWindow {
  id: string;
  cycle_year: number;
  quarter: Exclude<Quarter, 'Annual'>;
  start_date: string;
  end_date: string;
  is_open: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  changed_by: string;
  changed_at: string;
}

// Extended types with joins
export interface GoalSheetWithGoals extends GoalSheet {
  goals: Goal[];
  employee?: Profile;
}

export interface GoalWithAchievements extends Goal {
  achievements: Achievement[];
  checkins: Checkin[];
}
