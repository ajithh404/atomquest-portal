'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
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
} from 'lucide-react';
import Link from 'next/link';
import type { UserRole } from '@/lib/types';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  // Admin section
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { title: 'Organization', url: '/dashboard/org', icon: Building2, roles: ['admin'] },
  { title: 'Thrust Areas', url: '/dashboard/thrust-areas', icon: Crosshair, roles: ['admin'] },
  { title: 'Cycle Management', url: '/dashboard/cycles', icon: CalendarDays, roles: ['admin'] },
  { title: 'Reports', url: '/dashboard/reports', icon: FileText, roles: ['admin'] },
  { title: 'Audit Log', url: '/dashboard/audit', icon: Search, roles: ['admin'] },
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

export function AppSidebar() {
  const { profile } = useProfile();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('atomquest-theme');
    const shouldUseDark = storedTheme
      ? storedTheme === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;

    document.documentElement.classList.toggle('dark', shouldUseDark);
    setIsDarkMode(shouldUseDark);
  }, []);

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
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4 animate-[bellBounce_1.8s_ease-in-out_infinite]" />
          </button>
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
