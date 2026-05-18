'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BellRing, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type EscalationRuleName = 'Overdue Submission' | 'Pending Approval' | 'Missing Check-in';

interface EscalationItem {
  id: string;
  ruleName: EscalationRuleName;
  employeeId: string;
  employeeName: string;
  department: string;
  daysOverdue: number;
  targetUserId: string;
  targetUserName: string;
  targetEmail: string;
  notes: string;
}

interface EscalationLogRow {
  id: string;
  rule_name: EscalationRuleName;
  sent_at: string;
  notes: string | null;
  target: {
    name: string;
    email: string;
    role: string;
  } | null;
  sender: {
    name: string;
    email: string;
    role: string;
  } | null;
}

interface EscalationsResponse {
  sections: {
    overdueSubmission: EscalationItem[];
    pendingApproval: EscalationItem[];
    missingCheckin: EscalationItem[];
  };
  logs: EscalationLogRow[];
  currentQuarter: string | null;
}

const sectionConfig: {
  key: keyof EscalationsResponse['sections'];
  title: EscalationRuleName;
  description: string;
}[] = [
  {
    key: 'overdueSubmission',
    title: 'Overdue Submission',
    description: 'Employees who have not submitted goals after the open window grace period.',
  },
  {
    key: 'pendingApproval',
    title: 'Pending Approval',
    description: 'Submitted goal sheets waiting on manager approval for more than three days.',
  },
  {
    key: 'missingCheckin',
    title: 'Missing Check-in',
    description: 'Approved employees with no achievement activity in the open quarter.',
  },
];

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? 'Request failed.';
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function pluralizeDays(value: number) {
  return `${value} day${value === 1 ? '' : 's'}`;
}

export default function EscalationsPage() {
  const [data, setData] = useState<EscalationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sentRows, setSentRows] = useState<Set<string>>(new Set());

  const loadEscalations = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/escalations');

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      setData((await response.json()) as EscalationsResponse);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load escalations.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEscalations();
  }, [loadEscalations]);

  async function sendReminder(item: EscalationItem) {
    setSentRows((current) => new Set(current).add(item.id));

    try {
      const response = await fetch('/api/admin/escalations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleName: item.ruleName,
          targetUserId: item.targetUserId,
          notes: item.notes,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      toast.success(`Reminder queued for ${item.targetUserName}.`);
      await loadEscalations();
    } catch (error) {
      setSentRows((current) => {
        const nextRows = new Set(current);
        nextRows.delete(item.id);
        return nextRows;
      });
      toast.error(error instanceof Error ? error.message : 'Unable to send reminder.');
    }
  }

  if (isLoading) {
    return (
      <div className="page-shell space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
        <div className="grid gap-4">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.5px] text-white">Escalations</h1>
          <p className="text-sm text-white/50">
            Monitor overdue submissions, stale approvals, and missing activity for FY2025-26.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadEscalations()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {data ? (
        <>
          <div className="grid gap-4">
            {sectionConfig.map((section) => {
              const items = data.sections[section.key];

              return (
                <Card key={section.key}>
                  <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                        {section.title}
                      </CardTitle>
                      <CardDescription>{section.description}</CardDescription>
                    </div>
                    <Badge className="w-fit">{items.length} flagged</Badge>
                  </CardHeader>
                  <CardContent>
                    {items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 shadow-[0_0_18px_rgba(5,150,105,0.18)]">
                          <BellRing className="h-5 w-5" />
                        </div>
                        <h3 className="text-base font-semibold text-white">No escalations here</h3>
                        <p className="mt-1 max-w-md text-sm text-white/45">
                          This rule has no flagged employees right now. Refresh after new submissions or window changes.
                        </p>
                        <Button variant="outline" onClick={() => void loadEscalations()} className="mt-4">
                          Refresh escalations
                        </Button>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border border-white/10">
                        <table className="w-full min-w-[720px] text-sm">
                          <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wider text-white/45">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold">Employee</th>
                              <th className="px-4 py-3 text-left font-semibold">Department</th>
                              <th className="px-4 py-3 text-left font-semibold">Days overdue</th>
                              <th className="px-4 py-3 text-left font-semibold">Recipient</th>
                              <th className="px-4 py-3 text-right font-semibold">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item) => (
                              <tr key={item.id} className="border-t border-white/10 transition hover:bg-emerald-500/[0.08]">
                                <td className="px-4 py-3 font-medium text-white">{item.employeeName}</td>
                                <td className="px-4 py-3 text-white/55">{item.department}</td>
                                <td className="px-4 py-3 text-white/70">{pluralizeDays(item.daysOverdue)}</td>
                                <td className="px-4 py-3 text-white/55">
                                  {item.targetUserName}
                                  <span className="block text-xs text-white/35">{item.targetEmail}</span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Button
                                    size="sm"
                                    onClick={() => void sendReminder(item)}
                                    disabled={sentRows.has(item.id)}
                                    className="gap-2"
                                  >
                                    <Send className="h-3.5 w-3.5" />
                                    {sentRows.has(item.id) ? 'Sent' : 'Send Reminder'}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Escalation Log</CardTitle>
              <CardDescription>Last 25 reminder attempts sent by admins.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.logs.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center">
                  <h3 className="text-base font-semibold text-white">No reminders sent yet</h3>
                  <p className="mt-1 text-sm text-white/45">Use a Send Reminder button above to create the first log entry.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wider text-white/45">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Timestamp</th>
                        <th className="px-4 py-3 text-left font-semibold">Rule</th>
                        <th className="px-4 py-3 text-left font-semibold">Recipient</th>
                        <th className="px-4 py-3 text-left font-semibold">Sent By</th>
                        <th className="px-4 py-3 text-left font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.logs.map((log) => (
                        <tr key={log.id} className="border-t border-white/10 transition hover:bg-emerald-500/[0.08]">
                          <td className="px-4 py-3 text-white/70">{formatTimestamp(log.sent_at)}</td>
                          <td className="px-4 py-3 font-medium text-white">{log.rule_name}</td>
                          <td className="px-4 py-3 text-white/55">{log.target?.name ?? 'Unknown'}</td>
                          <td className="px-4 py-3 text-white/55">{log.sender?.name ?? 'Unknown'}</td>
                          <td className="px-4 py-3 text-white/45">{log.notes ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-white">Escalations could not be loaded</h3>
            <p className="mt-1 text-sm text-white/45">Check Supabase SQL setup, then refresh this page.</p>
            <Button onClick={() => void loadEscalations()} className="mt-4">
              Try again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
