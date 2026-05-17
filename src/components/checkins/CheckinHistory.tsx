'use client';

import { Badge } from '@/components/ui/badge';
import type { Checkin } from '@/lib/types';
import { MessageSquare } from 'lucide-react';

interface CheckinHistoryProps {
  checkins: Checkin[];
}

export function CheckinHistory({ checkins }: CheckinHistoryProps) {
  if (checkins.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
        No check-ins recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {checkins.map((checkin) => (
        <div key={checkin.id} className="flex gap-3 rounded-md border p-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{checkin.quarter}</Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(checkin.created_at).toLocaleString()}
              </span>
            </div>
            <p className="text-sm">{checkin.comment}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
