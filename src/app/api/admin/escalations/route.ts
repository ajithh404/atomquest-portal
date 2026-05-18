import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { Achievement, Goal, GoalSheet, Profile, QuarterlyWindow } from '@/lib/types';
import { CURRENT_CYCLE_YEAR } from '@/lib/validations';

const escalationRules = ['Overdue Submission', 'Pending Approval', 'Missing Check-in'] as const;
const uuidShape = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const reminderSchema = z.object({
  ruleName: z.enum(escalationRules),
  targetUserId: z.string().regex(uuidShape, 'Invalid user id.'),
  notes: z.string().max(500).optional(),
});

type EscalationRuleName = (typeof escalationRules)[number];

type GoalSheetRow = GoalSheet & {
  employee: Profile | null;
};

type EscalationLogRow = {
  id: string;
  rule_name: EscalationRuleName;
  target_user_id: string;
  sent_by: string;
  sent_at: string;
  notes: string | null;
  target: Pick<Profile, 'name' | 'email' | 'role'> | null;
  sender: Pick<Profile, 'name' | 'email' | 'role'> | null;
};

interface EscalationItem {
  id: string;
  ruleName: EscalationRuleName;
  employeeId: string;
  employeeName: string;
  department: string;
  daysOverdue: number;
  targetUserId: string;
  targetUserName: string;
  targetEmail: string;
  notes: string;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getAdminSession() {
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

  if ((profile as Profile).role !== 'admin') {
    return { supabase, profile: null, response: jsonError('Only admins can manage escalations.', 403) };
  }

  return { supabase, profile: profile as Profile, response: null };
}

function daysSince(value: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)));
}

function buildItem(params: {
  ruleName: EscalationRuleName;
  employee: Profile;
  target: Profile;
  daysOverdue: number;
  notes: string;
}): EscalationItem {
  return {
    id: `${params.ruleName}-${params.employee.id}-${params.target.id}`,
    ruleName: params.ruleName,
    employeeId: params.employee.id,
    employeeName: params.employee.name,
    department: params.employee.department ?? 'Unassigned',
    daysOverdue: params.daysOverdue,
    targetUserId: params.target.id,
    targetUserName: params.target.name,
    targetEmail: params.target.email,
    notes: params.notes,
  };
}

