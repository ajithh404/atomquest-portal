import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { Goal, GoalSheet, GoalSheetWithGoals, Profile, ThrustArea } from '@/lib/types';
import {
  CURRENT_CYCLE_YEAR,
  MAX_GOALS_PER_SHEET,
  validateGoalSheetForSubmission,
} from '@/lib/validations';

type GoalWithThrust = Goal & { thrust_area: ThrustArea | null };
type SheetRow = GoalSheet & {
  goals?: GoalWithThrust[];
  employee?: Profile | null;
};

const uomSchema = z.enum(['min', 'max', 'timeline', 'zero']);

const goalPayloadSchema = z
  .object({
    thrust_area_id: z.string().uuid('Select a valid thrust area.'),
    title: z.string().min(3, 'Goal title must be at least 3 characters.'),
    description: z.string().nullable().optional(),
    uom_type: uomSchema,
    target_value: z.number().nullable().optional(),
    target_date: z.string().nullable().optional(),
    weightage: z.number().min(10, 'Weightage must be at least 10%.').max(100, 'Weightage cannot exceed 100%.'),
  })
  .superRefine((value, context) => {
    if (value.uom_type === 'timeline' && !value.target_date) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['target_date'],
        message: 'Target date is required for timeline goals.',
      });
    }

    if ((value.uom_type === 'min' || value.uom_type === 'max') && (!value.target_value || value.target_value <= 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['target_value'],
        message: 'Target value must be greater than 0.',
      });
    }
  });

const postSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('createSheet') }),
  z.object({ action: z.literal('createGoal'), sheetId: z.string().uuid(), goal: goalPayloadSchema }),
  z.object({
    action: z.literal('shareGoal'),
    sourceGoalId: z.string().uuid(),
    recipientIds: z.array(z.string().uuid()).min(1, 'Select at least one recipient.'),
    weightage: z.number().min(10).max(100),
  }),
]);

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('submitSheet'), sheetId: z.string().uuid() }),
  z.object({ action: z.literal('updateGoal'), goalId: z.string().uuid(), goal: goalPayloadSchema }),
  z.object({
    action: z.literal('managerUpdateGoal'),
    goalId: z.string().uuid(),
    target_value: z.number().nullable().optional(),
    target_date: z.string().nullable().optional(),
    weightage: z.number().min(10).max(100),
  }),
]);

const deleteSchema = z.object({
  goalId: z.string().uuid(),
});

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function mapSheet(row: SheetRow): GoalSheetWithGoals {
  return {
    ...row,
    goals: (row.goals ?? []).map((goal) => ({
      ...goal,
      thrust_area: goal.thrust_area ?? undefined,
    })),
    employee: row.employee ?? undefined,
  };
}

function normalizeGoalPayload(payload: z.infer<typeof goalPayloadSchema>) {
  const targetValue = payload.uom_type === 'timeline' || payload.uom_type === 'zero' ? null : payload.target_value ?? null;
  const targetDate = payload.uom_type === 'timeline' ? payload.target_date ?? null : null;

  return {
    thrust_area_id: payload.thrust_area_id,
    title: payload.title,
    description: payload.description ?? null,
    uom_type: payload.uom_type,
    target_value: targetValue,
    target_date: targetDate,
    weightage: payload.weightage,
  };
}

