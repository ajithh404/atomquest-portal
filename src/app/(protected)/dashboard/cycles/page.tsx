'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Profile, QuarterlyWindow } from '@/lib/types';
import { CalendarDays } from 'lucide-react';

interface AdminResponse {
  windows: QuarterlyWindow[];
  profiles: Profile[];
}

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? 'Request failed.';
}

export default function CyclesPage() {
  const [windows, setWindows] = useState<QuarterlyWindow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadWindows = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin');

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as AdminResponse;
      setWindows(data.windows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load quarterly windows.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWindows();
  }, [loadWindows]);

  async function toggleWindow(windowRow: QuarterlyWindow) {
    setBusyId(windowRow.id);

    try {
      const response = await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateWindow',
          windowId: windowRow.id,
          isOpen: !windowRow.is_open,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      toast.success(`${windowRow.quarter} window ${windowRow.is_open ? 'closed' : 'opened'}.`);
      await loadWindows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update window.');
    } finally {
      setBusyId(null);
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
        <h1 className="text-[28px] font-bold tracking-[-0.5px] text-white">Cycle Management</h1>
        <p className="text-white/50">Open and close quarterly achievement windows.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>FY 2025-26 Quarterly Windows</CardTitle>
          <CardDescription>Employees can log achievements only for open quarters.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {windows.map((windowRow) => (
            <div
              key={windowRow.id}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/[0.06]">
                  <CalendarDays className="h-5 w-5 text-white/50" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{windowRow.quarter}</h3>
                    <Badge variant={windowRow.is_open ? 'default' : 'secondary'}>
                      {windowRow.is_open ? 'Open' : 'Closed'}
                    </Badge>
                  </div>
                  <p className="text-sm text-white/50">
                    {new Date(windowRow.start_date).toLocaleDateString()} - {new Date(windowRow.end_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button
                variant={windowRow.is_open ? 'outline' : 'default'}
                onClick={() => toggleWindow(windowRow)}
                disabled={busyId === windowRow.id}
              >
                {busyId === windowRow.id ? 'Updating...' : windowRow.is_open ? 'Close Window' : 'Open Window'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
