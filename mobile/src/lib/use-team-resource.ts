import { useCallback, useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
const cache = new Map<string, { data: unknown; time: number }>()
/** A stale resource remains visible when refresh fails; keys isolate teams and seasons. */
export function useTeamResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [snapshot, setSnapshot] = useState<{ key: string; data?: T; error?: string; loading: boolean }>(() => ({ key, data: cache.get(key)?.data as T | undefined, loading: true }))
  const controller = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    controller.current?.abort()
    const request = new AbortController(); controller.current = request
    const timeout = setTimeout(() => request.abort(), 20_000)
    setSnapshot(previous => ({ key, data: previous.key === key ? previous.data : undefined, loading: true }))
    try {
      const data = await load(request.signal)
      if (controller.current !== request) return
      cache.set(key, { data, time: Date.now() })
      setSnapshot({ key, data, loading: false })
      void AsyncStorage.setItem(`npl-resource-${key}`, JSON.stringify(data)).catch(() => undefined)
    } catch (error) {
      if (controller.current === request) setSnapshot(previous => ({ key, data: previous.key === key ? previous.data : undefined, loading: false, error: error instanceof Error && error.name !== 'AbortError' ? error.message : 'The connection timed out. Pull down or tap retry.' }))
    } finally { clearTimeout(timeout) }
  }, [key, load])
  useEffect(() => {
    let active = true
    const saved = cache.get(key)
    if (saved) {
      // Hydrate the keyed external cache when navigating between team screens.
      setSnapshot({ key, data: saved.data as T, loading: false })
    } else {
      void AsyncStorage.getItem(`npl-resource-${key}`).then(value => {
        if (active && value) { try { const data = JSON.parse(value) as T; setSnapshot(previous => previous.key === key && (previous.data !== undefined || !previous.loading) ? previous : { key, data, loading: true }) } catch { /* Ignore damaged snapshots. */ } }
      }).catch(() => undefined)
    }
    if (!saved || Date.now() - saved.time > 120_000) void refresh()
    return () => { active = false; controller.current?.abort(); controller.current = null }
  }, [key, refresh])
  return { data: snapshot.key === key ? snapshot.data : undefined, loading: snapshot.key === key ? snapshot.loading : true, error: snapshot.key === key ? snapshot.error : undefined, refresh }
}
