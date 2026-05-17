import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type {
  Achievement,
  Checkin,
  Goal,
  GoalSheet,
  Profile,
  Quarter,
  ThrustArea,
} from '@/lib/types';
import { CURRENT_CYCLE_YEAR } from '@/lib/validations';

type GoalCheckinRow = Goal & {
  thrust_area: ThrustArea | null;
  achievements: Achievement[];
  checkins: Checkin[];
};

type SheetCheckinRow = GoalSheet & {
  goals?: GoalCheckinRow[];
  employee?: Profile | null;
};

const checkinSchema = z.object({
  goalId: z.string().uuid(),
  quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
  comment: z.string().min(3, 'Check-in comment must be at least 3 characters.'),
});

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
    return { supabase, userId: null, profile: null, response: jsonError('You must be signed in.', 401) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { supabase, userId: user.id, profile: null, response: jsonError('Your profile could not be loaded.', 403) };
  }

  return { supabase, userId: user.id, profile: profile as Profile, response: null };
}

async function fetchDirectReports(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: Profile,
  userId: string
) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq(profile.role === 'admin' ? 'role' : 'manager_id', profile.role === 'admin' ? 'employee' : userId)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Profile[];
}

export async function GET(request: NextRequest) {
  const { supabase, userId, profile, response } = await getSessionProfile();

  if (response) {
    return response;
  }

  if (!userId || !profile) {
    return jsonError('You must be signed in.', 401);
  }

  if (profile.role !== 'manager' && profile.role !== 'admin') {
    return jsonError('Only managers and admins can view check-ins.', 403);
  }

  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const directReports = await fetchDirectReports(supabase, profile, userId);
    const selectedEmployeeId = employeeId ?? directReports[0]?.id ?? null;
    let sheet: SheetCheckinRow | null = null;

    if (selectedEmployeeId) {
      const allowed = profile.role === 'admin' || directReports.some((report) => report.id === selectedEmployeeId);

      if (!allowed) {
        return jsonError('You can view check-ins only for direct reports.', 403);
      }

      const { data, error } = await supabase
        .from('goal_sheets')
        .select('*, employee:profiles!goal_sheets_employee_id_fkey(*), goals(*, thrust_area:thrust_areas(*), achievements(*), checkins(*))')
        .eq('employee_id', selectedEmployeeId)
        .eq('cycle_year', CURRENT_CYCLE_YEAR)
        .eq('status', 'approved')
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      sheet = data as SheetCheckinRow | null;
    }

    return NextResponse.json({ directReports, selectedEmployeeId, sheet });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unable to load check-ins.', 500);
  }
}

export async function POST(request: NextRequest) {
  const { supabase, userId, profile, response } = await getSessionProfile();

  if (response) {
    return response;
  }

  if (!userId || !profile) {
    return jsonError('You must be signed in.', 401);
  }

  if (profile.role !== 'manager' && profile.role !== 'admin') {
    return jsonError('Only managers and admins can add check-ins.', 403);
  }

  const parsed = checkinSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid check-in.');
  }

  const { data: goal, error: goalError } = await supabase
    .from('goals')
    .select('*, goal_sheets!inner(*)')
    .eq('id', parsed.data.goalId)
    .single();

  if (goalError || !goal) {
    return jsonError(goalError?.message ?? 'Goal not found.', 404);
  }

  const typedGoal = goal as Goal & { goal_sheets: GoalSheet };

  if (typedGoal.goal_sheets.status !== 'approved') {
    return jsonError('Check-ins can be added only for approved goal sheets.');
  }

  const { error } = await supabase.from('checkins').insert({
    goal_id: parsed.data.goalId,
    quarter: parsed.data.quarter as Quarter,
    manager_id: userId,
    comment: parsed.data.comment,
  });

  if (error) {
    return jsonError(error.message);
  }

  return NextResponse.json({ ok: true });
}