export async function GET() {
  const { supabase, response } = await getAdminSession();

  if (response) {
    return response;
  }

  try {
    const [profilesResult, sheetsResult, goalsResult, achievementsResult, windowsResult, logsResult] =
      await Promise.all([
        supabase.from('profiles').select('*'),
        supabase
          .from('goal_sheets')
          .select('*, employee:profiles!goal_sheets_employee_id_fkey(*)')
          .eq('cycle_year', CURRENT_CYCLE_YEAR),
        supabase.from('goals').select('*'),
        supabase.from('achievements').select('*'),
        supabase
          .from('quarterly_windows')
          .select('*')
          .eq('cycle_year', CURRENT_CYCLE_YEAR)
          .order('start_date', { ascending: true }),
        supabase
          .from('escalation_logs')
          .select(
            '*, target:profiles!escalation_logs_target_user_id_fkey(name,email,role), sender:profiles!escalation_logs_sent_by_fkey(name,email,role)'
          )
          .order('sent_at', { ascending: false })
          .limit(25),
      ]);

    for (const result of [profilesResult, sheetsResult, goalsResult, achievementsResult, windowsResult]) {
      if (result.error) {
        throw new Error(result.error.message);
      }
    }

    const profiles = (profilesResult.data ?? []) as Profile[];
    const employees = profiles.filter((item) => item.role === 'employee');
    const profileById = new Map(profiles.map((item) => [item.id, item]));
    const sheets = (sheetsResult.data ?? []) as GoalSheetRow[];
    const goals = (goalsResult.data ?? []) as Goal[];
    const achievements = (achievementsResult.data ?? []) as Achievement[];
    const windows = (windowsResult.data ?? []) as QuarterlyWindow[];
    const openWindow = windows.find((windowRow) => windowRow.is_open);
    const openWindowDays = openWindow ? daysSince(openWindow.start_date) : 0;
    const sheetsByEmployee = new Map(sheets.map((sheet) => [sheet.employee_id, sheet]));
    const goalsBySheetId = new Map<string, Goal[]>();

    for (const goal of goals) {
      const currentGoals = goalsBySheetId.get(goal.sheet_id) ?? [];
      currentGoals.push(goal);
      goalsBySheetId.set(goal.sheet_id, currentGoals);
    }

    const overdueSubmission: EscalationItem[] =
      openWindow && openWindowDays > 7
        ? employees
            .filter((employee) => {
              const sheet = sheetsByEmployee.get(employee.id);
              return !sheet || sheet.status === 'draft';
            })
            .map((employee) =>
              buildItem({
                ruleName: 'Overdue Submission',
                employee,
                target: employee,
                daysOverdue: Math.max(0, openWindowDays - 7),
                notes: `${employee.name} has not submitted a FY2025-26 goal sheet while ${openWindow.quarter} is open.`,
              })
            )
        : [];

    const pendingApproval = sheets
      .filter((sheet) => {
        const employee = sheet.employee ?? profileById.get(sheet.employee_id);
        return employee?.role === 'employee' && sheet.status === 'submitted' && daysSince(sheet.submitted_at) > 3;
      })
      .map((sheet) => {
        const employee = sheet.employee ?? profileById.get(sheet.employee_id);
        const manager = employee?.manager_id ? profileById.get(employee.manager_id) : null;

        if (!employee || !manager) {
          return null;
        }

        return buildItem({
          ruleName: 'Pending Approval',
          employee,
          target: manager,
          daysOverdue: Math.max(0, daysSince(sheet.submitted_at) - 3),
          notes: `${employee.name}'s submitted sheet has been waiting for manager approval.`,
        });
      })
      .filter((item): item is EscalationItem => item !== null);

    const missingCheckin: EscalationItem[] = [];

    if (openWindow) {
      const achievementGoalIds = new Set(
        achievements
          .filter((achievement) => achievement.quarter === openWindow.quarter)
          .map((achievement) => achievement.goal_id)
      );
      for (const sheet of sheets.filter((item) => item.status === 'approved')) {
        const employee = sheet.employee ?? profileById.get(sheet.employee_id);

        if (!employee || employee.role !== 'employee') {
          continue;
        }

        const approvedGoals = goalsBySheetId.get(sheet.id) ?? [];
        const hasAchievement = approvedGoals.some((goal) => achievementGoalIds.has(goal.id));

        if (approvedGoals.length > 0 && !hasAchievement) {
          missingCheckin.push(
            buildItem({
              ruleName: 'Missing Check-in',
              employee,
              target: employee,
              daysOverdue: openWindowDays,
              notes: `${employee.name} has no ${openWindow.quarter} achievement or check-in activity yet.`,
            })
          );
        }
      }
    }

    const logs = logsResult.error ? [] : ((logsResult.data ?? []) as EscalationLogRow[]);

    return NextResponse.json({
      sections: {
        overdueSubmission,
        pendingApproval,
        missingCheckin,
      },
      logs,
      currentQuarter: openWindow?.quarter ?? null,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unable to load escalations.', 500);
  }
}

export async function POST(request: Request) {
  const { supabase, profile, response } = await getAdminSession();

  if (response) {
    return response;
  }

  const parsed = reminderSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonError('Invalid reminder request.', 422);
  }

  if (!profile) {
    return jsonError('Your profile could not be loaded.', 403);
  }

  const { data: target, error: targetError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', parsed.data.targetUserId)
    .single();

  if (targetError || !target) {
    return jsonError('Reminder recipient could not be found.', 404);
  }

  let emailSent = false;
  let emailError: string | null = null;

  try {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured.');
    }

    const resend = new Resend(apiKey);
    const targetProfile = target as Profile;

    await resend.emails.send({
      from: 'AtomQuest <onboarding@resend.dev>',
      to: targetProfile.email,
      subject: `AtomQuest reminder: ${parsed.data.ruleName}`,
      text: `Hi ${targetProfile.name}, this is a reminder for ${parsed.data.ruleName}. ${
        parsed.data.notes ?? 'Please log in to AtomQuest to take the required action.'
      }`,
    });

    emailSent = true;
  } catch (error) {
    emailError = error instanceof Error ? error.message : 'Email could not be sent.';
  }

  const logNotes = emailError
    ? `${parsed.data.notes ?? 'Reminder sent.'} Email status: ${emailError}`
    : parsed.data.notes ?? 'Reminder sent.';

  const { error: logError } = await supabase.from('escalation_logs').insert({
    rule_name: parsed.data.ruleName,
    target_user_id: parsed.data.targetUserId,
    sent_by: profile.id,
    notes: logNotes,
  });

  if (logError) {
    return jsonError(logError.message, 500);
  }

  return NextResponse.json({ success: true, emailSent, emailError });
}
