import { API_BASE } from '@/lib/api'

export function resolveAdminMediaUrl(raw: string | null | undefined): string | null {
  const t = raw?.trim() ?? ''
  if (!t) return null
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  if (t.startsWith('//')) return `${globalThis.location.protocol}${t}`
  if (t.startsWith('/')) {
    try {
      return `${new URL(API_BASE).origin}${t}`
    } catch {
      return t
    }
  }
  return t
}