function sharedFieldsChanged(existing: Goal, incoming: z.infer<typeof goalPayloadSchema>): boolean {
  return (
    existing.thrust_area_id !== incoming.thrust_area_id ||
    existing.title !== incoming.title ||
    (existing.description ?? '') !== (incoming.description ?? '') ||
    existing.uom_type !== incoming.uom_type ||
    Number(existing.target_value ?? 0) !== Number(incoming.target_value ?? 0) ||
    (existing.target_date ?? '') !== (incoming.target_date ?? '')
  );
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

async function fetchActiveThrustAreas(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from('thrust_areas')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ThrustArea[];
}

async function fetchSheetById(supabase: Awaited<ReturnType<typeof createClient>>, sheetId: string) {
  const { data, error } = await supabase
    .from('goal_sheets')
    .select('*, employee:profiles!goal_sheets_employee_id_fkey(*), goals(*, thrust_area:thrust_areas(*))')
    .eq('id', sheetId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapSheet(data as SheetRow);
}

async function fetchCurrentSheet(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase
    .from('goal_sheets')
    .select('*, employee:profiles!goal_sheets_employee_id_fkey(*), goals(*, thrust_area:thrust_areas(*))')
    .eq('employee_id', userId)
    .eq('cycle_year', CURRENT_CYCLE_YEAR)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapSheet(data as SheetRow) : null;
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

export async function GET(request: NextRequest) {
  const { supabase, userId, profile, response } = await getSessionProfile();

  if (response) {
    return response;
  }

  if (!userId || !profile) {
    return jsonError('You must be signed in.', 401);
  }

  try {
    const { searchParams } = new URL(request.url);
    const sheetId = searchParams.get('sheetId');
    const scope = searchParams.get('scope');
    const thrustAreas = await fetchActiveThrustAreas(supabase);

    if (scope === 'team') {
      if (profile.role !== 'manager' && profile.role !== 'admin') {
        return jsonError('Only managers and admins can view team goal sheets.', 403);
      }

      const query = supabase
        .from('goal_sheets')
        .select('*, employee:profiles!goal_sheets_employee_id_fkey(*), goals(*, thrust_area:thrust_areas(*))')
        .eq('cycle_year', CURRENT_CYCLE_YEAR)
        .in('status', ['submitted', 'approved', 'returned']);

      const { data, error } = await query.order('submitted_at', { ascending: false, nullsFirst: false });

      if (error) {
        throw new Error(error.message);
      }

      const sheets = ((data ?? []) as SheetRow[]).map(mapSheet);
      const { data: reports } = await supabase
        .from('profiles')
        .select('*')
        .eq(profile.role === 'manager' ? 'manager_id' : 'role', profile.role === 'manager' ? userId : 'employee')
        .order('name', { ascending: true });
      const directReports = (reports ?? []) as Profile[];

      return NextResponse.json({ sheets, thrustAreas, directReports });
    }

    if (sheetId) {
      const sheet = await fetchSheetById(supabase, sheetId);
      let directReports: Profile[] = [];

      if (profile.role === 'manager' || profile.role === 'admin') {
        const { data: reports } = await supabase
          .from('profiles')
          .select('*')
          .eq(profile.role === 'manager' ? 'manager_id' : 'role', profile.role === 'manager' ? userId : 'employee')
          .order('name', { ascending: true });

        directReports = (reports ?? []) as Profile[];
      }

      return NextResponse.json({ sheet, thrustAreas, directReports });
    }

    const sheet = await fetchCurrentSheet(supabase, userId);
    return NextResponse.json({ sheet, thrustAreas });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unable to load goals.', 500);
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

  const parsed = postSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid request.');
  }

  try {
    if (parsed.data.action === 'createSheet') {
      const { data, error } = await supabase
        .from('goal_sheets')
        .insert({
          employee_id: userId,
          cycle_year: CURRENT_CYCLE_YEAR,
          status: 'draft',
        })
        .select()
        .single();

      if (error) {
        return jsonError(error.message);
      }

      return NextResponse.json({ sheet: data });
    }

    if (parsed.data.action === 'createGoal') {
      const sheet = await fetchSheetById(supabase, parsed.data.sheetId);

      if (sheet.employee_id !== userId) {
        return jsonError('You can add goals only to your own sheet.', 403);
      }

      if (sheet.status !== 'draft' && sheet.status !== 'returned') {
        return jsonError('This sheet is locked. Only draft or returned sheets can be edited.');
      }

      if (sheet.goals.length >= MAX_GOALS_PER_SHEET) {
        return jsonError(`A goal sheet can have a maximum of ${MAX_GOALS_PER_SHEET} goals.`);
      }

      const { data, error } = await supabase
        .from('goals')
        .insert({
          ...normalizeGoalPayload(parsed.data.goal),
          sheet_id: parsed.data.sheetId,
          status: 'not_started',
          is_shared: false,
        })
        .select()
        .single();

      if (error) {
        return jsonError(error.message);
      }

      return NextResponse.json({ goal: data });
    }

    if (profile.role !== 'manager' && profile.role !== 'admin') {
      return jsonError('Only managers and admins can share goals.', 403);
    }

    const { goal: sourceGoal } = await fetchGoalAndSheet(supabase, parsed.data.sourceGoalId);
    const insertedGoals: Goal[] = [];

    for (const recipientId of parsed.data.recipientIds) {
      const { data: reportProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', recipientId)
        .single();

      if (!reportProfile) {
        return jsonError('Selected recipient is not available to you.', 403);
      }

      const recipientSheetResult = await supabase
        .from('goal_sheets')
        .select('*, goals(*)')
        .eq('employee_id', recipientId)
        .eq('cycle_year', CURRENT_CYCLE_YEAR)
        .maybeSingle();
      let recipientSheet = recipientSheetResult.data;
      const recipientSheetError = recipientSheetResult.error;

      if (recipientSheetError) {
        return jsonError(recipientSheetError.message);
      }

      if (!recipientSheet) {
        const { data: createdSheet, error: createSheetError } = await supabase
          .from('goal_sheets')
          .insert({
            employee_id: recipientId,
            cycle_year: CURRENT_CYCLE_YEAR,
            status: 'draft',
          })
          .select('*, goals(*)')
          .single();

        if (createSheetError || !createdSheet) {
          return jsonError(createSheetError?.message ?? 'Unable to create recipient goal sheet.');
        }

        recipientSheet = createdSheet;
      }

      const typedSheet = recipientSheet as GoalSheet & { goals?: Goal[] };

      if (typedSheet.status === 'approved') {
        return jsonError(`${(reportProfile as Profile).name}'s sheet is approved and locked.`);
      }

      if ((typedSheet.goals ?? []).length >= MAX_GOALS_PER_SHEET) {
        return jsonError(`${(reportProfile as Profile).name}'s sheet already has ${MAX_GOALS_PER_SHEET} goals.`);
      }

      const { data: sharedGoal, error: shareError } = await supabase
        .from('goals')
        .insert({
          sheet_id: typedSheet.id,
          thrust_area_id: sourceGoal.thrust_area_id,
          title: sourceGoal.title,
          description: sourceGoal.description,
          uom_type: sourceGoal.uom_type,
          target_value: sourceGoal.target_value,
          target_date: sourceGoal.target_date,
          weightage: parsed.data.weightage,
          status: 'not_started',
          is_shared: true,
          shared_from: sourceGoal.id,
        })
        .select()
        .single();

      if (shareError || !sharedGoal) {
        return jsonError(shareError?.message ?? 'Unable to share goal.');
      }

      insertedGoals.push(sharedGoal as Goal);
    }

    return NextResponse.json({ goals: insertedGoals });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unable to save goal data.', 500);
  }
}

export async function PATCH(request: NextRequest) {
  const { supabase, userId, profile, response } = await getSessionProfile();

  if (response) {
    return response;
  }

  if (!userId || !profile) {
    return jsonError('You must be signed in.', 401);
  }

  const parsed = patchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid request.');
  }

  try {
    if (parsed.data.action === 'submitSheet') {
      const sheet = await fetchSheetById(supabase, parsed.data.sheetId);

      if (sheet.employee_id !== userId) {
        return jsonError('You can submit only your own goal sheet.', 403);
      }

      if (sheet.status !== 'draft' && sheet.status !== 'returned') {
        return jsonError('Only draft or returned sheets can be submitted.');
      }

      const validation = validateGoalSheetForSubmission(sheet.goals);

      if (!validation.isValid) {
        return jsonError(validation.errors[0] ?? 'Goal sheet is not ready for submission.');
      }

      const { error } = await supabase
        .from('goal_sheets')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          return_comment: null,
        })
        .eq('id', sheet.id);

      if (error) {
        return jsonError(error.message);
      }

      return NextResponse.json({ ok: true });
    }

    const { goal, sheet } = await fetchGoalAndSheet(supabase, parsed.data.goalId);

    if (sheet.status === 'approved') {
      return jsonError('This goal is locked because the sheet is approved.');
    }

    if (parsed.data.action === 'managerUpdateGoal') {
      if (profile.role !== 'manager' && profile.role !== 'admin') {
        return jsonError('Only managers and admins can review submitted goals.', 403);
      }

      if (sheet.status !== 'submitted') {
        return jsonError('Managers can edit goals only while the sheet is submitted.');
      }

      const { error } = await supabase
        .from('goals')
        .update({
          target_value: parsed.data.target_value ?? null,
          target_date: parsed.data.target_date ?? null,
          weightage: parsed.data.weightage,
        })
        .eq('id', goal.id);

      if (error) {
        return jsonError(error.message);
      }

      return NextResponse.json({ ok: true });
    }

    if (sheet.employee_id !== userId) {
      return jsonError('You can edit only goals on your own sheet.', 403);
    }

    if (sheet.status !== 'draft' && sheet.status !== 'returned') {
      return jsonError('Only draft or returned goals can be edited.');
    }

    if (goal.is_shared && sharedFieldsChanged(goal, parsed.data.goal)) {
      return jsonError('Shared goals allow only weightage edits.');
    }

    const normalizedGoal = normalizeGoalPayload(parsed.data.goal);
    const updatePayload = goal.is_shared ? { weightage: normalizedGoal.weightage } : normalizedGoal;
    const { error } = await supabase.from('goals').update(updatePayload).eq('id', goal.id);

    if (error) {
      return jsonError(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unable to update goal data.', 500);
  }
}

export async function DELETE(request: NextRequest) {
  const { supabase, userId, response } = await getSessionProfile();

  if (response) {
    return response;
  }

  if (!userId) {
    return jsonError('You must be signed in.', 401);
  }

  const parsed = deleteSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid request.');
  }

  try {
    const { goal, sheet } = await fetchGoalAndSheet(supabase, parsed.data.goalId);

    if (sheet.employee_id !== userId) {
      return jsonError('You can delete only goals on your own sheet.', 403);
    }

    if (sheet.status !== 'draft' && sheet.status !== 'returned') {
      return jsonError('Only draft or returned goals can be deleted.');
    }

    const { error } = await supabase.from('goals').delete().eq('id', goal.id);

    if (error) {
      return jsonError(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unable to delete goal.', 500);
  }
}
