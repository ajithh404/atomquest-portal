'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckinForm } from '@/components/checkins/CheckinForm';
import { CheckinHistory } from '@/components/checkins/CheckinHistory';
import { formatScore } from '@/lib/scoring';
import type { Achievement, Checkin, Goal, GoalStatus, Profile, Quarter, ThrustArea } from '@/lib/types';
import { MessageSquare } from 'lucide-react';

type CheckinGoal = Goal & {
  thrust_area: ThrustArea | null;
  achievements: Achievement[];
  checkins: Checkin[];
};

interface CheckinsResponse {
  directReports: Profile[];
  selectedEmployeeId: string | null;
  sheet: {
    id: string;
    goals?: CheckinGoal[];
  } | null;
}

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? 'Request failed.';
}

function getStatusLabel(status: GoalStatus) {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'on_track':
      return 'On track';
    default:
      return 'Not started';
  }
}

function getTargetLabel(goal: CheckinGoal) {
  if (goal.uom_type === 'timeline') {
    return goal.target_date ? `By ${new Date(goal.target_date).toLocaleDateString()}` : 'Timeline target';
  }

  if (goal.uom_type === 'zero') {
    return 'Zero target';
  }

  return `${goal.uom_type === 'min' ? 'At least' : 'At most'} ${goal.target_value ?? '-'}`;
}

export default function CheckinsPage() {
  const [directReports, setDirectReports] = useState<Profile[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [goals, setGoals] = useState<CheckinGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingGoalId, setSavingGoalId] = useState<string | null>(null);

  const selectedEmployee = useMemo(
    () => directReports.find((report) => report.id === selectedEmployeeId),
    [directReports, selectedEmployeeId]
  );

  const loadCheckins = useCallback(async (employeeId?: string) => {
    setIsLoading(true);

    try {
      const query = employeeId ? `?employeeId=${employeeId}` : '';
      const response = await fetch(`/api/checkins${query}`);

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as CheckinsResponse;
      setDirectReports(data.directReports);
      setSelectedEmployeeId(data.selectedEmployeeId ?? '');
      setGoals(data.sheet?.goals ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load check-ins.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCheckins();
  }, [loadCheckins]);

  async function addCheckin(goalId: string, values: { quarter: Exclude<Quarter, 'Annual'>; comment: string }) {
    setSavingGoalId(goalId);

    try {
      const response = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId, quarter: values.quarter, comment: values.comment }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      toast.success('Check-in saved.');
      await loadCheckins(selectedEmployeeId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save check-in.');
    } finally {
      setSavingGoalId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="page-shell space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.5px] text-white">Check-ins</h1>
          <p className="text-white/50">Review quarterly progress and add comments for direct reports.</p>
        </div>
        <div className="w-full lg:w-72">
          <Select
            value={selectedEmployeeId}
            onValueChange={(value) => {
              setSelectedEmployeeId(value);
              void loadCheckins(value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select direct report" />
            </SelectTrigger>
            <SelectContent>
              {directReports.map((report) => (
                <SelectItem key={report.id} value={report.id}>
                  {report.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {directReports.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
              <MessageSquare className="h-8 w-8 text-white/50" />
            </div>
            <CardTitle className="mb-2 text-lg">No Direct Reports</CardTitle>
            <CardDescription className="max-w-sm text-center">
              Check-ins appear once employees are assigned to you.
            </CardDescription>
          </CardContent>
        </Card>
      ) : goals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
              <MessageSquare className="h-8 w-8 text-white/50" />
            </div>
            <CardTitle className="mb-2 text-lg">No Approved Goals</CardTitle>
            <CardDescription className="max-w-sm text-center">
              {selectedEmployee?.name ?? 'This employee'} does not have an approved goal sheet yet.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {goals.map((goal) => {
            const latestAchievement = [...goal.achievements].sort((a, b) => b.logged_at.localeCompare(a.logged_at))[0];

            return (
              <Card key={goal.id}>
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{goal.title}</CardTitle>
                        {goal.is_shared && (
                          <Badge variant="outline" className="border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-100">
                            Shared
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        {goal.thrust_area?.name ?? 'Thrust Area'} · {getTargetLabel(goal)}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{getStatusLabel(goal.status)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-md bg-white/[0.04] px-3 py-2 text-sm">
                      <div className="text-white/50">Latest Quarter</div>
                      <div className="font-medium">{latestAchievement?.quarter ?? '-'}</div>
                    </div>
                    <div className="rounded-md bg-white/[0.04] px-3 py-2 text-sm">
                      <div className="text-white/50">Actual</div>
                      <div className="font-medium">{latestAchievement?.actual_value ?? latestAchievement?.actual_date ?? '-'}</div>
                    </div>
                    <div className="rounded-md bg-white/[0.04] px-3 py-2 text-sm">
                      <div className="text-white/50">Score</div>
                      <div className="font-medium">{formatScore(latestAchievement?.progress_score)}</div>
                    </div>
                  </div>

                  <CheckinForm
                    isSubmitting={savingGoalId === goal.id}
                    defaultQuarter={(latestAchievement?.quarter as Exclude<Quarter, 'Annual'> | undefined) ?? 'Q1'}
                    onSubmit={(values) => addCheckin(goal.id, values)}
                  />
                  <CheckinHistory checkins={[...goal.checkins].sort((a, b) => b.created_at.localeCompare(a.created_at))} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
