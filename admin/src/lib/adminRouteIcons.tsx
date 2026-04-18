import type { LucideIcon } from 'lucide-react'
import {
  CalendarDays,
  Images,
  LayoutDashboard,
  Newspaper,
  ScrollText,
  Settings,
  Trophy,
  User,
  UserCircle,
  UserCog,
  UsersRound,
} from 'lucide-react'

const FALLBACK: LucideIcon = LayoutDashboard

/** Primary admin routes → sidebar / dashboard icons */
export const ADMIN_ROUTE_ICONS: Record<string, LucideIcon> = {
  '/': LayoutDashboard,
  '/teams': UsersRound,
  '/players': UserCircle,
  '/leagues': Trophy,
  '/matches': CalendarDays,
  '/news': Newspaper,
  '/gallery': Images,
  '/users': UserCog,
  '/audit': ScrollText,
  '/profile': User,
  '/settings': Settings,
}

export function adminRouteIconForPath(path: string): LucideIcon {
  return ADMIN_ROUTE_ICONS[path] ?? FALLBACK
}
