/**
 * API base for the FastAPI CMS (`README.md` §6). Override with `VITE_API_BASE_URL`.
 * Empty or whitespace-only env values are ignored so requests do not fall back to the Vite origin.
 */
function readApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (t.length > 0) return t.replace(/\/+$/, '')
  }
  return 'http://localhost:8000/api/v1'
}

export const API_BASE = readApiBaseUrl()

export type ApiErrorBody = {
  code?: string
  message?: string
  detail?: unknown
}

function messageFromApiJson(json: unknown): string | null {
  if (json === null || typeof json !== 'object') return null
  const detail = (json as { detail?: unknown }).detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const parts = detail
      .map((e) => {
        if (e && typeof e === 'object' && 'msg' in e) {
          return String((e as { msg: unknown }).msg)
        }
        return ''
      })
      .filter(Boolean)
    return parts.length > 0 ? parts.join('; ') : null
  }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    return String((detail as { message: unknown }).message)
  }
  return null
}

export class ApiError extends Error {
  status: number
  body: ApiErrorBody | null

  constructor(message: string, status: number, body: ApiErrorBody | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const headers = new Headers(init.headers)
  if (!(init.body instanceof FormData)) {
    if (!headers.has('Content-Type') && init.body) {
      headers.set('Content-Type', 'application/json')
    }
  }
  if (init.accessToken) {
    headers.set('Authorization', `Bearer ${init.accessToken}`)
  }

  const res = await fetch(url, { ...init, headers })
  const text = await res.text()
  let json: unknown = null
  let jsonParseFailed = false
  try {
    json = text ? (JSON.parse(text) as unknown) : null
  } catch {
    json = null
    jsonParseFailed = true
  }

  if (!res.ok) {
    const body = (json ?? null) as ApiErrorBody | null
    const fromDetail = json !== null ? messageFromApiJson(json) : null
    const message =
      fromDetail ??
      (typeof body?.message === 'string' ? body.message : null) ??
      res.statusText ??
      'Request failed'
    throw new ApiError(message, res.status, body)
  }

  if (jsonParseFailed && text.trim().length > 0) {
    throw new ApiError(
      'The server returned a non-JSON response. Check VITE_API_BASE_URL points at the FastAPI /api/v1 base URL (not the Vite dev server).',
      res.status,
      null,
    )
  }

  return json as T
}
