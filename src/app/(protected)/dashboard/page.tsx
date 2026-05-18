'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  MessageSquareWarning,
  TrendingUp,
  Users,
} from 'lucide-react';

interface DashboardStats {
  totalEmployees: number;
  sheetsSubmitted: number;
  sheetsApproved: number;
  q1CompletionRate: number;
  pendingCheckins: number;
  openWindows: number;
  submittedRate: number;
  managerCheckinRate: number;
}

interface DepartmentAggregate {
  department: string;
  completionRate: number;
  averageScore: number;
}

interface QuarterTrend {
  quarter: string;
  averageScore: number;
}

interface ThrustAreaDistribution {
  name: string;
  count: number;
  percentage: number;
}

interface UomDistribution {
  type: string;
  label: string;
  count: number;
}

interface ManagerEffectivenessRow {
  managerName: string;
  directReports: number;
  sheetsApproved: number;
  avgDaysToApprove: number;
  checkinCompletionRate: number;
}

interface ReportsResponse {
  dashboardStats: DashboardStats;
  departmentAggregates: DepartmentAggregate[];
  quarterTrends: QuarterTrend[];
  thrustAreaDistribution: ThrustAreaDistribution[];
  uomDistribution: UomDistribution[];
  managerEffectiveness: ManagerEffectivenessRow[];
  currentQuarter: string;
}

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? 'Request failed.';
}

function formatTooltipPercent(value: unknown, label: string): [string, string] {
  const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
  return [`${numericValue}%`, label];
}

function formatTooltipCount(value: unknown, label: string): [string, string] {
  const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
  return [String(numericValue), label];
}

function renderPieLabel(entry: unknown) {
  const item = entry as { name?: string; percentage?: number };
  return `${item.name ?? 'Area'} ${item.percentage ?? 0}%`;
}

