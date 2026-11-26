import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useFocusEffect } from 'expo-router'
import { API } from './feed'

type Session = { access_token: string; refresh_token: string }
export type Preference = 'push_consent' | 'marketing_consent' | 'analytics_consent'
export type Profile = Record<Preference, boolean> & { id: number; display_name: string; email: string; phone: string | null }
export type Registration = Partial<Record<Preference, boolean>> & {
  display_name: string; phone: string | null; accept_terms: boolean; accept_privacy: boolean; policy_version: string
}
type Follow = { id: number; name: string; slug: string }
export type Follows = { teams: Follow[]; players: Follow[] }

const storageKey = 'npl.supporter.session'
const deletionKey = 'npl.supporter.last-deletion'
const deviceOnly = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
const listeners = new Set<() => void>()
let session: Session | null | undefined
let revision = 0
let hydration: Promise<void> | undefined
let storageWrite = Promise.resolve()
let refresh: Promise<Session> | undefined
let lastDeletion: string | null | undefined

async function readPrivate(key: string) {
  return await SecureStore.isAvailableAsync() ? SecureStore.getItemAsync(key, deviceOnly) : null
}

function writePrivate(key: string, value: string | null) {
  const write = async () => {
    if (!await SecureStore.isAvailableAsync()) return
    if (value === null) await SecureStore.deleteItemAsync(key, deviceOnly)
    else await SecureStore.setItemAsync(key, value, deviceOnly)
  }
  storageWrite = storageWrite.catch(() => undefined).then(write)
  return storageWrite
}

function publish(next: Session | null) {
  session = next
  listeners.forEach(listener => listener())
}

function hydrate() {
  hydration ??= readPrivate(storageKey).then(value => {
    if (session !== undefined) return
    const saved = value ? JSON.parse(value) as Partial<Session> : null
    publish(typeof saved?.access_token === 'string' && typeof saved.refresh_token === 'string' ? saved as Session : null)
  }).catch(() => {
    if (session === undefined) publish(null)
  })
  return hydration
}

function save(next: Session | null) {
  publish(next)
  return writePrivate(storageKey, next ? JSON.stringify(next) : null)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useSupporterAccount() {
  useEffect(() => { void hydrate() }, [])
  return useSyncExternalStore(subscribe, () => session, () => undefined)
}

export function useSupporterIdentity() {
  return useSupporterAccount() ? revision : null
}

export class SupporterError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message) }
}

async function request<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', 'Bearer ' + accessToken)
  const controller = new AbortController()
  const cancel = () => controller.abort()
  const signal = init.signal
  if (signal?.aborted) cancel()
  signal?.addEventListener('abort', cancel, { once: true })
  const timeout = setTimeout(cancel, 15_000)
  try {
    const response = await fetch(API + path, { ...init, headers, signal: controller.signal })
    if (response.status === 204) return undefined as T
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      const detail = body?.detail
      const message = typeof detail === 'string' ? detail : detail?.message
      throw new SupporterError(
        message || (response.status === 429 ? 'Too many attempts. Please try again later.' : 'NPL could not complete your request. Please try again.'),
        response.status,
        detail?.code,
      )
    }
    if (body === null) throw new Error('NPL returned an incomplete response. Try again.')
    return body as T
  } catch (error) {
    if (error instanceof SupporterError) throw error
    throw new Error(controller.signal.aborted ? 'The request timed out. Please try again.' : 'Could not connect to NPL. Check your connection and try again.')
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', cancel)
  }
}

function fingerprint(email: string) {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, 'npl.supporter.deleted:' + email.trim().toLowerCase())
}

async function matchesLastDeletion(email: string) {
  try {
    if (lastDeletion === undefined) lastDeletion = await readPrivate(deletionKey)
    return Boolean(lastDeletion && lastDeletion === await fingerprint(email))
  } catch {
    return false
  }
}

export async function authenticate(email: string, password: string, registration?: Registration) {
  const version = revision
  let next: Session
  try {
    next = await request<Session>(registration ? '/supporters/auth/register' : '/supporters/auth/login', {
      method: 'POST', body: JSON.stringify({ ...registration, email: email.trim(), password }),
    })
  } catch (error) {
    if (!registration && error instanceof SupporterError && error.code === 'invalid_credentials' && await matchesLastDeletion(email)) {
      throw new SupporterError('This account no longer exists.', 401, 'deleted_here')
    }
    throw error
  }
  if (revision !== version) return
  revision++
  refresh = undefined
  await save(next).catch(() => undefined)
  if (await matchesLastDeletion(email)) {
    lastDeletion = null
    await writePrivate(deletionKey, null).catch(() => undefined)
  }
}

export async function signOutSupporter() {
  revision++
  refresh = undefined
  await save(null)
}

export async function deleteSupporterAccount(email: string) {
  const version = revision
  const digest = await fingerprint(email).catch(() => null)
  await supporterRequest('/me', { method: 'DELETE' })
  if (revision !== version) return
  lastDeletion = digest
  await signOutSupporter().catch(() => undefined)
  await writePrivate(deletionKey, digest).catch(() => undefined)
}

async function authorized<T>(path: string, init?: RequestInit): Promise<T> {
  const current = session
  const version = revision
  if (!current) throw new Error('Sign in to continue.')
  const send = async (token: string) => {
    const result = await request<T>(path, init, token)
    if (revision !== version) throw new Error('Your sign-in session changed.')
    return result
  }
  try {
    return await send(current.access_token)
  } catch (error) {
    if (!(error instanceof SupporterError) || error.status !== 401 || revision !== version || init?.signal?.aborted) throw error
  }
  if (session && session !== current) return send(session.access_token)
  if (!refresh) {
    const pending = request<Session>('/supporters/auth/refresh', {
      method: 'POST', body: JSON.stringify({ refresh_token: current.refresh_token }),
    }).then(async next => {
      if (revision !== version) throw new Error('Your sign-in session changed.')
      await save(next).catch(() => undefined)
      return next
    }).catch(async error => {
      if (revision === version && error instanceof SupporterError && error.status === 401) {
        await signOutSupporter().catch(() => undefined)
      }
      throw error
    }).finally(() => {
      if (refresh === pending) refresh = undefined
    })
    refresh = pending
  }
  const next = await refresh
  if (revision !== version) throw new Error('Your sign-in session changed.')
  return send(next.access_token)
}

export function supporterRequest<T>(path: string, init?: RequestInit) {
  return authorized<T>('/supporters' + path, init)
}

export function supporterPublicRequest<T>(path: string, init?: RequestInit) {
  return session ? authorized<T>('/public' + path, init) : request<T>('/public' + path, init)
}

export function useSupporterResource<T>(path: string | null) {
  const identity = useSupporterIdentity()
  const [attempt, setAttempt] = useState(0)
  const key = identity !== null && path ? identity + ':' + path + ':' + attempt : ''
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: '' })
  const refreshResource = useCallback(() => setAttempt(value => value + 1), [])
  useFocusEffect(useCallback(() => {
    if (!path || !key) return
    const controller = new AbortController()
    void supporterRequest<T>(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ key, data })
    }).catch((error: Error) => {
      if (!controller.signal.aborted) setState(previous => ({ key, data: previous.key === key ? previous.data : undefined, error: error.message }))
    })
    return () => controller.abort()
  }, [key, path]))
  const data = state.key === key ? state.data : undefined
  const error = state.key === key ? state.error : undefined
  return { data, error, loading: Boolean(key && data === undefined && !error), refresh: refreshResource }
}
