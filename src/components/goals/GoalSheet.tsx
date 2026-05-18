'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { GoalCard } from '@/components/goals/GoalCard';
import { GoalForm, type GoalFormValues } from '@/components/goals/GoalForm';
import type { Goal, GoalSheetWithGoals, ThrustArea } from '@/lib/types';
import {
  calculateTotalWeightage,
  canEditSheet,
  getSubmitBlockReason,
  REQUIRED_TOTAL_WEIGHTAGE,
} from '@/lib/validations';
import { AlertCircle, CheckCircle2, ClipboardList, Plus } from 'lucide-react';

interface GoalSheetProps {
  sheet: GoalSheetWithGoals;
  thrustAreas: ThrustArea[];
  isBusy?: boolean;
  onCreateGoal: (values: GoalFormValues) => Promise<void>;
  onUpdateGoal: (goal: Goal, values: GoalFormValues) => Promise<void>;
  onDeleteGoal: (goal: Goal) => Promise<void>;
  onSubmitSheet: () => Promise<void>;
}

function getSheetStatusLabel(status: GoalSheetWithGoals['status']): string {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'submitted':
      return 'Submitted';
    case 'returned':
      return 'Returned';
    default:
      return 'Draft';
  }
}

function getSheetStatusVariant(status: GoalSheetWithGoals['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'approved':
      return 'default';
    case 'submitted':
      return 'secondary';
    case 'returned':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function GoalSheet({
  sheet,
  thrustAreas,
  isBusy = false,
  onCreateGoal,
  onUpdateGoal,
  onDeleteGoal,
  onSubmitSheet,
}: GoalSheetProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [isSubmittingSheet, setIsSubmittingSheet] = useState(false);
  const editable = canEditSheet(sheet.status);
  const totalWeightage = calculateTotalWeightage(sheet.goals);
  const submitBlockReason = useMemo(() => getSubmitBlockReason(sheet.goals), [sheet.goals]);
  const isTotalValid = totalWeightage === REQUIRED_TOTAL_WEIGHTAGE;

  function openCreateDialog() {
    setEditingGoal(undefined);
    setFormError(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(goal: Goal) {
    setEditingGoal(goal);
    setFormError(null);
    setIsDialogOpen(true);
  }

  async function handleSaveGoal(values: GoalFormValues) {
    setIsSavingGoal(true);
    setFormError(null);

    try {
      if (editingGoal) {
        await onUpdateGoal(editingGoal, values);
      } else {
        await onCreateGoal(values);
      }

      setIsDialogOpen(false);
      setEditingGoal(undefined);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save goal.');
    } finally {
      setIsSavingGoal(false);
    }
  }

  async function handleSubmitSheet() {
    setIsSubmittingSheet(true);

    try {
      await onSubmitSheet();
    } finally {
      setIsSubmittingSheet(false);
    }
  }

  async function handleDeleteGoal(goal: Goal) {
    const confirmed = window.confirm(`Delete "${goal.title}" from this sheet?`);

    if (confirmed) {
      await onDeleteGoal(goal);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>FY 2025-26 Goal Sheet</CardTitle>
              <Badge variant={getSheetStatusVariant(sheet.status)}>{getSheetStatusLabel(sheet.status)}</Badge>
            </div>
            <CardDescription>
              {sheet.goals.length} goals configured for this cycle.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {editable && (
              <Button type="button" variant="outline" onClick={openCreateDialog} disabled={isBusy}>
                <Plus className="h-4 w-4" />
                Add Goal
              </Button>
            )}
            {editable && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        type="button"
                        className="btn-accent"
                        disabled={Boolean(submitBlockReason) || isSubmittingSheet || isBusy}
                        onClick={handleSubmitSheet}
                      >
                        {isSubmittingSheet ? 'Submitting...' : sheet.status === 'returned' ? 'Resubmit Sheet' : 'Submit Sheet'}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {submitBlockReason && <TooltipContent>{submitBlockReason}</TooltipContent>}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {sheet.return_comment && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <span className="font-medium">Manager return comment:</span> {sheet.return_comment}
            </div>
          )}

          <div
            className={`flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
              isTotalValid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-destructive/30 bg-destructive/10 text-destructive'
            }`}
          >
            <div className="flex items-center gap-2">
              {isTotalValid ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <span className="font-medium">Total weightage: {totalWeightage}%</span>
            </div>
            <span className="text-sm">Target total must be {REQUIRED_TOTAL_WEIGHTAGE}%.</span>
          </div>
        </CardContent>
      </Card>

      {sheet.goals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <ClipboardList className="h-7 w-7 text-muted-foreground" />
            </div>
            <CardTitle className="mb-2 text-lg">No Goals Added</CardTitle>
            <CardDescription className="max-w-sm">
              Add goals one by one, assign thrust areas, and balance weightage to exactly 100%.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <>
          {!editable && (
            <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {sheet.status === 'approved'
                ? 'This goal sheet is approved and locked. Ask an admin to unlock it for corrections.'
                : 'This goal sheet has been submitted for review and cannot be edited right now.'}
            </div>
          )}
          <div className="grid gap-4">
            {sheet.goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                canEdit={editable}
                canDelete={editable}
                onEdit={openEditDialog}
                onDelete={handleDeleteGoal}
              />
            ))}
          </div>
        </>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGoal ? 'Edit Goal' : 'Add Goal'}</DialogTitle>
            <DialogDescription>
              {editingGoal?.is_shared
                ? 'Only weightage can be changed for shared goals.'
                : 'Define the target, measurement type, and weightage for this goal.'}
            </DialogDescription>
          </DialogHeader>
          <GoalForm
            thrustAreas={thrustAreas}
            initialGoal={editingGoal}
            isSubmitting={isSavingGoal}
            serverError={formError}
            sharedFieldsReadOnly={Boolean(editingGoal?.is_shared)}
            submitLabel={editingGoal ? 'Save Changes' : 'Add Goal'}
            onSubmit={handleSaveGoal}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
