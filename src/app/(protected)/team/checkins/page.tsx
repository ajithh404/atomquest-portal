'use client';

import { useProfile } from '@/components/profile-provider';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function CheckinsPage() {
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
        <h1 className="text-2xl font-bold tracking-tight">Check-ins</h1>
        <p className="text-muted-foreground">
          Review quarterly progress and add comments for your direct reports.
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg mb-2">No Check-ins Yet</CardTitle>
          <CardDescription className="text-center max-w-sm">
            Quarterly check-ins will be available once your team has approved goals and started logging achievements.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
