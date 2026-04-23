export const getApiBaseUrl = () => {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
  if (!baseUrl) {
    throw new Error('Missing VITE_API_BASE_URL. Set it in website/.env')
  }
  return baseUrl.replace(/\/+$/, '')
}

export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return (await response.json()) as T
}

export function extractList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === 'object') {
    const bag = payload as Record<string, unknown>
    const list = bag.items ?? bag.data ?? bag.results
    if (Array.isArray(list)) return list as T[]
  }
  return []
}

type PaginatedPayload = {
  total?: number
  pages?: number
}

/**
 * Fetches every page of a paginated public API list (e.g. /public/results) up to `maxPages`.
 * Use for category-wide listings where the UI must show all matches, not just the first page.
 */
export async function fetchAllPaginatedList<T>(buildPath: (page: number) => string, maxPages = 100): Promise<T[]> {
  const first = await fetchJson<unknown>(buildPath(1))
  const bag = first as PaginatedPayload
  let items = extractList<T>(first)
  const total = typeof bag.total === 'number' ? bag.total : items.length
  const pageCount = typeof bag.pages === 'number' ? bag.pages : 1
  if (pageCount <= 1 || items.length >= total) {
    return items
  }
  const lastPage = Math.min(pageCount, maxPages)
  for (let p = 2; p <= lastPage; p += 1) {
    const next = await fetchJson<unknown>(buildPath(p))
    const chunk = extractList<T>(next)
    if (chunk.length === 0) {
      break
    }
    items = items.concat(chunk)
    if (items.length >= total) {
      break
    }
  }
  return items
}

export const resolveMediaUrl = (raw: string | null | undefined): string | null => {
  const value = raw?.trim() ?? ''
  if (!value) return null
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (value.startsWith('//')) return `${globalThis.location.protocol}${value}`
  if (value.startsWith('/')) {
    try {
      return `${new URL(getApiBaseUrl()).origin}${value}`
    } catch {
      return value
    }
  }
  return value
}
