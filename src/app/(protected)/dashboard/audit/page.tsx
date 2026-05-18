'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';

interface AuditReportRow {
  timestamp: string;
  user: string;
  action: string;
  tableName: string;
  oldValue: string;
  newValue: string;
}

interface ReportsResponse {
  auditRows: AuditReportRow[];
}

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? 'Request failed.';
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadAudit = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/reports');

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as ReportsResponse;
      setRows(data.auditRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load audit log.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const actionNeedle = action.trim().toLowerCase();
    const fromTime = fromDate ? new Date(fromDate).getTime() : null;
    const toTime = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

    return rows.filter((row) => {
      const rowTime = new Date(row.timestamp).getTime();
      const matchesSearch =
        needle.length === 0 ||
        [row.user, row.action, row.tableName, row.oldValue, row.newValue].join(' ').toLowerCase().includes(needle);
      const matchesAction = actionNeedle.length === 0 || row.action.toLowerCase().includes(actionNeedle);
      const matchesFrom = fromTime === null || rowTime >= fromTime;
      const matchesTo = toTime === null || rowTime <= toTime;

      return matchesSearch && matchesAction && matchesFrom && matchesTo;
    });
  }, [action, fromDate, rows, search, toDate]);

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
        <h1 className="text-[28px] font-bold tracking-[-0.5px] text-white">Audit Log</h1>
        <p className="text-white/50">Track post-lock changes and admin actions.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
          <CardDescription>Search by user, date range, action, table, or JSON values.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search audit log" />
            <Input value={action} onChange={(event) => setAction(event.target.value)} placeholder="Action type" />
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>

          {filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] border-dashed py-16 text-center">
              <Search className="mb-3 h-8 w-8 text-white/50" />
              <p className="font-medium">No audit events found</p>
              <p className="text-sm text-white/50">Audit rows appear after admin governance actions.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03]">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-white/[0.04] text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Timestamp</th>
                    <th className="px-3 py-2 font-medium">User</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Table</th>
                    <th className="px-3 py-2 font-medium">Old Value</th>
                    <th className="px-3 py-2 font-medium">New Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => (
                    <tr key={`${row.timestamp}-${row.action}-${index}`} className="border-t align-top">
                      <td className="px-3 py-2">{new Date(row.timestamp).toLocaleString()}</td>
                      <td className="px-3 py-2">{row.user}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{row.action}</Badge>
                      </td>
                      <td className="px-3 py-2">{row.tableName}</td>
                      <td className="max-w-xs truncate px-3 py-2" title={row.oldValue}>
                        {row.oldValue}
                      </td>
                      <td className="max-w-xs truncate px-3 py-2" title={row.newValue}>
                        {row.newValue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
