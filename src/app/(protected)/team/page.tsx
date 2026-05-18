'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { GoalSheetWithGoals, Profile, ThrustArea } from '@/lib/types';
import { ClipboardCheck, Clock, Eye, UserCheck, Users } from 'lucide-react';

interface TeamGoalsResponse {
  sheets: GoalSheetWithGoals[];
  thrustAreas: ThrustArea[];
  directReports: Profile[];
}

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? 'Request failed.';
}

function getStatusVariant(status: GoalSheetWithGoals['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'approved':
      return 'default';
    case 'returned':
      return 'destructive';
    case 'submitted':
      return 'secondary';
    default:
      return 'outline';
  }
}

export default function TeamPage() {
  const [sheets, setSheets] = useState<GoalSheetWithGoals[]>([]);
  const [directReports, setDirectReports] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTeamGoals = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/goals?scope=team');

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as TeamGoalsResponse;
      setSheets(data.sheets);
      setDirectReports(data.directReports);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load team goal sheets.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTeamGoals();
  }, [loadTeamGoals]);

  const stats = useMemo(() => {
    const submitted = sheets.filter((sheet) => sheet.status === 'submitted').length;
    const approved = sheets.filter((sheet) => sheet.status === 'approved').length;
    const returned = sheets.filter((sheet) => sheet.status === 'returned').length;

    return { submitted, approved, returned };
  }, [sheets]);

  if (isLoading) {
    return (
      <div className="page-shell space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6">
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.5px] text-white">Team Goals</h1>
        <p className="text-white/50">Review and approve goal sheets from your direct reports.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/50">Direct Reports</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{directReports.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/50">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.submitted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/50">Approved</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white/50">Returned</CardTitle>
            <UserCheck className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.returned}</div>
          </CardContent>
        </Card>
      </div>

      {sheets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06]">
              <Users className="h-8 w-8 text-white/50" />
            </div>
            <CardTitle className="mb-2 text-lg">No Submitted Sheets</CardTitle>
            <CardDescription className="max-w-sm text-center">
              Goal sheets submitted by your direct reports will appear here for review and approval.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sheets.map((sheet) => (
            <Card key={sheet.id}>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{sheet.employee?.name ?? 'Employee'}</CardTitle>
                    <Badge variant={getStatusVariant(sheet.status)}>{sheet.status}</Badge>
                  </div>
                  <CardDescription>
                    {sheet.employee?.department ?? 'No department'} · {sheet.goals.length} goals · Submitted{' '}
                    {sheet.submitted_at ? new Date(sheet.submitted_at).toLocaleDateString() : 'not yet'}
                  </CardDescription>
                </div>
                <Button asChild variant="outline">
                  <Link href={`/team/${sheet.id}`}>
                    <Eye className="h-4 w-4" />
                    Review
                  </Link>
                </Button>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
