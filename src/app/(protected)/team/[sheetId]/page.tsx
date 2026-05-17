'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { GoalCard } from '@/components/goals/GoalCard';
import { useProfile } from '@/components/profile-provider';
import type { Goal, GoalSheetWithGoals, Profile, ThrustArea } from '@/lib/types';
import { calculateTotalWeightage } from '@/lib/validations';
import { ArrowLeft, CheckCircle2, LockOpen, RotateCcw, Share2, Save } from 'lucide-react';

interface TeamSheetPageProps {
  params: {
    sheetId: string;
  };
}

interface GoalsResponse {
  sheet: GoalSheetWithGoals;
  thrustAreas: ThrustArea[];
  directReports: Profile[];
}

interface ManagerGoalEdit {
  target_value: number | null;
  target_date: string | null;
  weightage: number;
}

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? 'Request failed.';
}

function buildGoalEdits(goals: Goal[]): Record<string, ManagerGoalEdit> {
  return goals.reduce<Record<string, ManagerGoalEdit>>((edits, goal) => {
    edits[goal.id] = {
      target_value: goal.target_value === null || goal.target_value === undefined ? null : Number(goal.target_value),
      target_date: goal.target_date,
      weightage: Number(goal.weightage),
    };
    return edits;
  }, {});
}

