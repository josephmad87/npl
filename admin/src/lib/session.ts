const STORAGE_KEY = 'npl_admin_session'

/** Matches FastAPI `User.role` (`app.core.roles`). */
export type AdminRole =
  | 'super_admin'
  | 'competition_manager'
  | 'content_editor'
  | 'read_only_admin'

export type AdminSession = {
  email: string
  name: string
  role: AdminRole
  accessToken: string
  refreshToken: string
}

export function getSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AdminSession
    if (
      typeof parsed.email === 'string' &&
      typeof parsed.accessToken === 'string' &&
      typeof parsed.role === 'string'
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function setSession(session: AdminSession) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

/** Merge into the stored session (e.g. after profile update). */
export function patchSession(updates: Partial<Pick<AdminSession, 'name' | 'email'>>) {
  const s = getSession()
  if (!s) return
  setSession({ ...s, ...updates })
}

export function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY)
}

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  competition_manager: 'Competition Manager',
  content_editor: 'Content Editor',
  read_only_admin: 'Read-only',
}

export function roleLabel(role: AdminRole): string {
  return ROLE_LABELS[role]
}

const KNOWN_ROLES: readonly AdminRole[] = [
  'super_admin',
  'competition_manager',
  'content_editor',
  'read_only_admin',
] as const

export function parseAdminRole(role: string): AdminRole {
  return (KNOWN_ROLES as readonly string[]).includes(role)
    ? (role as AdminRole)
    : 'read_only_admin'
}
