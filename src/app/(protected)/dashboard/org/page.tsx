'use client';

import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Building2 } from 'lucide-react';

export default function OrgPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organization</h1>
        <p className="text-muted-foreground">Manage org hierarchy and reporting structure.</p>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg mb-2">Organization Management</CardTitle>
          <CardDescription className="text-center max-w-sm">
            View and edit the reporting hierarchy. Assign employees to managers and departments.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
