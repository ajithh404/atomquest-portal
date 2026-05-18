'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Goal } from '@/lib/types';
import { CalendarDays, Copy, Edit3, Share2, Trash2 } from 'lucide-react';

interface GoalCardProps {
  goal: Goal;
  canEdit?: boolean;
  canDelete?: boolean;
  canShare?: boolean;
  onEdit?: (goal: Goal) => void;
  onDelete?: (goal: Goal) => void;
  onShare?: (goal: Goal) => void;
}

function getUomLabel(goal: Goal): string {
  if (goal.uom_type === 'timeline') {
    return goal.target_date ? `By ${new Date(goal.target_date).toLocaleDateString()}` : 'Timeline target';
  }

  if (goal.uom_type === 'zero') {
    return 'Zero tolerance';
  }

  return `${goal.uom_type === 'min' ? 'At least' : 'At most'} ${goal.target_value ?? '-'}`;
}

function getStatusLabel(status: Goal['status']): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'on_track':
      return 'On track';
    default:
      return 'Not started';
  }
}

function getUpdatedLabel(updatedAt: string): string {
  const updatedDate = new Date(updatedAt);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfUpdatedDate = new Date(
    updatedDate.getFullYear(),
    updatedDate.getMonth(),
    updatedDate.getDate()
  ).getTime();
  const daysAgo = Math.floor((startOfToday - startOfUpdatedDate) / (24 * 60 * 60 * 1000));

  if (Number.isNaN(startOfUpdatedDate) || daysAgo <= 0) {
    return 'Updated today';
  }

  if (daysAgo === 1) {
    return 'Updated yesterday';
  }

  return `Updated ${daysAgo} days ago`;
}

export function GoalCard({
  goal,
  canEdit = false,
  canDelete = false,
  canShare = false,
  onEdit,
  onDelete,
  onShare,
}: GoalCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{goal.thrust_area?.name ?? 'Thrust Area'}</Badge>
            <Badge
              variant="outline"
              className={
                goal.is_shared
                  ? 'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900 dark:text-blue-100'
                  : 'border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900 dark:text-green-100'
              }
            >
              {goal.is_shared ? 'Shared' : 'Owned'}
            </Badge>
            <Badge variant="outline" className="border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
              {goal.weightage}%
            </Badge>
          </div>
          <CardTitle className="text-base leading-tight">{goal.title}</CardTitle>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canShare && (
            <Button type="button" size="icon" variant="ghost" onClick={() => onShare?.(goal)} aria-label="Share goal">
              <Share2 className="h-4 w-4" />
            </Button>
          )}
          {canEdit && (
            <Button type="button" size="icon" variant="ghost" onClick={() => onEdit?.(goal)} aria-label="Edit goal">
              <Edit3 className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button type="button" size="icon" variant="ghost" onClick={() => onDelete?.(goal)} aria-label="Delete goal">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {goal.description && <p className="text-sm text-white/50">{goal.description}</p>}
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded-md bg-white/[0.04] px-3 py-2">
            <CalendarDays className="h-4 w-4 text-white/50" />
            <span>{getUomLabel(goal)}</span>
          </div>
          <div className="rounded-md bg-white/[0.04] px-3 py-2">
            <span className="text-white/50">UoM:</span> {goal.uom_type}
          </div>
          <div className="rounded-md bg-white/[0.04] px-3 py-2">
            <span className="text-white/50">Status:</span> {getStatusLabel(goal.status)}
          </div>
        </div>
        {goal.shared_from && (
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Copy className="h-3.5 w-3.5" />
            Linked to source goal
          </div>
        )}
        <div className="border-t border-white/10 pt-2 text-xs text-white/50">
          {getUpdatedLabel(goal.updated_at)}
        </div>
      </CardContent>
    </Card>
  );
}
