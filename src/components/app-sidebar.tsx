'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/components/profile-provider';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardList,
  BarChart3,
  Users,
  MessageSquare,
  LayoutDashboard,
  Building2,
  Crosshair,
  CalendarDays,
  FileText,
  Search,
  LogOut,
  ChevronUp,
  User,
  Moon,
  Sun,
  Bell,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import type { GoalSheetStatus, Profile, Quarter, UserRole } from '@/lib/types';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  isUnread?: boolean;
}

interface ActivityGoalSheetRow {
  id: string;
  employee_id: string;
  status: GoalSheetStatus;
  submitted_at: string | null;
  approved_at: string | null;
  return_comment: string | null;
  updated_at: string;
  employee?: Pick<Profile, 'name'> | null;
}

interface ActivityCheckinRow {
  id: string;
  goal_id: string;
  quarter: Quarter;
  manager_id: string;
  created_at: string;
}

interface ActivityWindowRow {
  id: string;
  quarter: Exclude<Quarter, 'Annual'>;
  is_open: boolean;
  created_at: string;
}

const navItems: NavItem[] = [
  // Admin section
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { title: 'Organization', url: '/dashboard/org', icon: Building2, roles: ['admin'] },
  { title: 'Thrust Areas', url: '/dashboard/thrust-areas', icon: Crosshair, roles: ['admin'] },
  { title: 'Cycle Management', url: '/dashboard/cycles', icon: CalendarDays, roles: ['admin'] },
  { title: 'Reports', url: '/dashboard/reports', icon: FileText, roles: ['admin'] },
  { title: 'Audit Log', url: '/dashboard/audit', icon: Search, roles: ['admin'] },
  { title: 'Escalations', url: '/dashboard/escalations', icon: AlertTriangle, roles: ['admin'] },
  // Manager section
  { title: 'Team Goals', url: '/team', icon: Users, roles: ['manager', 'admin'] },
  { title: 'Check-ins', url: '/team/checkins', icon: MessageSquare, roles: ['manager', 'admin'] },
  // Employee section (all roles)
  { title: 'My Goals', url: '/goals', icon: ClipboardList, roles: ['employee', 'manager', 'admin'] },
  { title: 'My Progress', url: '/goals/progress', icon: BarChart3, roles: ['employee', 'manager', 'admin'] },
];

function getGroupedNav(role: UserRole) {
  const filtered = navItems.filter((item) => item.roles.includes(role));
  const groups: { label: string; items: NavItem[] }[] = [];

  if (role === 'admin') {
    groups.push({
      label: 'Administration',
      items: filtered.filter((i) => i.url.startsWith('/dashboard')),
    });
    groups.push({
      label: 'Team Management',
      items: filtered.filter((i) => i.url.startsWith('/team')),
    });
    groups.push({
      label: 'Personal',
      items: filtered.filter((i) => i.url.startsWith('/goals')),
    });
  } else if (role === 'manager') {
    groups.push({
      label: 'Team Management',
      items: filtered.filter((i) => i.url.startsWith('/team')),
    });
    groups.push({
      label: 'Personal',
      items: filtered.filter((i) => i.url.startsWith('/goals')),
    });
  } else {
    groups.push({
      label: 'Goals',
      items: filtered,
    });
  }

  return groups;
}

function getRoleBadgeVariant(role: UserRole): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (role) {
    case 'admin':
      return 'default';
    case 'manager':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getSidebarRoleLabel(role: UserRole) {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'manager':
      return 'Manager';
    default:
      return 'Employee';
  }
}

function isNavItemActive(pathname: string, itemUrl: string) {
  if (pathname === itemUrl) {
    return true;
  }

  if (itemUrl === '/team') {
    return pathname.startsWith('/team/') && !pathname.startsWith('/team/checkins');
  }

  if (itemUrl === '/goals') {
    return pathname.startsWith('/goals/') && !pathname.startsWith('/goals/progress');
  }

  return false;
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const diffMs = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (Number.isNaN(timestamp)) {
    return 'Just now';
  }

  if (diffMs < minute) {
    return 'Just now';
  }

  if (diffMs < hour) {
    const minutes = Math.floor(diffMs / minute);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  if (diffMs < day * 2) {
    return 'Yesterday';
  }

  const days = Math.floor(diffMs / day);
  return `${days} days ago`;
}

function sortNotifications(items: NotificationItem[]) {
  return [...items]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);
}

function mergeNotification(items: NotificationItem[], item: NotificationItem) {
  return sortNotifications([item, ...items.filter((existing) => existing.id !== item.id)]);
}

function getNotificationReadKey(userId: string) {
  return `atomquest-notifications-read-at-${userId}`;
}

function isUnreadNotification(item: NotificationItem, lastReadAt: string | null) {
  if (!lastReadAt) {
    return true;
  }

  return new Date(item.createdAt).getTime() > new Date(lastReadAt).getTime();
}

