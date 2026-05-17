'use client';

import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Achievement reports and export tools.</p>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg mb-2">Reports & Exports</CardTitle>
          <CardDescription className="text-center max-w-sm">
            Generate achievement reports and export data in CSV or Excel format.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
