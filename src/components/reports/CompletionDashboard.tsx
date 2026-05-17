'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardCheck, MessageSquareCheck, TrendingUp } from 'lucide-react';

export interface CompletionStats {
  submittedRate: number;
  q1AchievementRate: number;
  managerCheckinRate: number;
}

interface CompletionDashboardProps {
  stats: CompletionStats;
}

function formatRate(value: number) {
  return `${Math.round(value)}%`;
}

export function CompletionDashboard({ stats }: CompletionDashboardProps) {
  const cards = [
    {
      title: 'Employees Submitted',
      value: formatRate(stats.submittedRate),
      helper: 'FY 2025-26 goal sheets',
      icon: ClipboardCheck,
      iconClass: 'text-emerald-600',
    },
    {
      title: 'Q1 Achievements',
      value: formatRate(stats.q1AchievementRate),
      helper: 'approved employees with Q1 logs',
      icon: TrendingUp,
      iconClass: 'text-blue-600',
    },
    {
      title: 'Manager Check-ins',
      value: formatRate(stats.managerCheckinRate),
      helper: 'managers with current quarter comments',
      icon: MessageSquareCheck,
      iconClass: 'text-amber-600',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.iconClass}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{card.value}</div>
            <p className="mt-1 text-xs text-muted-foreground">{card.helper}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
