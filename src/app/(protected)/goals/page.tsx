'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useProfile } from '@/components/profile-provider';
import { GoalSheet } from '@/components/goals/GoalSheet';
import type { GoalFormValues } from '@/components/goals/GoalForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Goal, GoalSheetWithGoals, ThrustArea } from '@/lib/types';
import { ClipboardList, Plus } from 'lucide-react';

interface GoalsResponse {
  sheet: GoalSheetWithGoals | null;
  thrustAreas: ThrustArea[];
}

interface CreateSheetResponse {
  sheet: GoalSheetWithGoals;
}

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? 'Request failed.';
}

export default function GoalsPage() {
  const { profile, isLoading: isProfileLoading } = useProfile();
  const [sheet, setSheet] = useState<GoalSheetWithGoals | null>(null);
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const loadGoals = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/goals');

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as GoalsResponse;
      setSheet(data.sheet);
      setThrustAreas(data.thrustAreas);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load goals.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isProfileLoading) {
      void loadGoals();
    }
  }, [isProfileLoading, loadGoals]);

  async function createSheet() {
    setIsBusy(true);

    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createSheet' }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as CreateSheetResponse;
      setSheet(data.sheet);
      toast.success('Goal sheet created.');
      await loadGoals();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create goal sheet.');
    } finally {
      setIsBusy(false);
    }
  }

  async function createGoal(values: GoalFormValues) {
    if (!sheet) {
      throw new Error('Create a goal sheet before adding goals.');
    }

    const response = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'createGoal', sheetId: sheet.id, goal: values }),
    });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    toast.success('Goal added.');
    await loadGoals();
  }

  async function updateGoal(goal: Goal, values: GoalFormValues) {
    const response = await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateGoal', goalId: goal.id, goal: values }),
    });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    toast.success('Goal updated.');
    await loadGoals();
  }

  async function deleteGoal(goal: Goal) {
    const response = await fetch(`/api/goals?goalId=${goal.id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      toast.error(await readApiError(response));
      return;
    }

    toast.success('Goal deleted.');
    await loadGoals();
  }

  async function submitSheet() {
    if (!sheet) {
      return;
    }

    const response = await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submitSheet', sheetId: sheet.id }),
    });

    if (!response.ok) {
      toast.error(await readApiError(response));
      return;
    }

    toast.success(sheet.status === 'returned' ? 'Goal sheet resubmitted.' : 'Goal sheet submitted.');
    await loadGoals();
  }

  if (isProfileLoading || isLoading) {
    return (
      <div className="page-shell space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-36" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.5px] text-white">My Goals</h1>
          <p className="text-white/50">
            Welcome back, {profile?.name?.split(' ')[0] ?? 'there'}. Build and submit your FY 2025-26 goal sheet.
          </p>
        </div>
      </div>

      {sheet ? (
        <GoalSheet
          sheet={sheet}
          thrustAreas={thrustAreas}
          isBusy={isBusy}
          onCreateGoal={createGoal}
          onUpdateGoal={updateGoal}
          onDeleteGoal={deleteGoal}
          onSubmitSheet={submitSheet}
        />
      ) : (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No Goal Sheet Yet</CardTitle>
            <CardDescription>
              Create a sheet for FY 2025-26, then add up to 8 goals with a total weightage of exactly 100%.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
              <ClipboardList className="h-8 w-8 text-white/50" />
            </div>
            <Button onClick={createSheet} disabled={isBusy}>
              <Plus className="h-4 w-4" />
              {isBusy ? 'Creating...' : 'Create Goal Sheet'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