function buildGoalSheetNotification(row: ActivityGoalSheetRow, fallbackName = 'Employee'): NotificationItem | null {
  const employeeName = row.employee?.name ?? fallbackName;
  const baseDescription = `${employeeName} · FY2025-26`;

  if (row.status === 'submitted') {
    return {
      id: `sheet-submitted-${row.id}-${row.submitted_at ?? row.updated_at}`,
      title: 'Sheet submitted',
      description: baseDescription,
      createdAt: row.submitted_at ?? row.updated_at,
    };
  }

  if (row.status === 'approved') {
    return {
      id: `sheet-approved-${row.id}-${row.approved_at ?? row.updated_at}`,
      title: 'Sheet approved',
      description: baseDescription,
      createdAt: row.approved_at ?? row.updated_at,
    };
  }

  if (row.status === 'returned') {
    return {
      id: `sheet-returned-${row.id}-${row.updated_at}`,
      title: 'Sheet returned',
      description: row.return_comment ? `${baseDescription} · ${row.return_comment}` : baseDescription,
      createdAt: row.updated_at,
    };
  }

  return null;
}

export function AppSidebar() {
  const { profile } = useProfile();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('atomquest-theme');
    const shouldUseDark = storedTheme === 'dark';

    document.documentElement.classList.toggle('dark', shouldUseDark);
    setIsDarkMode(shouldUseDark);
  }, []);

  const addLiveNotification = useCallback((item: NotificationItem) => {
    setNotifications((current) => mergeNotification(current, { ...item, isUnread: true }));
    setUnreadCount((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const activeProfile = profile;
    const browserSupabase = createClient();
    let isMounted = true;

    async function loadInitialNotifications() {
      const reportIds: string[] = [];
      const employeeNameById = new Map<string, string>();

      if (activeProfile.role === 'employee') {
        reportIds.push(activeProfile.id);
        employeeNameById.set(activeProfile.id, activeProfile.name);
      } else {
        const { data: reports } = await browserSupabase
          .from('profiles')
          .select('id, name')
          .eq(
            activeProfile.role === 'admin' ? 'role' : 'manager_id',
            activeProfile.role === 'admin' ? 'employee' : activeProfile.id
          );

        for (const report of (reports ?? []) as Pick<Profile, 'id' | 'name'>[]) {
          reportIds.push(report.id);
          employeeNameById.set(report.id, report.name);
        }
      }

      const initialItems: NotificationItem[] = [];

      if (reportIds.length > 0) {
        const { data: sheets } = await browserSupabase
          .from('goal_sheets')
          .select('id, employee_id, status, submitted_at, approved_at, return_comment, updated_at, employee:profiles!goal_sheets_employee_id_fkey(name)')
          .in('employee_id', reportIds)
          .order('updated_at', { ascending: false })
          .limit(8);

        for (const sheet of (sheets ?? []) as unknown as ActivityGoalSheetRow[]) {
          const item = buildGoalSheetNotification(sheet, employeeNameById.get(sheet.employee_id) ?? 'Employee');

          if (item) {
            initialItems.push(item);
          }
        }
      }

      const { data: windows } = await browserSupabase
        .from('quarterly_windows')
        .select('id, quarter, is_open, created_at')
        .eq('is_open', true)
        .order('created_at', { ascending: false })
        .limit(2);

      for (const windowRow of (windows ?? []) as ActivityWindowRow[]) {
        initialItems.push({
          id: `window-open-${windowRow.id}`,
          title: `${windowRow.quarter} window opened`,
          description: 'Achievement logging is available',
          createdAt: windowRow.created_at,
        });
      }

      if (activeProfile.role === 'manager' || activeProfile.role === 'admin') {
        const { data: checkins } = await browserSupabase
          .from('checkins')
          .select('id, goal_id, quarter, manager_id, created_at')
          .eq('manager_id', activeProfile.id)
          .order('created_at', { ascending: false })
          .limit(5);

        for (const checkin of (checkins ?? []) as ActivityCheckinRow[]) {
          initialItems.push({
            id: `checkin-${checkin.id}`,
            title: 'Check-in added',
            description: `${checkin.quarter} manager comment`,
            createdAt: checkin.created_at,
          });
        }
      }

      if (isMounted) {
        const lastReadAt = window.localStorage.getItem(getNotificationReadKey(activeProfile.id));
        const sortedItems = sortNotifications(initialItems).map((item) => ({
          ...item,
          isUnread: isUnreadNotification(item, lastReadAt),
        }));

        setNotifications(sortedItems);
        setUnreadCount(sortedItems.filter((item) => item.isUnread).length);
      }

      const reportIdSet = new Set(reportIds);
      const channel = browserSupabase
        .channel(`atomquest-notifications-${activeProfile.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'goal_sheets' },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            const sheet = payload.new as Partial<ActivityGoalSheetRow>;

            if (!sheet.id || !sheet.employee_id || !sheet.status || !sheet.updated_at || !reportIdSet.has(sheet.employee_id)) {
              return;
            }

            const item = buildGoalSheetNotification(
              sheet as ActivityGoalSheetRow,
              employeeNameById.get(sheet.employee_id) ?? 'Employee'
            );

            if (item) {
              addLiveNotification(item);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'checkins' },
          async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            const checkin = payload.new as Partial<ActivityCheckinRow>;

            if (!checkin.id || !checkin.goal_id || !checkin.quarter || !checkin.created_at) {
              return;
            }

            const { data: goal } = await browserSupabase
              .from('goals')
              .select('sheet_id, goal_sheets!inner(employee_id)')
              .eq('id', checkin.goal_id)
              .single();
            const goalSheet = goal as { goal_sheets?: { employee_id?: string } } | null;
            const employeeId = goalSheet?.goal_sheets?.employee_id;

            if (employeeId !== activeProfile.id && (!employeeId || !reportIdSet.has(employeeId))) {
              return;
            }

            addLiveNotification({
              id: `checkin-${checkin.id}`,
              title: 'Check-in added',
              description: `${checkin.quarter} manager comment`,
              createdAt: checkin.created_at,
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'quarterly_windows' },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            const windowRow = payload.new as Partial<ActivityWindowRow>;

            if (!windowRow.id || !windowRow.quarter || !windowRow.created_at || !windowRow.is_open) {
              return;
            }

            addLiveNotification({
              id: `window-open-${windowRow.id}-${Date.now()}`,
              title: `${windowRow.quarter} window opened`,
              description: 'Achievement logging is available',
              createdAt: new Date().toISOString(),
            });
          }
        )
        .subscribe();

      return channel;
    }

    let notificationChannel: ReturnType<typeof browserSupabase.channel> | null = null;

    void loadInitialNotifications().then((channel) => {
      notificationChannel = channel ?? null;
    });

    return () => {
      isMounted = false;

      if (notificationChannel) {
        void browserSupabase.removeChannel(notificationChannel);
      }
    };
  }, [addLiveNotification, profile]);

  if (!profile) return null;

  const groups = getGroupedNav(profile.role as UserRole);
  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function toggleDarkMode() {
    const nextMode = !isDarkMode;
    document.documentElement.classList.toggle('dark', nextMode);
    window.localStorage.setItem('atomquest-theme', nextMode ? 'dark' : 'light');
    setIsDarkMode(nextMode);
  }

  function handleNotificationOpenChange(open: boolean) {
    if (!profile) {
      return;
    }

    if (open) {
      window.localStorage.setItem(getNotificationReadKey(profile.id), new Date().toISOString());
      setUnreadCount(0);
      return;
    }

    setNotifications((current) => current.map((item) => ({ ...item, isUnread: false })));
  }

  return (
    <Sidebar variant="inset" className="w-[260px] min-w-[260px] p-0">
      <SidebarHeader className="border-b border-white/10">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 rounded-xl px-2 py-2">
              <Image src="/logo.png" width={32} height={32} alt="AtomQuest logo" className="h-8 w-8 rounded-lg bg-white object-cover shadow-sm" />
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-white">AtomQuest</span>
                <span className="text-[11px] font-normal text-white/45">Every target. Every quarter.</span>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isNavItemActive(pathname, item.url)}
                      tooltip={item.title}
                      className="h-10 px-3"
                    >
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="mb-2 flex items-center gap-2 px-1">
          <DropdownMenu onOpenChange={handleNotificationOpenChange}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4 animate-[bellBounce_1.8s_ease-in-out_infinite]" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold leading-none text-white shadow-[0_0_12px_rgba(16,185,129,0.55)]">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Activity</span>
                <span className="text-[11px] font-normal text-muted-foreground">Latest 5</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No recent activity yet.
                </div>
              ) : (
                notifications.map((item) => (
                  <DropdownMenuItem key={item.id} className="flex cursor-default flex-col items-start gap-1 py-3">
                    <span className="flex w-full items-center justify-between gap-3 text-sm font-semibold">
                      <span className="flex min-w-0 items-center gap-2">
                        {item.isUnread && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.75)]" />
                        )}
                        <span className="truncate">{item.title}</span>
                      </span>
                      {item.isUnread && (
                        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                          New
                        </span>
                      )}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{item.description}</span>
                    <span className="text-[11px] text-muted-foreground">{formatRelativeTime(item.createdAt)}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 text-xs font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {isDarkMode ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
              <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton size="lg" className="h-auto rounded-xl border border-white/10 bg-white/[0.06] p-3 text-white data-[state=open]:bg-white/10">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-emerald-600 text-white text-xs font-medium">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col text-left text-sm leading-tight">
                        <span className="max-w-[160px] truncate font-medium text-white">{profile.name}</span>
                        <span className="max-w-[160px] truncate text-xs text-white/50">{profile.email}</span>
                      </div>
                      <Badge variant={getRoleBadgeVariant(profile.role as UserRole)} className="shrink-0 whitespace-nowrap px-2 text-[10px]">
                        {getSidebarRoleLabel(profile.role as UserRole)}
                      </Badge>
                      <ChevronUp className="ml-auto h-4 w-4 shrink-0 text-white/50" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" align="center">
                  {profile.name} · {getSidebarRoleLabel(profile.role as UserRole)}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                side="top"
                align="start"
                sideOffset={4}
              >
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{profile.name}</p>
                  <p className="text-xs text-muted-foreground">{profile.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {profile.department && `${profile.department} · `}{getSidebarRoleLabel(profile.role as UserRole)}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
