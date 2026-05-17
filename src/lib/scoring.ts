import type { UomType } from '@/lib/types';

export interface ScoreInput {
  uomType: UomType;
  targetValue: number | null;
  actualValue: number | null;
  targetDate: string | null;
  actualDate: string | null;
}

function capScore(score: number): number {
  if (!Number.isFinite(score) || score < 0) {
    return 0;
  }

  return Math.min(score, 1);
}

function daysBetween(startDate: Date, endDate: Date): number {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.max(Math.ceil((endDate.getTime() - startDate.getTime()) / millisecondsPerDay), 1);
}

export function calculateProgressScore({
  uomType,
  targetValue,
  actualValue,
  targetDate,
  actualDate,
}: ScoreInput): number {
  if (uomType === 'zero') {
    return actualValue === 0 ? 1 : 0;
  }

  if (uomType === 'timeline') {
    if (!targetDate || !actualDate) {
      return 0;
    }

    const target = new Date(targetDate);
    const actual = new Date(actualDate);

    if (actual.getTime() <= target.getTime()) {
      return 1;
    }

    const yearStart = new Date(target.getFullYear(), 0, 1);
    const total = daysBetween(yearStart, target);
    const late = daysBetween(target, actual);

    return capScore(1 - late / total);
  }

  if (!targetValue || actualValue === null || actualValue === undefined) {
    return 0;
  }

  if (uomType === 'min') {
    return capScore(actualValue / targetValue);
  }

  if (actualValue === 0) {
    return 1;
  }

  return capScore(targetValue / actualValue);
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return '-';
  }

  return `${Math.round(score * 100)}%`;
}
