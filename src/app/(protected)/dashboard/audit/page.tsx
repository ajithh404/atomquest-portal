'use client';

import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Search } from 'lucide-react';

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">Track all post-lock changes and admin actions.</p>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg mb-2">Audit Trail</CardTitle>
          <CardDescription className="text-center max-w-sm">
            View a searchable log of all post-approval changes with timestamps, users, and before/after values.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
