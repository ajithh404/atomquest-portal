'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatScore } from '@/lib/scoring';
import type { GoalStatus, GoalWithAchievements, Quarter, QuarterlyWindow } from '@/lib/types';
import { BarChart3, Lock, Save } from 'lucide-react';

const quarters: Exclude<Quarter, 'Annual'>[] = ['Q1', 'Q2', 'Q3', 'Q4'];

interface AchievementsResponse {
  goals: GoalWithAchievements[];
  windows: QuarterlyWindow[];
}

interface EntryState {
  actualValue: string;
  actualDate: string;
  status: GoalStatus;
  notes: string;
}

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? 'Request failed.';
}

function getEntryKey(goalId: string, quarter: Quarter) {
  return `${goalId}:${quarter}`;
}

function getScoreClass(score: number | null | undefined) {
  if (score === null || score === undefined) {
    return 'text-white/50';
  }

  if (score >= 0.8) {
    return 'text-emerald-700';
  }

  if (score >= 0.5) {
    return 'text-amber-700';
  }

  return 'text-destructive';
}

function getTargetLabel(goal: GoalWithAchievements) {
  if (goal.uom_type === 'timeline') {
    return goal.target_date ? `By ${new Date(goal.target_date).toLocaleDateString()}` : 'Timeline target';
  }

  if (goal.uom_type === 'zero') {
    return 'Zero target';
  }

  return `${goal.uom_type === 'min' ? 'At least' : 'At most'} ${goal.target_value ?? '-'}`;
}

export default function ProgressPage() {
  const [goals, setGoals] = useState<GoalWithAchievements[]>([]);
  const [windows, setWindows] = useState<QuarterlyWindow[]>([]);
  const [entries, setEntries] = useState<Record<string, EntryState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const windowByQuarter = useMemo(
    () => new Map(windows.map((windowRow) => [windowRow.quarter, windowRow])),
    [windows]
  );

  const buildEntries = useCallback((loadedGoals: GoalWithAchievements[]) => {
    const nextEntries: Record<string, EntryState> = {};

    for (const goal of loadedGoals) {
      for (const quarter of quarters) {
        const achievement = goal.achievements.find((item) => item.quarter === quarter);
        nextEntries[getEntryKey(goal.id, quarter)] = {
          actualValue: achievement?.actual_value === null || achievement?.actual_value === undefined ? '' : String(achievement.actual_value),
          actualDate: achievement?.actual_date ?? '',
          status: goal.status,
          notes: achievement?.notes ?? '',
        };
      }
    }

    setEntries(nextEntries);
  }, []);

  const loadAchievements = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/achievements');

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as AchievementsResponse;
      setGoals(data.goals);
      setWindows(data.windows);
      buildEntries(data.goals);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load progress.');
    } finally {
      setIsLoading(false);
    }
  }, [buildEntries]);

  useEffect(() => {
    void loadAchievements();
  }, [loadAchievements]);

  function updateEntry(goalId: string, quarter: Quarter, patch: Partial<EntryState>) {
    const key = getEntryKey(goalId, quarter);
    setEntries((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...patch,
      },
    }));
  }

  async function saveAchievement(goal: GoalWithAchievements, quarter: Exclude<Quarter, 'Annual'>) {
    const key = getEntryKey(goal.id, quarter);
    const entry = entries[key];

    if (!entry) {
      return;
    }

    setSavingKey(key);

    try {
      const response = await fetch('/api/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId: goal.id,
          quarter,
          actualValue: goal.uom_type === 'timeline' ? null : Number(entry.actualValue),
          actualDate: entry.actualDate,
          status: entry.status,
          notes: entry.notes || null,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      toast.success('Achievement saved.');
      await loadAchievements();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save achievement.');
    } finally {
      setSavingKey(null);
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
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.5px] text-white">My Progress</h1>
        <p className="text-white/50">Track quarterly achievements against approved goals.</p>
      </div>

      {goals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
              <BarChart3 className="h-8 w-8 text-white/50" />
            </div>
            <CardTitle className="mb-2 text-lg">No Approved Goals</CardTitle>
            <CardDescription className="max-w-sm text-center">
              Progress tracking appears after your goal sheet is approved.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="page-shell space-y-6">
          {quarters.map((quarter) => {
            const windowRow = windowByQuarter.get(quarter);
            const isOpen = Boolean(windowRow?.is_open);

            return (
              <Card key={quarter}>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>{quarter}</CardTitle>
                    <CardDescription>
                      {windowRow
                        ? `${new Date(windowRow.start_date).toLocaleDateString()} - ${new Date(windowRow.end_date).toLocaleDateString()}`
                        : 'Window not configured'}
                    </CardDescription>
                  </div>
                  <Badge variant={isOpen ? 'default' : 'secondary'}>
                    {isOpen ? 'Open' : 'Window closed'}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  {goals.map((goal) => {
                    const achievement = goal.achievements.find((item) => item.quarter === quarter);
                    const key = getEntryKey(goal.id, quarter);
                    const entry = entries[key];

                    return (
                      <div key={goal.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-medium">{goal.title}</h3>
                              {goal.is_shared && <Badge variant="outline">Shared</Badge>}
                            </div>
                            <p className="text-sm text-white/50">
                              {goal.thrust_area?.name ?? 'Thrust Area'} · {getTargetLabel(goal)}
                            </p>
                          </div>
                          <div className={`text-sm font-semibold ${getScoreClass(achievement?.progress_score)}`}>
                            Score {formatScore(achievement?.progress_score)}
                          </div>
                        </div>

                        {isOpen && entry ? (
                          <div className="grid gap-4 md:grid-cols-5">
                            {goal.uom_type !== 'timeline' && (
                              <div className="grid gap-2">
                                <Label htmlFor={`${key}-actual`}>Actual Value</Label>
                                <Input
                                  id={`${key}-actual`}
                                  type="number"
                                  step="0.01"
                                  value={entry.actualValue}
                                  onChange={(event) => updateEntry(goal.id, quarter, { actualValue: event.target.value })}
                                />
                              </div>
                            )}
                            <div className="grid gap-2">
                              <Label htmlFor={`${key}-date`}>Actual Date</Label>
                              <Input
                                id={`${key}-date`}
                                type="date"
                                value={entry.actualDate}
                                onChange={(event) => updateEntry(goal.id, quarter, { actualDate: event.target.value })}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>Status</Label>
                              <Select
                                value={entry.status}
                                onValueChange={(value) => updateEntry(goal.id, quarter, { status: value as GoalStatus })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="not_started">Not started</SelectItem>
                                  <SelectItem value="on_track">On track</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-2 md:col-span-2">
                              <Label htmlFor={`${key}-notes`}>Notes</Label>
                              <Input
                                id={`${key}-notes`}
                                value={entry.notes}
                                onChange={(event) => updateEntry(goal.id, quarter, { notes: event.target.value })}
                                placeholder="Optional context"
                              />
                            </div>
                            <div className="md:col-span-5">
                              <Button onClick={() => saveAchievement(goal, quarter)} disabled={savingKey === key}>
                                <Save className="h-4 w-4" />
                                {savingKey === key ? 'Saving...' : 'Save Achievement'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 rounded-md bg-white/[0.04] px-3 py-2 text-sm text-white/50">
                            <Lock className="h-4 w-4" />
                            Window closed
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
