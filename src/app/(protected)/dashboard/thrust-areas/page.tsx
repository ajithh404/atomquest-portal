'use client';

import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Crosshair } from 'lucide-react';

export default function ThrustAreasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Thrust Areas</h1>
        <p className="text-muted-foreground">Configure goal categories for the organization.</p>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Crosshair className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg mb-2">Thrust Area Configuration</CardTitle>
          <CardDescription className="text-center max-w-sm">
            Add, edit, or deactivate thrust areas that employees can select when creating goals.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
