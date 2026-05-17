import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { Goal, GoalSheet, Profile } from '@/lib/types';
import { validateGoalSheetForSubmission } from '@/lib/validations';

const approvalSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), sheetId: z.string().uuid() }),
  z.object({
    action: z.literal('return'),
    sheetId: z.string().uuid(),
    returnComment: z.string().min(5, 'Return comment must be at least 5 characters.'),
  }),
]);

type SheetWithGoals = GoalSheet & {
  goals?: Goal[];
  employee?: Profile | null;
};

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

export async function POST(request: NextRequest) {
  const { supabase, userId, profile, response } = await getSessionProfile();

  if (response) {
    return response;
  }

  if (!userId || !profile) {
    return jsonError('You must be signed in.', 401);
  }

  if (profile.role !== 'manager' && profile.role !== 'admin') {
    return jsonError('Only managers and admins can approve or return goal sheets.', 403);
  }

  const parsed = approvalSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid request.');
  }

  const { data, error } = await supabase
    .from('goal_sheets')
    .select('*, employee:profiles!goal_sheets_employee_id_fkey(*), goals(*)')
    .eq('id', parsed.data.sheetId)
    .single();

  if (error || !data) {
    return jsonError(error?.message ?? 'Goal sheet not found.', 404);
  }

  const sheet = data as SheetWithGoals;

  if (sheet.status !== 'submitted') {
    return jsonError('Only submitted sheets can be approved or returned.');
  }

  if (parsed.data.action === 'approve') {
    const validation = validateGoalSheetForSubmission(sheet.goals ?? []);

    if (!validation.isValid) {
      return jsonError(validation.errors[0] ?? 'Goal sheet is not ready for approval.');
    }

    const { error: updateError } = await supabase
      .from('goal_sheets')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        return_comment: null,
      })
      .eq('id', sheet.id);

    if (updateError) {
      return jsonError(updateError.message);
    }

    return NextResponse.json({ ok: true });
  }

  const { error: returnError } = await supabase
    .from('goal_sheets')
    .update({
      status: 'returned',
      return_comment: parsed.data.returnComment,
      approved_by: null,
      approved_at: null,
    })
    .eq('id', sheet.id);

  if (returnError) {
    return jsonError(returnError.message);
  }

  return NextResponse.json({ ok: true });
}
