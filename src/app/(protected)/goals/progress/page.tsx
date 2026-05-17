'use client';

import { useProfile } from '@/components/profile-provider';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProgressPage() {
  const { isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Progress</h1>
        <p className="text-muted-foreground">
          Track your quarterly achievements and progress scores.
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <BarChart3 className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg mb-2">No Progress Data</CardTitle>
          <CardDescription className="text-center max-w-sm">
            Progress tracking will be available once you have approved goals with quarterly achievements.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
