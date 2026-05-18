'use client';

import { useProfile } from '@/components/profile-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { getRoleLabel } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import type { UserRole } from '@/lib/types';

export default function ProfilePage() {
  const { profile, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="page-shell space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!profile) return null;

  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="page-shell space-y-6 max-w-2xl">
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.5px] text-white">Profile</h1>
        <p className="text-white/50">Your account details and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-xl font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl">{profile.name}</CardTitle>
              <CardDescription>{profile.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <dl className="space-y-4">
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-white/50">Role</dt>
              <dd>
                <Badge variant="secondary">{getRoleLabel(profile.role as UserRole)}</Badge>
              </dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-white/50">Department</dt>
              <dd className="text-sm">{profile.department || '—'}</dd>
            </div>
            <Separator />
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-white/50">Member since</dt>
              <dd className="text-sm">
                {new Date(profile.created_at).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
