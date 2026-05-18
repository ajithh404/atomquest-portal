'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { Profile, QuarterlyWindow } from '@/lib/types';
import { Building2 } from 'lucide-react';

interface AdminResponse {
  windows: QuarterlyWindow[];
  profiles: Profile[];
}

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? 'Request failed.';
}

export default function OrgPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);

  const managers = useMemo(
    () => profiles.filter((profile) => profile.role === 'manager' || profile.role === 'admin'),
    [profiles]
  );

  const loadProfiles = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin');

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as AdminResponse;
      setProfiles(data.profiles);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load organization.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  async function reassignManager(profileId: string, managerId: string) {
    setBusyProfileId(profileId);

    try {
      const response = await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reassignManager',
          profileId,
          managerId: managerId === 'none' ? null : managerId,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      toast.success('Manager assignment updated.');
      await loadProfiles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update manager.');
    } finally {
      setBusyProfileId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="page-shell space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6">
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.5px] text-white">Organization</h1>
        <p className="text-white/50">Manage reporting structure and manager assignments.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>People</CardTitle>
          <CardDescription>Assign employees to managers for team workflows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {profiles.map((profile) => {
            const currentManager = profiles.find((item) => item.id === profile.manager_id);

            return (
              <div
                key={profile.id}
                className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-[1fr_260px]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/[0.06]">
                    <Building2 className="h-5 w-5 text-white/50" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{profile.name}</h3>
                      <Badge variant={profile.role === 'admin' ? 'default' : profile.role === 'manager' ? 'secondary' : 'outline'}>
                        {profile.role}
                      </Badge>
                    </div>
                    <p className="text-sm text-white/50">
                      {profile.email} · {profile.department ?? 'No department'} · Manager: {currentManager?.name ?? 'None'}
                    </p>
                  </div>
                </div>
                <Select
                  value={profile.manager_id ?? 'none'}
                  onValueChange={(value) => reassignManager(profile.id, value)}
                  disabled={busyProfileId === profile.id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Assign manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No manager</SelectItem>
                    {managers
                      .filter((manager) => manager.id !== profile.id)
                      .map((manager) => (
                        <SelectItem key={manager.id} value={manager.id}>
                          {manager.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
