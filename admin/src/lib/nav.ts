import type { AdminRole } from '@/lib/session'

export type NavItem = {
  to: string
  label: string
  /** Empty = all authenticated roles */
  roles?: AdminRole[]
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Overview' },
  {
    to: '/teams',
    label: 'Teams',
    roles: ['super_admin', 'competition_manager', 'read_only_admin'],
  },
  {
    to: '/players',
    label: 'Players',
    roles: ['super_admin', 'competition_manager', 'read_only_admin'],
  },
  {
    to: '/leagues',
    label: 'Leagues',
    roles: ['super_admin', 'competition_manager', 'read_only_admin'],
  },
  {
    to: '/matches',
    label: 'Fixtures & matches',
    roles: ['super_admin', 'competition_manager', 'read_only_admin'],
  },
  {
    to: '/news',
    label: 'News',
    roles: ['super_admin', 'content_editor', 'read_only_admin'],
  },
  {
    to: '/gallery',
    label: 'Gallery',
    roles: ['super_admin', 'content_editor', 'read_only_admin'],
  },
  {
    to: '/users',
    label: 'Admin users',
    roles: ['super_admin'],
  },
  {
    to: '/audit',
    label: 'Audit log',
    roles: ['super_admin', 'read_only_admin'],
  },
  { to: '/profile', label: 'My profile' },
  {
    to: '/settings',
    label: 'Settings',
    roles: ['super_admin'],
  },
]

export function navVisibleForRole(
  item: NavItem,
  role: AdminRole | undefined,
): boolean {
  if (!item.roles?.length) return true
  if (!role) return false
  return item.roles.includes(role)
}
