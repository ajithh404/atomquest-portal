import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { GoalSheet, Profile, QuarterlyWindow } from '@/lib/types';
import { CURRENT_CYCLE_YEAR } from '@/lib/validations';

const postgresUuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid profile UUID.');

const adminPatchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('updateWindow'),
    windowId: z.string().uuid(),
    isOpen: z.boolean(),
  }),
  z.object({
    action: z.literal('reassignManager'),
    profileId: postgresUuidSchema,
    managerId: postgresUuidSchema.nullable(),
  }),
  z.object({
    action: z.literal('unlockSheet'),
    sheetId: z.string().uuid(),
    reason: z.string().min(5, 'Unlock reason must be at least 5 characters.'),
  }),
]);

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function sendWindowOpenEmails(window: QuarterlyWindow, employees: Profile[]) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || employees.length === 0) {
    return;
  }

  try {
    const resend = new Resend(apiKey);

    await Promise.allSettled(
      employees.map((employee) =>
        resend.emails.send({
          from: 'AtomQuest <onboarding@resend.dev>',
          to: employee.email,
          subject: `${window.quarter} achievement window is now open`,
          text: `Hi ${employee.name}, the ${window.quarter} window is now open. Log in to AtomQuest to log your achievements before the window closes.`,
        })
      )
    );
  } catch (error) {
    console.error('Window notification email failed:', error);
  }
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

export async function GET() {
  const { supabase, profile, response } = await getSessionProfile();

  if (response) {
    return response;
  }

  if (!profile || profile.role !== 'admin') {
    return jsonError('Only admins can access this data.', 403);
  }

  try {
    const [windowsResult, profilesResult] = await Promise.all([
      supabase
        .from('quarterly_windows')
        .select('*')
        .eq('cycle_year', CURRENT_CYCLE_YEAR)
        .order('start_date', { ascending: true }),
      supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true }),
    ]);

    if (windowsResult.error) {
      throw new Error(windowsResult.error.message);
    }

    if (profilesResult.error) {
      throw new Error(profilesResult.error.message);
    }

    return NextResponse.json({
      windows: windowsResult.data ?? [],
      profiles: profilesResult.data ?? [],
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Unable to load admin data.', 500);
  }
}

export async function PATCH(request: NextRequest) {
  const { supabase, userId, profile, response } = await getSessionProfile();

  if (response) {
    return response;
  }

  if (!userId || !profile || profile.role !== 'admin') {
    return jsonError('Only admins can perform this action.', 403);
  }

  const parsed = adminPatchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid admin request.');
  }

  if (parsed.data.action === 'updateWindow') {
    const { data: currentWindow, error: windowError } = await supabase
      .from('quarterly_windows')
      .select('*')
      .eq('id', parsed.data.windowId)
      .single();

    if (windowError || !currentWindow) {
      return jsonError(windowError?.message ?? 'Quarterly window was not found.', 404);
    }

    const { error } = await supabase
      .from('quarterly_windows')
      .update({ is_open: parsed.data.isOpen })
      .eq('id', parsed.data.windowId);

    if (error) {
      return jsonError(error.message);
    }

    const windowOpened = parsed.data.isOpen && !(currentWindow as QuarterlyWindow).is_open;

    if (windowOpened) {
      const { data: employees, error: employeesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'employee');

      if (employeesError) {
        console.error('Unable to load employees for window email:', employeesError.message);
      } else {
        await sendWindowOpenEmails(
          { ...(currentWindow as QuarterlyWindow), is_open: true },
          (employees ?? []) as Profile[]
        );
      }
    }

    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === 'reassignManager') {
    if (parsed.data.managerId === parsed.data.profileId) {
      return jsonError('An employee cannot report to themselves.');
    }

    const { data: targetProfile, error: targetError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', parsed.data.profileId)
      .single();

    if (targetError || !targetProfile) {
      return jsonError('Profile to update was not found.', 404);
    }

    if (parsed.data.managerId) {
      const { data: managerProfile, error: managerError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', parsed.data.managerId)
        .single();

      if (managerError || !managerProfile) {
        return jsonError('Selected manager profile was not found.', 404);
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ manager_id: parsed.data.managerId })
      .eq('id', parsed.data.profileId);

    if (error) {
      return jsonError(error.message);
    }

    return NextResponse.json({ ok: true });
  }

  const { data: sheet, error: sheetError } = await supabase
    .from('goal_sheets')
    .select('*')
    .eq('id', parsed.data.sheetId)
    .single();

  if (sheetError || !sheet) {
    return jsonError(sheetError?.message ?? 'Goal sheet not found.', 404);
  }

  const oldSheet = sheet as GoalSheet;
  const newValue = {
    status: 'returned',
    approved_by: null,
    approved_at: null,
    return_comment: `Unlocked by admin: ${parsed.data.reason}`,
  };

  const { error: updateError } = await supabase
    .from('goal_sheets')
    .update(newValue)
    .eq('id', oldSheet.id);

  if (updateError) {
    return jsonError(updateError.message);
  }

  const { error: auditError } = await supabase.from('audit_logs').insert({
    table_name: 'goal_sheets',
    record_id: oldSheet.id,
    action: 'admin_unlock',
    old_value: oldSheet,
    new_value: {
      ...newValue,
      reason: parsed.data.reason,
    },
    changed_by: userId,
  });

  if (auditError) {
    return jsonError(auditError.message);
  }

  return NextResponse.json({ ok: true });
}
