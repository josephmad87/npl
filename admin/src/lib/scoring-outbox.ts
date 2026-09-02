import type { LiveBallEventInput } from '@/lib/api-types'

export type QueuedBallPayload = {
  body: LiveBallEventInput
  newBatterId?: number | null
  strikeRuns?: number
}

export type ScoringOutboxEntry = {
  id: string
  matchId: number
  payload: QueuedBallPayload
  queuedAt: string
  attempts: number
  lastError: string | null
}

function storageKey(matchId: number): string {
  return `npl:scorer:delivery-outbox:v2:${matchId}`
}

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function loadScoringOutbox(matchId: number): ScoringOutboxEntry[] {
  const storage = browserStorage()
  if (!storage) return []
  try {
    const parsed = JSON.parse(storage.getItem(storageKey(matchId)) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is ScoringOutboxEntry => {
      if (!entry || typeof entry !== 'object') return false
      const row = entry as Partial<ScoringOutboxEntry>
      return (
        row.matchId === matchId &&
        typeof row.id === 'string' &&
        typeof row.payload?.body?.client_event_id === 'string'
      )
    })
  } catch {
    storage.removeItem(storageKey(matchId))
    return []
  }
}

export function saveScoringOutbox(
  matchId: number,
  entries: ScoringOutboxEntry[],
): void {
  const storage = browserStorage()
  if (!storage) return
  try {
    if (entries.length === 0) {
      storage.removeItem(storageKey(matchId))
      return
    }
    storage.setItem(storageKey(matchId), JSON.stringify(entries))
  } catch {
    // The in-memory queue remains available even if private browsing or a
    // storage quota prevents persistence. The scoring UI still reports sync.
  }
}

export function enqueueScoringBall(
  entries: ScoringOutboxEntry[],
  matchId: number,
  payload: QueuedBallPayload,
  error: string | null = null,
): ScoringOutboxEntry[] {
  const id = payload.body.client_event_id
  if (!id) throw new Error('Offline scoring requires a client event id.')
  if (entries.some((entry) => entry.id === id)) return entries
  return [
    ...entries,
    {
      id,
      matchId,
      payload,
      queuedAt: new Date().toISOString(),
      attempts: 0,
      lastError: error,
    },
  ]
}

export function markScoringAttempt(
  entries: ScoringOutboxEntry[],
  id: string,
  error: string | null,
): ScoringOutboxEntry[] {
  return entries.map((entry) =>
    entry.id === id
      ? { ...entry, attempts: entry.attempts + 1, lastError: error }
      : entry,
  )
}

export function removeScoringBall(
  entries: ScoringOutboxEntry[],
  id: string,
): ScoringOutboxEntry[] {
  return entries.filter((entry) => entry.id !== id)
}
