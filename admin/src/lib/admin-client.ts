import { ApiError, apiFetch } from '@/lib/api'
import type { Paginated, TokenResponse } from '@/lib/api-types'
import { clearSession, getSession, setSession } from '@/lib/session'

export type MediaUploadKind =
  | 'leagues'
  | 'teams'
  | 'players'
  | 'gallery'
  | 'news'
  | 'matches'

export type MediaUploadResponse = {
  url: string
  path: string
}

function redirectToLoginPreservingReturn() {
  clearSession()
  const u = new URL('/login', window.location.origin)
  u.searchParams.set('redirect', window.location.href)
  window.location.assign(u.toString())
}

let refreshInFlight: Promise<void> | null = null

async function refreshSessionTokens(): Promise<void> {
  const session = getSession()
  if (!session?.refreshToken) {
    throw new ApiError('Session expired', 401, null)
  }
  const tokens = await apiFetch<TokenResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  })
  setSession({
    ...session,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  })
}

function readAccessToken(): string | null {
  const s = getSession()
  return s?.accessToken ?? null
}

/** Never resolves after redirect (full navigation). */
function pendingRedirect(): Promise<never> {
  return new Promise(() => {})
}

async function adminApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const attempt = (accessToken: string) =>
    apiFetch<T>(path, { ...init, accessToken })

  let token = readAccessToken()
  if (!token) {
    redirectToLoginPreservingReturn()
    return pendingRedirect()
  }

  try {
    return await attempt(token)
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) {
      throw e
    }
    try {
      if (!refreshInFlight) {
        refreshInFlight = refreshSessionTokens().finally(() => {
          refreshInFlight = null
        })
      }
      await refreshInFlight
    } catch {
      redirectToLoginPreservingReturn()
      return pendingRedirect()
    }
    token = readAccessToken()
    if (!token) {
      redirectToLoginPreservingReturn()
      return pendingRedirect()
    }
    try {
      return await attempt(token)
    } catch (retryErr) {
      if (retryErr instanceof ApiError && retryErr.status === 401) {
        redirectToLoginPreservingReturn()
        return pendingRedirect()
      }
      throw retryErr
    }
  }
}

export function getAccessTokenOrThrow(): string {
  const s = getSession()
  if (!s?.accessToken) {
    throw new ApiError('Not signed in', 401, null)
  }
  return s.accessToken
}

export async function adminGet<T>(path: string): Promise<T> {
  return adminApiFetch<T>(path)
}

export async function adminPost<T>(path: string, body: unknown): Promise<T> {
  return adminApiFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function adminPatch<T>(path: string, body: unknown): Promise<T> {
  return adminApiFetch<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function adminDelete(path: string): Promise<void> {
  await adminApiFetch<unknown>(path, { method: 'DELETE' })
}

export async function adminUploadMedia(
  file: File,
  kind: MediaUploadKind,
): Promise<MediaUploadResponse> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('kind', kind)
  return adminApiFetch<MediaUploadResponse>('/admin/uploads', {
    method: 'POST',
    body: fd,
  })
}

/** Fetch all pages up to `maxPages` (default 10 × pageSize rows). */
export async function adminListAll<T>(
  basePath: string,
  pageSize = 100,
  maxPages = 10,
): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; page <= maxPages; page++) {
    const sep = basePath.includes('?') ? '&' : '?'
    const r = await adminGet<Paginated<T>>(
      `${basePath}${sep}page=${page}&page_size=${pageSize}`,
    )
    out.push(...r.items)
    if (r.items.length < pageSize || page >= r.pages) break
  }
  return out
}
