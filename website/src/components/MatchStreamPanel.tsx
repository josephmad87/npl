import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { supporterFetch, useSupporterSession } from '../lib/supporterApi'
import { extractYouTubeVideoId, getYouTubeEmbedUrl } from '../lib/youtube'

type MatchStreamPanelProps = Readonly<{
  matchId: number
  streamLabel?: string | null
  homeName: string
  awayName: string
  isLive?: boolean
}>

type MatchStreamAccess = {
  match_id: number
  stream_url: string
  stream_label: string | null
}

function isHlsStream(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.m3u8')
  } catch {
    return url.toLowerCase().includes('.m3u8')
  }
}

export function MatchStreamPanel({
  matchId,
  streamLabel,
  homeName,
  awayName,
  isLive = false,
}: MatchStreamPanelProps) {
  const supporterSession = useSupporterSession()
  const [playerLoaded, setPlayerLoaded] = useState(false)
  const [streamAccess, setStreamAccess] = useState<MatchStreamAccess | null>(null)
  const [streamLoading, setStreamLoading] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const streamUrl = streamAccess?.stream_url ?? ''
  const youtubeId = useMemo(() => extractYouTubeVideoId(streamUrl), [streamUrl])
  const hls = useMemo(() => isHlsStream(streamUrl), [streamUrl])
  const label = streamAccess?.stream_label?.trim() || streamLabel?.trim() || 'NPL Live'

  const loadStream = async () => {
    if (!supporterSession || streamLoading) return
    setStreamLoading(true)
    setStreamError(null)
    try {
      const access = await supporterFetch<MatchStreamAccess>(`/public/matches/${matchId}/stream`)
      setStreamAccess(access)
      setPlayerLoaded(true)
    } catch (error) {
      setStreamError(error instanceof Error ? error.message : 'Could not open this broadcast.')
    } finally {
      setStreamLoading(false)
    }
  }

  return (
    <section className="match-stream" aria-label="Official NPL broadcast">
      <div className="match-stream__head">
        <div>
          <span className="match-stream__eyebrow">Official broadcast</span>
          <h3>{label}</h3>
          <p>{homeName} vs {awayName}</p>
        </div>
        <span className={`match-stream__state${isLive ? ' is-live' : ''}`}>
          <span aria-hidden /> {isLive ? 'LIVE' : 'REPLAY'}
        </span>
      </div>

      <div className="match-stream__player">
        {!supporterSession ? (
          <div className="match-stream__gate">
            <span className="match-stream__lock" aria-hidden>🔒</span>
            <strong>Sign in to watch this NPL broadcast</strong>
            <small>Live video is available to signed-in NPL fans.</small>
            <Link to="/my-npl">Sign in or create a fan account</Link>
          </div>
        ) : !playerLoaded ? (
          <button
            type="button"
            className="match-stream__launch"
            onClick={() => void loadStream()}
            disabled={streamLoading}
          >
            <span className="match-stream__play" aria-hidden>▶</span>
            <strong>{streamLoading ? 'Opening broadcast…' : isLive ? 'Watch live' : 'Watch broadcast'}</strong>
            <small>Available to signed-in NPL fans</small>
          </button>
        ) : youtubeId ? (
          <iframe
            src={getYouTubeEmbedUrl(youtubeId, { autoplay: true })}
            title={`${label}: ${homeName} vs ${awayName}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : hls ? (
          <video src={streamUrl} controls autoPlay playsInline>
            Your browser cannot play this stream. Open it using the broadcast link below.
          </video>
        ) : (
          <div className="match-stream__external">
            <span className="match-stream__play" aria-hidden>↗</span>
            <strong>The broadcast opens on the official provider.</strong>
            <a href={streamUrl} target="_blank" rel="noreferrer">Open official stream</a>
          </div>
        )}
      </div>

      {streamError ? <p className="match-stream__error" role="alert">{streamError}</p> : null}

      <div className="match-stream__foot">
        <span>Video and live scores may be a few seconds apart.</span>
        {streamUrl ? <a href={streamUrl} target="_blank" rel="noreferrer">Open stream separately ↗</a> : null}
      </div>
    </section>
  )
}
