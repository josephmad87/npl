import { useSyncExternalStore } from 'react'
import { getApiBaseUrl } from './publicApi'

export type SupporterSession = {
  accessToken: string
  refreshToken: string
}

const STORAGE_KEY = 'npl_supporter_session_v1'
const ANALYTICS_KEY = 'npl_supporter_analytics_consent'
const listeners = new Set<() => void>()

function readStoredSession(): SupporterSession | null {
  if (typeof window === 'undefined') return null
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<SupporterSession> | null
    return parsed?.accessToken && parsed.refreshToken
      ? { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken }
      : null
  } catch {
    return null
  }
}

let currentSession = readStoredSession()

export function setSupporterSession(session: SupporterSession | null) {
  currentSession = session
  if (typeof window !== 'undefined') {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else window.localStorage.removeItem(STORAGE_KEY)
  }
  listeners.forEach((listener) => listener())
}

export function useSupporterSession(): SupporterSession | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => currentSession,
    () => null,
  )
}

export function setSupporterAnalyticsConsent(enabled: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ANALYTICS_KEY, enabled ? 'true' : 'false')
}

function apiMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const detail = (payload as { detail?: unknown }).detail
    if (detail && typeof detail === 'object' && 'message' in detail) return String(detail.message)
    if (typeof detail === 'string') return detail
  }
  return fallback
}

class SupporterApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function rawRequest<T>(path: string, init: RequestInit, accessToken?: string): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers })
  const text = await response.text()
  let payload: unknown = null
  try { payload = text ? JSON.parse(text) : null } catch { payload = null }
  if (!response.ok) throw new SupporterApiError(apiMessage(payload, `Request failed: ${response.status}`), response.status)
  return payload as T
}

let refreshPromise: Promise<SupporterSession> | null = null

async function refreshSession(session: SupporterSession): Promise<SupporterSession> {
  const token = await rawRequest<{ access_token: string; refresh_token: string }>(
    '/supporters/auth/refresh',
    { method: 'POST', body: JSON.stringify({ refresh_token: session.refreshToken }) },
  )
  const next = { accessToken: token.access_token, refreshToken: token.refresh_token }
  setSupporterSession(next)
  return next
}

export async function supporterFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = currentSession
  try {
    return await rawRequest<T>(path, init, session?.accessToken)
  } catch (error) {
    if (!session || !(error instanceof SupporterApiError) || error.status !== 401) throw error
    try {
      if (!refreshPromise) refreshPromise = refreshSession(session).finally(() => { refreshPromise = null })
      const refreshed = await refreshPromise
      return await rawRequest<T>(path, init, refreshed.accessToken)
    } catch (refreshError) {
      setSupporterSession(null)
      throw refreshError
    }
  }
}

export async function supporterLogin(email: string, password: string): Promise<void> {
  const token = await rawRequest<{ access_token: string; refresh_token: string }>(
    '/supporters/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  )
  setSupporterSession({ accessToken: token.access_token, refreshToken: token.refresh_token })
}

export async function supporterRegister(body: Record<string, unknown>): Promise<void> {
  const token = await rawRequest<{ access_token: string; refresh_token: string }>(
    '/supporters/auth/register',
    { method: 'POST', body: JSON.stringify(body) },
  )
  setSupporterSession({ accessToken: token.access_token, refreshToken: token.refresh_token })
}

function anonymousAnalyticsId(): string {
  const key = 'npl_consent_analytics_id'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const next = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(key, next)
  return next
}

export function recordFanEngagement(
  eventType: string,
  entityType?: string,
  entityId?: number,
  properties: Record<string, string | number | boolean | null> = {},
) {
  if (typeof window === 'undefined' || window.localStorage.getItem(ANALYTICS_KEY) !== 'true') return
  void supporterFetch<void>('/supporters/engagement', {
    method: 'POST',
    body: JSON.stringify({
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      anonymous_id: currentSession ? null : anonymousAnalyticsId(),
      source: 'website',
      properties,
    }),
  }).catch(() => undefined)
}
