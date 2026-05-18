'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ExportButton, type ExportColumn } from '@/components/reports/ExportButton';
import { CompletionDashboard, type CompletionStats } from '@/components/reports/CompletionDashboard';
import { FileText } from 'lucide-react';

interface AchievementReportRow extends Record<string, string | number | null> {
  employee: string;
  department: string;
  goalTitle: string;
  thrustArea: string;
  uom: string;
  target: string;
  actual: string;
  score: number | null;
  scoreLabel: string;
  quarter: string;
  status: string;
}

interface ReportsResponse {
  reportRows: AchievementReportRow[];
  dashboardStats: CompletionStats;
}

const columns: ExportColumn<AchievementReportRow>[] = [
  { key: 'employee', label: 'Employee' },
  { key: 'department', label: 'Department' },
  { key: 'goalTitle', label: 'Goal Title' },
  { key: 'thrustArea', label: 'Thrust Area' },
  { key: 'uom', label: 'UoM' },
  { key: 'target', label: 'Target' },
  { key: 'actual', label: 'Actual' },
  { key: 'scoreLabel', label: 'Score' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'status', label: 'Status' },
];

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? 'Request failed.';
}

export default function ReportsPage() {
  const [rows, setRows] = useState<AchievementReportRow[]>([]);
  const [stats, setStats] = useState<CompletionStats>({
    submittedRate: 0,
    q1AchievementRate: 0,
    managerCheckinRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [department, setDepartment] = useState('all');
  const [quarter, setQuarter] = useState('all');
  const [thrustArea, setThrustArea] = useState('all');
  const [search, setSearch] = useState('');

  const loadReports = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/reports');

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as ReportsResponse;
      setRows(data.reportRows);
      setStats(data.dashboardStats);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load reports.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const departments = useMemo(() => Array.from(new Set(rows.map((row) => row.department))).sort(), [rows]);
  const quarters = useMemo(() => Array.from(new Set(rows.map((row) => row.quarter))).sort(), [rows]);
  const thrustAreas = useMemo(() => Array.from(new Set(rows.map((row) => row.thrustArea))).sort(), [rows]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesDepartment = department === 'all' || row.department === department;
      const matchesQuarter = quarter === 'all' || row.quarter === quarter;
      const matchesThrustArea = thrustArea === 'all' || row.thrustArea === thrustArea;
      const matchesSearch =
        needle.length === 0 ||
        [row.employee, row.goalTitle, row.department, row.thrustArea, row.status]
          .join(' ')
          .toLowerCase()
          .includes(needle);

      return matchesDepartment && matchesQuarter && matchesThrustArea && matchesSearch;
    });
  }, [department, quarter, rows, search, thrustArea]);

  if (isLoading) {
    return (
      <div className="page-shell space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.5px] text-white">Reports</h1>
          <p className="text-white/50">Achievement reports and export tools.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton rows={filteredRows} columns={columns} fileName="atomquest-achievement-report" format="csv" />
          <ExportButton rows={filteredRows} columns={columns} fileName="atomquest-achievement-report" format="xlsx" />
        </div>
      </div>

      <CompletionDashboard stats={stats} />

      <Card>
        <CardHeader>
          <CardTitle>Achievement Report</CardTitle>
          <CardDescription>Filter by department, quarter, thrust area, or text search.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search report" />
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={quarter} onValueChange={setQuarter}>
              <SelectTrigger>
                <SelectValue placeholder="Quarter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All quarters</SelectItem>
                {quarters.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={thrustArea} onValueChange={setThrustArea}>
              <SelectTrigger>
                <SelectValue placeholder="Thrust Area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All thrust areas</SelectItem>
                {thrustAreas.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] border-dashed py-16 text-center">
              <FileText className="mb-3 h-8 w-8 text-white/50" />
              <p className="font-medium">No report rows found</p>
              <p className="text-sm text-white/50">Adjust filters or wait for achievements to be logged.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03]">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-white/[0.04] text-left">
                  <tr>
                    {columns.map((column) => (
                      <th key={String(column.key)} className="px-3 py-2 font-medium">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => (
                    <tr key={`${row.employee}-${row.goalTitle}-${row.quarter}-${index}`} className="border-t">
                      {columns.map((column) => (
                        <td key={String(column.key)} className="px-3 py-2">
                          {row[column.key] ?? '-'}
                        </td>
                      ))}
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
