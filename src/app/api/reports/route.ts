import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Achievement, AuditLog, Checkin, Goal, GoalSheet, Profile, QuarterlyWindow, ThrustArea, UomType } from '@/lib/types';
import { CURRENT_CYCLE_YEAR } from '@/lib/validations';

type AchievementGoalRow = Achievement & {
  goals: Goal & {
    thrust_area: ThrustArea | null;
    goal_sheets: GoalSheet & {
      employee: Profile | null;
    };
  };
};

type AuditRow = AuditLog & {
  changed_by_profile: Profile | null;
};

type SheetRow = GoalSheet & {
  employee: Profile | null;
  goals?: (Goal & { thrust_area: ThrustArea | null })[];
};

type CheckinRow = Checkin & {
  goals: Goal & {
    goal_sheets: GoalSheet & {
      employee: Profile | null;
    };
  };
};

export interface AchievementReportRow {
  employee: string;
  department: string;
  goalTitle: string;
  thrustArea: string;
  uom: string;
  target: string;
  actual: string;
  score: number | null;
  scoreLabel: string;
  quarter: string;
  status: string;
}

export interface AuditReportRow {
  timestamp: string;
  user: string;
  action: string;
  tableName: string;
  oldValue: string;
  newValue: string;
}

export interface DashboardStats {
  totalEmployees: number;
  sheetsSubmitted: number;
  sheetsApproved: number;
  q1CompletionRate: number;
  pendingCheckins: number;
  openWindows: number;
  submittedRate: number;
  managerCheckinRate: number;
}

export interface DepartmentAggregate {
  department: string;
  completionRate: number;
  averageScore: number;
}

export interface QuarterTrend {
  quarter: string;
  averageScore: number;
}

export interface ThrustAreaDistribution {
  name: string;
  count: number;
  percentage: number;
}

export interface UomDistribution {
  type: UomType;
  label: string;
  count: number;
}

export interface ManagerEffectivenessRow {
  managerName: string;
  directReports: number;
  sheetsApproved: number;
  avgDaysToApprove: number;
  checkinCompletionRate: number;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { supabase, profile: null, response: jsonError('You must be signed in.', 401) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { supabase, profile: null, response: jsonError('Your profile could not be loaded.', 403) };
  }

  return { supabase, profile: profile as Profile, response: null };
}

function targetLabel(goal: Goal) {
  if (goal.uom_type === 'timeline') {
    return goal.target_date ? `By ${goal.target_date}` : 'Timeline';
  }

  if (goal.uom_type === 'zero') {
    return '0';
  }

  return goal.target_value === null || goal.target_value === undefined ? '-' : String(goal.target_value);
}

function actualLabel(achievement: Achievement) {
  if (achievement.actual_value !== null && achievement.actual_value !== undefined) {
    return String(achievement.actual_value);
  }

  return achievement.actual_date ?? '-';
}

function scoreLabel(score: number | null) {
  return score === null ? '-' : `${Math.round(score * 100)}%`;
}

function safeJson(value: unknown) {
  if (value === null || value === undefined) {
    return '-';
  }

  return JSON.stringify(value);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100);
}

