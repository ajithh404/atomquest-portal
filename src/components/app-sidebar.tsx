'use client';

import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useProfile } from '@/components/profile-provider';
import { getRoleLabel } from '@/lib/auth';
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
  SidebarRail,
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
  Target,
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

export function AppSidebar() {
  const { profile } = useProfile();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

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

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 px-2 py-1.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 shadow-sm">
                <Target className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight">AtomQuest</span>
                <span className="text-[10px] text-muted-foreground">Goal Tracking Portal</span>
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
                      isActive={pathname === item.url || (item.url !== '/' && pathname.startsWith(item.url + '/'))}
                      tooltip={item.title}
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
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-xs font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col flex-1 text-left text-sm leading-tight">
                    <span className="font-medium truncate">{profile.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{profile.email}</span>
                  </div>
                  <Badge variant={getRoleBadgeVariant(profile.role as UserRole)} className="text-[10px] px-1.5">
                    {getRoleLabel(profile.role as UserRole)}
                  </Badge>
                  <ChevronUp className="ml-auto w-4 h-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
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
                    {profile.department && `${profile.department} · `}{getRoleLabel(profile.role as UserRole)}
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

      <SidebarRail />
    </Sidebar>
  );
}