function completionClassName(value: number) {
  if (value >= 80) {
    return 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300';
  }

  if (value >= 50) {
    return 'border-amber-400/50 bg-amber-500/15 text-amber-300';
  }

  return 'border-red-400/50 bg-red-500/15 text-red-300';
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [departmentAggregates, setDepartmentAggregates] = useState<DepartmentAggregate[]>([]);
  const [quarterTrends, setQuarterTrends] = useState<QuarterTrend[]>([]);
  const [thrustAreaDistribution, setThrustAreaDistribution] = useState<ThrustAreaDistribution[]>([]);
  const [uomDistribution, setUomDistribution] = useState<UomDistribution[]>([]);
  const [managerEffectiveness, setManagerEffectiveness] = useState<ManagerEffectivenessRow[]>([]);
  const [currentQuarter, setCurrentQuarter] = useState('Q1');
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/reports');

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as ReportsResponse;
      setStats(data.dashboardStats);
      setDepartmentAggregates(data.departmentAggregates);
      setQuarterTrends(data.quarterTrends);
      setThrustAreaDistribution(data.thrustAreaDistribution);
      setUomDistribution(data.uomDistribution);
      setManagerEffectiveness(data.managerEffectiveness);
      setCurrentQuarter(data.currentQuarter);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (isLoading || !stats) {
    return (
      <div className="page-shell space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Employees',
      value: stats.totalEmployees,
      helper: 'employee profiles',
      icon: Users,
      className: 'text-emerald-400',
    },
    {
      title: 'Sheets Submitted',
      value: stats.sheetsSubmitted,
      helper: `${stats.submittedRate}% of employees`,
      icon: ClipboardCheck,
      className: 'text-emerald-400',
    },
    {
      title: 'Sheets Approved',
      value: stats.sheetsApproved,
      helper: 'approved this cycle',
      icon: LayoutDashboard,
      className: 'text-emerald-400',
    },
    {
      title: 'Q1 Completion %',
      value: `${stats.q1CompletionRate}%`,
      helper: 'employees with Q1 logs',
      icon: TrendingUp,
      className: 'text-amber-400',
    },
    {
      title: 'Pending Check-ins',
      value: stats.pendingCheckins,
      helper: `${currentQuarter} manager comments`,
      icon: MessageSquareWarning,
      className: 'text-red-400',
    },
    {
      title: 'Open Windows',
      value: stats.openWindows,
      helper: 'achievement windows',
      icon: CalendarDays,
      className: 'text-emerald-400',
    },
  ];
  const chartColors = ['#10B981', '#059669', '#14B8A6', '#2DD4BF', '#34D399', '#0F766E'];

  return (
    <div className="page-shell space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.5px] text-white">Admin Dashboard</h1>
          <p className="text-white/50">Organization-wide goal tracking and governance overview.</p>
        </div>
        <Badge>Admin</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-white/50">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.className}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
              <p className="mt-1 text-xs text-white/50">{card.helper}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>QoQ Progress Trend</CardTitle>
            <CardDescription>Average progress score by quarter.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={quarterTrends} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="quarter" tick={{ fill: 'var(--foreground)' }} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--foreground)' }} tickFormatter={(value: number) => `${value}%`} />
                <Tooltip formatter={(value) => formatTooltipPercent(value, 'Average score')} />
                <Line
                  type="monotone"
                  dataKey="averageScore"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#10B981' }}
                  isAnimationActive
                  animationDuration={900}
                  animationEasing="ease-out"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.6))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completion By Department</CardTitle>
            <CardDescription>Achievement completion rate by department.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentAggregates} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="department" tick={{ fill: 'var(--foreground)' }} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--foreground)' }} tickFormatter={(value: number) => `${value}%`} />
                <Tooltip formatter={(value) => formatTooltipPercent(value, 'Completion rate')} />
                <Bar dataKey="completionRate" fill="#059669" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Goal Distribution By Thrust Area</CardTitle>
            <CardDescription>Share of active cycle goals across strategic thrust areas.</CardDescription>
          </CardHeader>
          <CardContent className="h-96">
            {thrustAreaDistribution.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <p className="font-semibold text-white">No goals to chart yet</p>
                <p className="mt-1 text-sm text-white/45">Create or approve goal sheets to populate this distribution.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(value) => formatTooltipCount(value, 'Goals')} />
                  <Pie
                    data={thrustAreaDistribution}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={104}
                    paddingAngle={2}
                    labelLine={false}
                    label={renderPieLabel}
                    isAnimationActive
                    animationDuration={900}
                    animationEasing="ease-out"
                  >
                    {thrustAreaDistribution.map((entry, index) => (
                      <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Goal Distribution By UoM Type</CardTitle>
            <CardDescription>How teams define measurable success across goal formats.</CardDescription>
          </CardHeader>
          <CardContent className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={uomDistribution} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--foreground)' }} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--foreground)' }} />
                <Tooltip formatter={(value) => formatTooltipCount(value, 'Goals')} />
                <Bar dataKey="count" fill="#10B981" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manager Effectiveness</CardTitle>
          <CardDescription>Approval velocity and check-in completion for direct-report teams.</CardDescription>
        </CardHeader>
        <CardContent>
          {managerEffectiveness.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center">
              <h3 className="text-base font-semibold text-white">No manager data yet</h3>
              <p className="mt-1 text-sm text-white/45">Assign employees to managers to populate this governance view.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-white/[0.04] text-[11px] uppercase tracking-wider text-white/45">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Manager Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Direct Reports</th>
                    <th className="px-4 py-3 text-left font-semibold">Sheets Approved</th>
                    <th className="px-4 py-3 text-left font-semibold">Avg Days To Approve</th>
                    <th className="px-4 py-3 text-left font-semibold">Check-in Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {managerEffectiveness.map((manager) => (
                    <tr key={manager.managerName} className="border-t border-white/10 transition hover:bg-emerald-500/[0.08]">
                      <td className="px-4 py-3 font-medium text-white">{manager.managerName}</td>
                      <td className="px-4 py-3 text-white/60">{manager.directReports}</td>
                      <td className="px-4 py-3 text-white/60">{manager.sheetsApproved}</td>
                      <td className="px-4 py-3 text-white/60">{manager.avgDaysToApprove}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${completionClassName(manager.checkinCompletionRate)}`}>
                          {manager.checkinCompletionRate}%
                        </span>
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
