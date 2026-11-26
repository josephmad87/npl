import { useCallback, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'

type Snapshot = { data?: unknown; checkedAt?: number; error?: string; loading: boolean }
type Entry = { snapshot: Snapshot; listeners: Set<() => void>; pending?: Promise<void>; hydrated?: boolean }
type Options = { maxAge?: number; poll?: number; persist?: boolean }
const initial: Snapshot = { loading: true }
const cache = new Map<string, Entry>()

function readEntry(key: string): Entry {
  let entry = cache.get(key)
  if (!entry) {
    entry = { snapshot: initial, listeners: new Set() }
    cache.set(key, entry)
    if (cache.size > 100) {
      const unused = [...cache.entries()].find(([oldKey, value]) => oldKey !== key && !value.pending && !value.listeners.size)
      if (unused) cache.delete(unused[0])
    }
  }
  return entry
}

function update(entry: Entry, snapshot: Snapshot) {
  entry.snapshot = snapshot
  entry.listeners.forEach(listener => listener())
}

function hydrate(entry: Entry, key: string) {
  if (entry.hydrated) return
  entry.hydrated = true
  void AsyncStorage.getItem('npl-resource-' + key).then(raw => {
    if (raw && entry.snapshot.data === undefined) update(entry, { ...entry.snapshot, data: JSON.parse(raw) })
  }).catch(() => undefined)
}

export function useTeamResource<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, {
  maxAge = 60_000, poll, persist = true,
}: Options = {}) {
  const subscribe = useCallback((listener: () => void) => {
    if (key === null) return () => undefined
    const entry = readEntry(key)
    entry.listeners.add(listener)
    return () => { entry.listeners.delete(listener) }
  }, [key])
  const snapshot = useSyncExternalStore(subscribe, () => key === null ? initial : readEntry(key).snapshot, () => initial)

  const refresh = useCallback((background = false) => {
    if (key === null) return Promise.resolve()
    const entry = readEntry(key)
    if (entry.pending) return entry.pending
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 18_000)
    if (!background || entry.snapshot.data === undefined) update(entry, { ...entry.snapshot, loading: true })
    const pending = Promise.resolve().then(() => load(controller.signal)).then(data => {
      update(entry, { data, checkedAt: Date.now(), loading: false })
      if (persist) {
        const raw = JSON.stringify(data)
        // Large archives and timelines are better kept in memory for this session.
        if (raw && raw.length <= 180_000) void AsyncStorage.setItem('npl-resource-' + key, raw).catch(() => undefined)
      }
    }).catch((error: unknown) => {
      update(entry, {
        ...entry.snapshot, loading: false,
        error: controller.signal.aborted ? 'The connection timed out. Try again.' : error instanceof Error ? error.message : 'Could not load NPL information.',
      })
    }).finally(() => {
      clearTimeout(timeout)
      entry.pending = undefined
    })
    entry.pending = pending
    return pending
  }, [key, load, persist])

  useFocusEffect(useCallback(() => {
    if (key === null) return
    const entry = readEntry(key)
    if (persist) hydrate(entry, key)
    function refreshIfStale() {
      if (Date.now() - (entry.snapshot.checkedAt || 0) >= maxAge) void refresh(true)
    }
    refreshIfStale()
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refreshIfStale() })
    const timer = poll ? setInterval(() => {
      if (AppState.currentState === 'active') refreshIfStale()
    }, poll) : undefined
    return () => {
      subscription.remove()
      if (timer) clearInterval(timer)
    }
  }, [key, maxAge, persist, poll, refresh]))

  return {
    data: snapshot.data as T | undefined,
    loading: key !== null && snapshot.loading,
    error: snapshot.error,
    checkedAt: snapshot.checkedAt,
    refresh,
  }
}
