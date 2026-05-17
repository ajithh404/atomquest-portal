import { type UserRole } from '@/lib/types';

export function isEmployee(role: UserRole): boolean {
  return role === 'employee';
}

export function isManager(role: UserRole): boolean {
  return role === 'manager';
}

export function isAdmin(role: UserRole): boolean {
  return role === 'admin';
}

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  if (role === 'admin') return true;
  if (role === 'manager') {
    return !pathname.startsWith('/dashboard');
  }
  // Employee
  return pathname.startsWith('/goals') || pathname.startsWith('/profile');
}

export function getDefaultRoute(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/dashboard';
    case 'manager':
      return '/team';
    case 'employee':
    default:
      return '/goals';
  }
}

export function getRoleBadgeColor(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'manager':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'employee':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Admin / HR';
    case 'manager':
      return 'Manager';
    case 'employee':
      return 'Employee';
    default:
      return role;
  }
}
