import type { Goal, GoalSheetStatus } from '@/lib/types';

export const CURRENT_CYCLE_YEAR = 2025;
export const MIN_GOAL_WEIGHTAGE = 10;
export const MAX_GOALS_PER_SHEET = 8;
export const REQUIRED_TOTAL_WEIGHTAGE = 100;

export interface SheetValidationResult {
  isValid: boolean;
  totalWeightage: number;
  errors: string[];
}

export function calculateTotalWeightage(goals: Pick<Goal, 'weightage'>[]): number {
  return goals.reduce((total, goal) => total + Number(goal.weightage || 0), 0);
}

export function validateGoalCount(goals: Pick<Goal, 'id'>[]): string | null {
  if (goals.length > MAX_GOALS_PER_SHEET) {
    return `A goal sheet can have a maximum of ${MAX_GOALS_PER_SHEET} goals.`;
  }

  return null;
}

export function validateGoalWeightages(goals: Pick<Goal, 'weightage' | 'title'>[]): string[] {
  return goals
    .filter((goal) => Number(goal.weightage) < MIN_GOAL_WEIGHTAGE)
    .map((goal) => `${goal.title || 'Each goal'} must have at least ${MIN_GOAL_WEIGHTAGE}% weightage.`);
}

export function validateTotalWeightage(goals: Pick<Goal, 'weightage'>[]): string | null {
  const total = calculateTotalWeightage(goals);

  if (total !== REQUIRED_TOTAL_WEIGHTAGE) {
    return `Total weightage must be exactly ${REQUIRED_TOTAL_WEIGHTAGE}%. Current total is ${total}%.`;
  }

  return null;
}

export function validateGoalSheetForSubmission(
  goals: Pick<Goal, 'id' | 'title' | 'weightage'>[]
): SheetValidationResult {
  const errors: string[] = [];
  const countError = validateGoalCount(goals);
  const totalError = validateTotalWeightage(goals);

  if (goals.length === 0) {
    errors.push('Add at least one goal before submitting the sheet.');
  }

  if (countError) {
    errors.push(countError);
  }

  errors.push(...validateGoalWeightages(goals));

  if (totalError) {
    errors.push(totalError);
  }

  return {
    isValid: errors.length === 0,
    totalWeightage: calculateTotalWeightage(goals),
    errors,
  };
}

export function canEditSheet(status: GoalSheetStatus): boolean {
  return status === 'draft' || status === 'returned';
}

export function canEditApprovedSheet(status: GoalSheetStatus, isAdmin: boolean): boolean {
  return status !== 'approved' || isAdmin;
}

export function canEditGoalField(field: keyof Goal, goal: Pick<Goal, 'is_shared'>): boolean {
  if (!goal.is_shared) {
    return true;
  }

  return field === 'weightage';
}

export function getSubmitBlockReason(goals: Pick<Goal, 'id' | 'title' | 'weightage'>[]): string | null {
  const result = validateGoalSheetForSubmission(goals);
  return result.errors[0] ?? null;
}
