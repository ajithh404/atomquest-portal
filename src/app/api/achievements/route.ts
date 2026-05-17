import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { calculateProgressScore } from '@/lib/scoring';
import type {
  Achievement,
  Goal,
  GoalSheet,
  GoalWithAchievements,
  Profile,
  Quarter,
  QuarterlyWindow,
  ThrustArea,
} from '@/lib/types';
import { CURRENT_CYCLE_YEAR } from '@/lib/validations';

type GoalProgressRow = Goal & {
  thrust_area: ThrustArea | null;
  achievements: Achievement[];
};

type SheetProgressRow = GoalSheet & {
  goals?: GoalProgressRow[];
};

const quarterSchema = z.enum(['Q1', 'Q2', 'Q3', 'Q4']);

const achievementSchema = z.object({
  goalId: z.string().uuid(),
  quarter: quarterSchema,
  actualValue: z.number().nullable(),
  actualDate: z.string().min(1, 'Actual date is required.'),
  status: z.enum(['not_started', 'on_track', 'completed']),
  notes: z.string().nullable().optional(),
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

function mapGoal(row: GoalProgressRow): GoalWithAchievements {
  return {
    ...row,
    thrust_area: row.thrust_area ?? undefined,
    achievements: row.achievements ?? [],
    checkins: [],
  };
}

async function fetchWindows(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from('quarterly_windows')
    .select('*')
    .eq('cycle_year', CURRENT_CYCLE_YEAR)
    .order('start_date', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as QuarterlyWindow[];
}

async function fetchGoalAndSheet(supabase: Awaited<ReturnType<typeof createClient>>, goalId: string) {
  const { data: goal, error: goalError } = await supabase
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .single();

  if (goalError || !goal) {
    throw new Error(goalError?.message ?? 'Goal not found.');
  }

  const typedGoal = goal as Goal;
  const { data: sheet, error: sheetError } = await supabase
    .from('goal_sheets')
    .select('*')
    .eq('id', typedGoal.sheet_id)
    .single();

  if (sheetError || !sheet) {
    throw new Error(sheetError?.message ?? 'Goal sheet not found.');
  }

  return { goal: typedGoal, sheet: sheet as GoalSheet };
}

export async function GET() {
  const { supabase, userId, response } = await getSessionProfile();

  if (response) {
    return response;
  }

  if (!userId) {
    return jsonError('You must be signed in.', 401);
  }

  try {
    const [windows, sheetResult] = await Promise.all([
      fetchWindows(supabase),
      supabase
        .from('goal_sheets')
        .select('*, goals(*, thrust_area:thrust_areas(*), achievements(*))')
        .eq('employee_id', userId)
        .eq('cycle_year', CURRENT_CYCLE_YEAR)
        .eq('status', 'approved')
        .maybeSingle(),
    ]);

    if (sheetResult.error) {
      throw new Error(sheetResult.error.message);
    }

    const sheet = sheetResult.data as SheetProgressRow | null;
    const goals = (sheet?.goals ?? []).map(mapGoal);

    return NextResponse.json({ goals, windows });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unable to load achievements.', 500);
  }
}

export async function POST(request: NextRequest) {
  const { supabase, userId, response } = await getSessionProfile();

  if (response) {
    return response;
  }

  if (!userId) {
    return jsonError('You must be signed in.', 401);
  }

  const parsed = achievementSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid achievement entry.');
  }

  try {
    const { goal, sheet } = await fetchGoalAndSheet(supabase, parsed.data.goalId);

    if (sheet.employee_id !== userId) {
      return jsonError('You can log achievements only for your own goals.', 403);
    }

    if (sheet.status !== 'approved') {
      return jsonError('Achievements can be logged only after the goal sheet is approved.');
    }

    const { data: windowRow, error: windowError } = await supabase
      .from('quarterly_windows')
      .select('*')
      .eq('cycle_year', CURRENT_CYCLE_YEAR)
      .eq('quarter', parsed.data.quarter)
      .single();

    if (windowError || !windowRow) {
      return jsonError(windowError?.message ?? 'Quarterly window was not found.');
    }

    const typedWindow = windowRow as QuarterlyWindow;

    if (!typedWindow.is_open) {
      return jsonError(`${parsed.data.quarter} window is closed. Achievement entry is not allowed.`);
    }

    if (goal.uom_type !== 'timeline' && parsed.data.actualValue === null) {
      return jsonError('Actual value is required for this goal.');
    }

    const progressScore = calculateProgressScore({
      uomType: goal.uom_type,
      targetValue: goal.target_value === null ? null : Number(goal.target_value),
      actualValue: parsed.data.actualValue,
      targetDate: goal.target_date,
      actualDate: parsed.data.actualDate,
    });

    const achievementPayload = {
      goal_id: goal.id,
      quarter: parsed.data.quarter as Quarter,
      actual_value: parsed.data.actualValue,
      actual_date: parsed.data.actualDate,
      progress_score: progressScore,
      notes: parsed.data.notes ?? null,
      logged_by: userId,
      logged_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('achievements')
      .upsert(achievementPayload, { onConflict: 'goal_id,quarter' });

    if (upsertError) {
      return jsonError(upsertError.message);
    }

    const { error: statusError } = await supabase
      .from('goals')
      .update({ status: parsed.data.status })
      .eq('id', goal.id);

    if (statusError) {
      return jsonError(statusError.message);
    }

    if (!goal.is_shared) {
      const { data: linkedGoals, error: linkedError } = await supabase
        .from('goals')
        .select('id')
        .eq('shared_from', goal.id);

      if (linkedError) {
        return jsonError(linkedError.message);
      }

      const linkedAchievements = (linkedGoals ?? []).map((linkedGoal) => ({
        ...achievementPayload,
        goal_id: linkedGoal.id,
      }));

      if (linkedAchievements.length > 0) {
        for (const linkedAchievement of linkedAchievements) {
          const { data: existingAchievement, error: existingError } = await supabase
            .from('achievements')
            .select('id')
            .eq('goal_id', linkedAchievement.goal_id)
            .eq('quarter', linkedAchievement.quarter)
            .maybeSingle();

          if (existingError) {
            return jsonError(existingError.message);
          }

          if (existingAchievement) {
            const { error: syncUpdateError } = await supabase
              .from('achievements')
              .update(linkedAchievement)
              .eq('id', existingAchievement.id);

            if (syncUpdateError) {
              return jsonError(syncUpdateError.message);
            }
          } else {
            const { error: syncInsertError } = await supabase.from('achievements').insert(linkedAchievement);

            if (syncInsertError) {
              return jsonError(syncInsertError.message);
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true, progressScore });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unable to save achievement.', 500);
  }
}
