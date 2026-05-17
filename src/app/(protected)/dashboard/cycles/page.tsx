'use client';

import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { CalendarDays } from 'lucide-react';

export default function CyclesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cycle Management</h1>
        <p className="text-muted-foreground">Open and close quarterly achievement windows.</p>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <CalendarDays className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg mb-2">Quarterly Windows</CardTitle>
          <CardDescription className="text-center max-w-sm">
            Manage fiscal year cycles and control when employees can log quarterly achievements.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
