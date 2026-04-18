import { ApiError, apiFetch } from '@/lib/api'

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
import type { Paginated } from '@/lib/api-types'
import { getSession } from '@/lib/session'

export function getAccessTokenOrThrow(): string {
  const s = getSession()
  if (!s?.accessToken) {
    throw new ApiError('Not signed in', 401, null)
  }
  return s.accessToken
}

export async function adminGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { accessToken: getAccessTokenOrThrow() })
}

export async function adminPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    accessToken: getAccessTokenOrThrow(),
    body: JSON.stringify(body),
  })
}

export async function adminPatch<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PATCH',
    accessToken: getAccessTokenOrThrow(),
    body: JSON.stringify(body),
  })
}

export async function adminDelete(path: string): Promise<void> {
  await apiFetch<unknown>(path, {
    method: 'DELETE',
    accessToken: getAccessTokenOrThrow(),
  })
}

export async function adminUploadMedia(
  file: File,
  kind: MediaUploadKind,
): Promise<MediaUploadResponse> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('kind', kind)
  return apiFetch<MediaUploadResponse>('/admin/uploads', {
    method: 'POST',
    accessToken: getAccessTokenOrThrow(),
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