export async function GET() {
  const { supabase, profile, response } = await getSessionProfile();

  if (response) {
    return response;
  }

  if (!profile || profile.role !== 'admin') {
    return jsonError('Only admins can access reports.', 403);
  }

  try {
    const [
      profilesResult,
      sheetsResult,
      achievementsResult,
      checkinsResult,
      windowsResult,
      auditResult,
    ] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase
        .from('goal_sheets')
        .select('*, employee:profiles!goal_sheets_employee_id_fkey(*), goals(*, thrust_area:thrust_areas(*))')
        .eq('cycle_year', CURRENT_CYCLE_YEAR),
      supabase
        .from('achievements')
        .select('*, goals(*, thrust_area:thrust_areas(*), goal_sheets(*, employee:profiles!goal_sheets_employee_id_fkey(*)))')
        .order('logged_at', { ascending: false }),
      supabase
        .from('checkins')
        .select('*, goals(*, goal_sheets(*, employee:profiles!goal_sheets_employee_id_fkey(*)))'),
      supabase
        .from('quarterly_windows')
        .select('*')
        .eq('cycle_year', CURRENT_CYCLE_YEAR)
        .order('start_date', { ascending: true }),
      supabase
        .from('audit_logs')
        .select('*, changed_by_profile:profiles!audit_logs_changed_by_fkey(*)')
        .order('changed_at', { ascending: false }),
    ]);

    for (const result of [profilesResult, sheetsResult, achievementsResult, checkinsResult, windowsResult, auditResult]) {
      if (result.error) {
        throw new Error(result.error.message);
      }
    }

    const profiles = (profilesResult.data ?? []) as Profile[];
    const employees = profiles.filter((item) => item.role === 'employee');
    const managers = profiles.filter((item) => item.role === 'manager');
    const sheets = (sheetsResult.data ?? []) as SheetRow[];
    const achievements = (achievementsResult.data ?? []) as AchievementGoalRow[];
    const checkins = (checkinsResult.data ?? []) as CheckinRow[];
    const windows = (windowsResult.data ?? []) as QuarterlyWindow[];
    const audits = (auditResult.data ?? []) as AuditRow[];
    const currentQuarter = windows.find((windowRow) => windowRow.is_open)?.quarter ?? 'Q1';
    const approvedSheets = sheets.filter((sheet) => sheet.status === 'approved');
    const submittedOrApprovedSheets = sheets.filter((sheet) => ['submitted', 'approved', 'returned'].includes(sheet.status));
    const q1Employees = new Set(
      achievements
        .filter((achievement) => achievement.quarter === 'Q1')
        .map((achievement) => achievement.goals.goal_sheets.employee_id)
    );
    const currentQuarterManagerIds = new Set(
      checkins
        .filter((checkin) => checkin.quarter === currentQuarter)
        .map((checkin) => checkin.manager_id)
    );
    const approvedGoals = approvedSheets.flatMap((sheet) => sheet.goals ?? []);
    const currentQuarterCheckinGoalIds = new Set(
      checkins.filter((checkin) => checkin.quarter === currentQuarter).map((checkin) => checkin.goal_id)
    );
    const pendingCheckins = approvedGoals.filter((goal) => !currentQuarterCheckinGoalIds.has(goal.id)).length;
    const allGoals = sheets.flatMap((sheet) => sheet.goals ?? []);

    const reportRows: AchievementReportRow[] = achievements.map((achievement) => {
      const goal = achievement.goals;
      const employee = goal.goal_sheets.employee;

      return {
        employee: employee?.name ?? 'Unknown',
        department: employee?.department ?? 'Unassigned',
        goalTitle: goal.title,
        thrustArea: goal.thrust_area?.name ?? 'Unassigned',
        uom: goal.uom_type,
        target: targetLabel(goal),
        actual: actualLabel(achievement),
        score: achievement.progress_score === null ? null : Number(achievement.progress_score),
        scoreLabel: scoreLabel(achievement.progress_score === null ? null : Number(achievement.progress_score)),
        quarter: achievement.quarter,
        status: goal.status,
      };
    });

    const auditRows: AuditReportRow[] = audits.map((audit) => ({
      timestamp: audit.changed_at,
      user: audit.changed_by_profile?.name ?? audit.changed_by,
      action: audit.action,
      tableName: audit.table_name,
      oldValue: safeJson(audit.old_value),
      newValue: safeJson(audit.new_value),
    }));

    const departments = Array.from(new Set(employees.map((employee) => employee.department ?? 'Unassigned')));
    const departmentAggregates: DepartmentAggregate[] = departments.map((department) => {
      const departmentEmployees = employees.filter((employee) => (employee.department ?? 'Unassigned') === department);
      const departmentEmployeeIds = new Set(departmentEmployees.map((employee) => employee.id));
      const departmentAchievements = achievements.filter((achievement) =>
        departmentEmployeeIds.has(achievement.goals.goal_sheets.employee_id)
      );
      const scores = departmentAchievements
        .map((achievement) => achievement.progress_score)
        .filter((score): score is number => score !== null)
        .map((score) => Number(score));

      return {
        department,
        completionRate:
          departmentEmployees.length === 0 ? 0 : Math.round((departmentAchievements.length / departmentEmployees.length) * 100),
        averageScore: average(scores),
      };
    });

    const quarterTrends: QuarterTrend[] = ['Q1', 'Q2', 'Q3', 'Q4'].map((quarter) => {
      const scores = achievements
        .filter((achievement) => achievement.quarter === quarter)
        .map((achievement) => achievement.progress_score)
        .filter((score): score is number => score !== null)
        .map((score) => Number(score));

      return {
        quarter,
        averageScore: average(scores),
      };
    });

    const thrustCounts = new Map<string, number>();

    for (const goal of allGoals) {
      const thrustAreaName = goal.thrust_area?.name ?? 'Unassigned';
      thrustCounts.set(thrustAreaName, (thrustCounts.get(thrustAreaName) ?? 0) + 1);
    }

    const totalGoals = allGoals.length;
    const thrustAreaDistribution: ThrustAreaDistribution[] = Array.from(thrustCounts.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalGoals === 0 ? 0 : Math.round((count / totalGoals) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const uomLabels: Record<UomType, string> = {
      min: 'Minimum',
      max: 'Maximum',
      timeline: 'Timeline',
      zero: 'Zero tolerance',
    };

    const uomDistribution: UomDistribution[] = (Object.keys(uomLabels) as UomType[]).map((type) => ({
      type,
      label: uomLabels[type],
      count: allGoals.filter((goal) => goal.uom_type === type).length,
    }));

    const managerEffectiveness: ManagerEffectivenessRow[] = managers.map((manager) => {
      const directReports = employees.filter((employee) => employee.manager_id === manager.id);
      const directReportIds = new Set(directReports.map((employee) => employee.id));
      const directReportSheets = sheets.filter((sheet) => directReportIds.has(sheet.employee_id));
      const approvedDirectReportSheets = directReportSheets.filter((sheet) => sheet.status === 'approved');
      const approvalDurations = approvedDirectReportSheets
        .filter((sheet) => sheet.submitted_at && sheet.approved_at)
        .map((sheet) =>
          Math.max(
            0,
            (new Date(sheet.approved_at as string).getTime() - new Date(sheet.submitted_at as string).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );
      const directReportApprovedGoals = approvedDirectReportSheets.flatMap((sheet) => sheet.goals ?? []);
      const directReportApprovedGoalIds = new Set(directReportApprovedGoals.map((goal) => goal.id));
      const managerCurrentQuarterCheckins = checkins.filter(
        (checkin) => checkin.quarter === currentQuarter && checkin.manager_id === manager.id && directReportApprovedGoalIds.has(checkin.goal_id)
      );

      return {
        managerName: manager.name,
        directReports: directReports.length,
        sheetsApproved: approvedDirectReportSheets.length,
        avgDaysToApprove:
          approvalDurations.length === 0
            ? 0
            : Number((approvalDurations.reduce((sum, value) => sum + value, 0) / approvalDurations.length).toFixed(1)),
        checkinCompletionRate:
          directReportApprovedGoals.length === 0
            ? 0
            : Math.round((managerCurrentQuarterCheckins.length / directReportApprovedGoals.length) * 100),
      };
    });

    const dashboardStats: DashboardStats = {
      totalEmployees: employees.length,
      sheetsSubmitted: submittedOrApprovedSheets.length,
      sheetsApproved: approvedSheets.length,
      q1CompletionRate: employees.length === 0 ? 0 : Math.round((q1Employees.size / employees.length) * 100),
      pendingCheckins,
      openWindows: windows.filter((windowRow) => windowRow.is_open).length,
      submittedRate: employees.length === 0 ? 0 : Math.round((submittedOrApprovedSheets.length / employees.length) * 100),
      managerCheckinRate: managers.length === 0 ? 0 : Math.round((currentQuarterManagerIds.size / managers.length) * 100),
    };

    return NextResponse.json({
      reportRows,
      auditRows,
      dashboardStats,
      departmentAggregates,
      quarterTrends,
      thrustAreaDistribution,
      uomDistribution,
      managerEffectiveness,
      currentQuarter,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unable to load reports.', 500);
  }
}
