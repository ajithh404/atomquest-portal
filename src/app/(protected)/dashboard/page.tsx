'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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

interface ReportsResponse {
  dashboardStats: DashboardStats;
  departmentAggregates: DepartmentAggregate[];
  quarterTrends: QuarterTrend[];
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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [departmentAggregates, setDepartmentAggregates] = useState<DepartmentAggregate[]>([]);
  const [quarterTrends, setQuarterTrends] = useState<QuarterTrend[]>([]);
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
      <div className="space-y-6">
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
      className: 'text-blue-600',
    },
    {
      title: 'Sheets Submitted',
      value: stats.sheetsSubmitted,
      helper: `${stats.submittedRate}% of employees`,
      icon: ClipboardCheck,
      className: 'text-emerald-600',
    },
    {
      title: 'Sheets Approved',
      value: stats.sheetsApproved,
      helper: 'approved this cycle',
      icon: LayoutDashboard,
      className: 'text-violet-600',
    },
    {
      title: 'Q1 Completion %',
      value: `${stats.q1CompletionRate}%`,
      helper: 'employees with Q1 logs',
      icon: TrendingUp,
      className: 'text-amber-600',
    },
    {
      title: 'Pending Check-ins',
      value: stats.pendingCheckins,
      helper: `${currentQuarter} manager comments`,
      icon: MessageSquareWarning,
      className: 'text-rose-600',
    },
    {
      title: 'Open Windows',
      value: stats.openWindows,
      helper: 'achievement windows',
      icon: CalendarDays,
      className: 'text-cyan-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">Organization-wide goal tracking and governance overview.</p>
        </div>
        <Badge>Admin</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.className}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{card.helper}</p>
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
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="quarter" />
                <YAxis domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} />
                <Tooltip formatter={(value) => formatTooltipPercent(value, 'Average score')} />
                <Line type="monotone" dataKey="averageScore" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
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
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" />
                <YAxis domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} />
                <Tooltip formatter={(value) => formatTooltipPercent(value, 'Completion rate')} />
                <Bar dataKey="completionRate" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
