'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { GoalSheet } from '@/components/goals/GoalSheet';
import type { GoalFormValues } from '@/components/goals/GoalForm';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Goal, GoalSheetWithGoals, ThrustArea } from '@/lib/types';
import { ArrowLeft } from 'lucide-react';

interface GoalSheetDetailPageProps {
  params: {
    sheetId: string;
  };
}

interface GoalsResponse {
  sheet: GoalSheetWithGoals;
  thrustAreas: ThrustArea[];
}

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? 'Request failed.';
}

export default function GoalSheetDetailPage({ params }: GoalSheetDetailPageProps) {
  const [sheet, setSheet] = useState<GoalSheetWithGoals | null>(null);
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSheet = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/goals?sheetId=${params.sheetId}`);

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as GoalsResponse;
      setSheet(data.sheet);
      setThrustAreas(data.thrustAreas);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load goal sheet.');
    } finally {
      setIsLoading(false);
    }
  }, [params.sheetId]);

  useEffect(() => {
    void loadSheet();
  }, [loadSheet]);

  async function createGoal(values: GoalFormValues) {
    if (!sheet) {
      throw new Error('Goal sheet was not loaded.');
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
    await loadSheet();
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
    await loadSheet();
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
    await loadSheet();
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

    toast.success('Goal sheet submitted.');
    await loadSheet();
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-36" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="px-0">
        <Link href="/goals">
          <ArrowLeft className="h-4 w-4" />
          Back to My Goals
        </Link>
      </Button>

      {sheet && (
        <GoalSheet
          sheet={sheet}
          thrustAreas={thrustAreas}
          onCreateGoal={createGoal}
          onUpdateGoal={updateGoal}
          onDeleteGoal={deleteGoal}
          onSubmitSheet={submitSheet}
        />
      )}
    </div>
  );
}