export default function TeamSheetPage({ params }: TeamSheetPageProps) {
  const { profile } = useProfile();
  const [sheet, setSheet] = useState<GoalSheetWithGoals | null>(null);
  const [directReports, setDirectReports] = useState<Profile[]>([]);
  const [edits, setEdits] = useState<Record<string, ManagerGoalEdit>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isActionBusy, setIsActionBusy] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnComment, setReturnComment] = useState('');
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [sharingGoal, setSharingGoal] = useState<Goal | null>(null);
  const [shareRecipients, setShareRecipients] = useState<string[]>([]);
  const [shareWeightage, setShareWeightage] = useState(10);

  const loadSheet = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/goals?sheetId=${params.sheetId}`);

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as GoalsResponse;
      setSheet(data.sheet);
      setDirectReports(data.directReports);
      setEdits(buildGoalEdits(data.sheet.goals));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load goal sheet.');
    } finally {
      setIsLoading(false);
    }
  }, [params.sheetId]);

  useEffect(() => {
    void loadSheet();
  }, [loadSheet]);

  const eligibleShareRecipients = useMemo(
    () => directReports.filter((report) => report.id !== sheet?.employee_id),
    [directReports, sheet?.employee_id]
  );

  function updateGoalEdit(goalId: string, patch: Partial<ManagerGoalEdit>) {
    setEdits((current) => ({
      ...current,
      [goalId]: {
        ...current[goalId],
        ...patch,
      },
    }));
  }

  async function saveManagerEdit(goal: Goal) {
    const edit = edits[goal.id];

    if (!edit) {
      return;
    }

    const response = await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'managerUpdateGoal',
        goalId: goal.id,
        target_value: goal.uom_type === 'timeline' || goal.uom_type === 'zero' ? null : edit.target_value,
        target_date: goal.uom_type === 'timeline' ? edit.target_date : null,
        weightage: edit.weightage,
      }),
    });

    if (!response.ok) {
      toast.error(await readApiError(response));
      return;
    }

    toast.success('Goal review edits saved.');
    await loadSheet();
  }

  async function approveSheet() {
    if (!sheet) {
      return;
    }

    setIsActionBusy(true);

    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', sheetId: sheet.id }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      toast.success('Goal sheet approved.');
      await loadSheet();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to approve sheet.');
    } finally {
      setIsActionBusy(false);
    }
  }

  async function returnSheet() {
    if (!sheet) {
      return;
    }

    setIsActionBusy(true);

    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'return', sheetId: sheet.id, returnComment }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      toast.success('Goal sheet returned.');
      setReturnDialogOpen(false);
      setReturnComment('');
      await loadSheet();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to return sheet.');
    } finally {
      setIsActionBusy(false);
    }
  }

  async function shareGoal() {
    if (!sharingGoal) {
      return;
    }

    setIsActionBusy(true);

    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'shareGoal',
          sourceGoalId: sharingGoal.id,
          recipientIds: shareRecipients,
          weightage: shareWeightage,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      toast.success('Goal shared.');
      setSharingGoal(null);
      setShareRecipients([]);
      setShareWeightage(10);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to share goal.');
    } finally {
      setIsActionBusy(false);
    }
  }

  async function unlockSheet() {
    if (!sheet) {
      return;
    }

    setIsActionBusy(true);

    try {
      const response = await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unlockSheet',
          sheetId: sheet.id,
          reason: unlockReason,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      toast.success('Goal sheet unlocked and returned for edits.');
      setUnlockDialogOpen(false);
      setUnlockReason('');
      await loadSheet();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to unlock sheet.');
    } finally {
      setIsActionBusy(false);
    }
  }

  function toggleShareRecipient(profileId: string) {
    setShareRecipients((current) =>
      current.includes(profileId) ? current.filter((id) => id !== profileId) : [...current, profileId]
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-36" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="space-y-6">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/team">
            <ArrowLeft className="h-4 w-4" />
            Back to Team Goals
          </Link>
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Goal sheet could not be loaded.</CardContent>
        </Card>
      </div>
    );
  }

  const canReview = sheet.status === 'submitted';
  const canAdminUnlock = profile?.role === 'admin' && sheet.status === 'approved';
  const totalWeightage = calculateTotalWeightage(sheet.goals);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="px-0">
        <Link href="/team">
          <ArrowLeft className="h-4 w-4" />
          Back to Team Goals
        </Link>
      </Button>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{sheet.employee?.name ?? 'Employee'} Goal Sheet</CardTitle>
              <Badge variant={sheet.status === 'approved' ? 'default' : sheet.status === 'returned' ? 'destructive' : 'secondary'}>
                {sheet.status}
              </Badge>
            </div>
            <CardDescription>
              {sheet.employee?.department ?? 'No department'} · {sheet.goals.length} goals · Total weightage {totalWeightage}%
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile?.role === 'admin' && (
              <Button variant="outline" onClick={() => setUnlockDialogOpen(true)} disabled={!canAdminUnlock || isActionBusy}>
                <LockOpen className="h-4 w-4" />
                Unlock
              </Button>
            )}
            <Button variant="outline" onClick={() => setReturnDialogOpen(true)} disabled={!canReview || isActionBusy}>
              <RotateCcw className="h-4 w-4" />
              Return
            </Button>
            <Button onClick={approveSheet} disabled={!canReview || isActionBusy}>
              <CheckCircle2 className="h-4 w-4" />
              {isActionBusy ? 'Working...' : 'Approve'}
            </Button>
          </div>
        </CardHeader>
        {!canReview && (
          <CardContent>
            <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Review edits are available only while a sheet is submitted.
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-4">
        {sheet.goals.map((goal) => {
          const edit = edits[goal.id];

          return (
            <div key={goal.id} className="space-y-3">
              <GoalCard goal={goal} canShare onShare={setSharingGoal} />
              {canReview && edit && (
                <Card>
                  <CardContent className="grid gap-4 pt-6 md:grid-cols-4">
                    {goal.uom_type !== 'timeline' && goal.uom_type !== 'zero' && (
                      <div className="grid gap-2">
                        <Label htmlFor={`target-value-${goal.id}`}>Target Value</Label>
                        <Input
                          id={`target-value-${goal.id}`}
                          type="number"
                          step="0.01"
                          value={edit.target_value ?? ''}
                          onChange={(event) =>
                            updateGoalEdit(goal.id, {
                              target_value: event.target.value === '' ? null : Number(event.target.value),
                            })
                          }
                        />
                      </div>
                    )}
                    {goal.uom_type === 'timeline' && (
                      <div className="grid gap-2">
                        <Label htmlFor={`target-date-${goal.id}`}>Target Date</Label>
                        <Input
                          id={`target-date-${goal.id}`}
                          type="date"
                          value={edit.target_date ?? ''}
                          onChange={(event) => updateGoalEdit(goal.id, { target_date: event.target.value || null })}
                        />
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label htmlFor={`weightage-${goal.id}`}>Weightage</Label>
                      <Input
                        id={`weightage-${goal.id}`}
                        type="number"
                        min={10}
                        max={100}
                        value={edit.weightage}
                        onChange={(event) => updateGoalEdit(goal.id, { weightage: Number(event.target.value) })}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="outline" onClick={() => saveManagerEdit(goal)}>
                        <Save className="h-4 w-4" />
                        Save Review Edits
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Goal Sheet</DialogTitle>
            <DialogDescription>Tell the employee what needs to change before resubmission.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="return-comment">Return Comment</Label>
            <textarea
              id="return-comment"
              className="min-h-28 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
              value={returnComment}
              onChange={(event) => setReturnComment(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogOpen(false)} disabled={isActionBusy}>
              Cancel
            </Button>
            <Button onClick={returnSheet} disabled={isActionBusy || returnComment.trim().length < 5}>
              Return Sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlock Approved Sheet</DialogTitle>
            <DialogDescription>
              This returns the approved sheet to the employee for edits and writes an audit log entry.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="unlock-reason">Unlock Reason</Label>
            <textarea
              id="unlock-reason"
              className="min-h-28 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
              value={unlockReason}
              onChange={(event) => setUnlockReason(event.target.value)}
              placeholder="Example: Correction requested by HR"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockDialogOpen(false)} disabled={isActionBusy}>
              Cancel
            </Button>
            <Button onClick={unlockSheet} disabled={isActionBusy || unlockReason.trim().length < 5}>
              Unlock Sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(sharingGoal)} onOpenChange={(open) => !open && setSharingGoal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Goal</DialogTitle>
            <DialogDescription>
              Push &quot;{sharingGoal?.title}&quot; to selected employees. Recipients can edit only weightage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="share-weightage">Recipient Weightage</Label>
              <Input
                id="share-weightage"
                type="number"
                min={10}
                max={100}
                value={shareWeightage}
                onChange={(event) => setShareWeightage(Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Recipients</Label>
              {eligibleShareRecipients.length === 0 ? (
                <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  No other eligible employees are available.
                </div>
              ) : (
                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-md border p-3">
                  {eligibleShareRecipients.map((report) => (
                    <label key={report.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={shareRecipients.includes(report.id)}
                        onChange={() => toggleShareRecipient(report.id)}
                      />
                      <span>{report.name}</span>
                      <span className="text-muted-foreground">({report.department ?? 'No department'})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSharingGoal(null)} disabled={isActionBusy}>
              Cancel
            </Button>
            <Button onClick={shareGoal} disabled={isActionBusy || shareRecipients.length === 0}>
              <Share2 className="h-4 w-4" />
              Share Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
