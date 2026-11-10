import { useEffect, useState } from 'react'

/** Freshness describes successful retrieval, not the time the scorer entered a ball. */
export function ScoreFreshness({ updatedAt, failed }: { updatedAt: number; failed: boolean }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000)
    return () => window.clearInterval(timer)
  }, [])
  const stale = failed || !updatedAt || now - updatedAt > 30_000
  return (
    <p className="muted" role="status">
      {stale ? 'Updates delayed. Scores may be out of date. ' : 'Scores checked '}
      {updatedAt ? <time dateTime={new Date(updatedAt).toISOString()}>{new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time> : 'Waiting for a connection.'}
    </p>
  )
}
