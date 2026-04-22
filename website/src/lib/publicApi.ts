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
