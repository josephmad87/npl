import { useCallback } from 'react'
import { API } from './feed'
import { useTeamResource } from './use-team-resource'

export type Page<T> = { items: T[]; page: number; pages: number; total: number }

export async function publicRequest<T>(path: string, signal?: AbortSignal, init?: RequestInit): Promise<T> {
  let response: Response
  try { response = await fetch(API + '/public' + path, { ...init, signal }) }
  catch { throw new Error('Could not connect to NPL. Check your connection and try again.') }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(
      body?.detail?.message || (response.status === 404 ? 'This content is no longer available.'
        : response.status === 429 ? 'Too many requests. Please try again later.' : 'Could not load NPL information. Try again.'),
    )
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

export function usePublic<T>(path: string | null, options?: Parameters<typeof useTeamResource>[2]) {
  const load = useCallback((signal: AbortSignal) => publicRequest<T>(path!, signal), [path])
  return useTeamResource<T>(path === null ? null : 'public:' + path, load, options)
}
