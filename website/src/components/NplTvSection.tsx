import { useEffect, useRef } from 'react'

const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@nplzimbabwe'
const X_PROFILE_URL = 'https://twitter.com/nplzimbabwe'
const X_PROFILE_DISPLAY_URL = 'https://x.com/nplzimbabwe'

// Latest uploads playlist for NPL Zimbabwe.
// This is more reliable than live_stream because it still shows videos when the channel is not live.
const YOUTUBE_EMBED_URL =
  'https://www.youtube.com/embed/videoseries?list=UUZK0q-HMFz_OnmJi3u5mpiw&rel=0'

// Later, for a live-only player, change the line above to:
// const YOUTUBE_EMBED_URL =
//   'https://www.youtube.com/embed/live_stream?channel=UCZK0q-HMFz_OnmJi3u5mpiw&autoplay=0&rel=0'

declare global {
  interface Window {
    twttr?: {
      widgets?: {
        load: (element?: HTMLElement | null) => void
      }
    }
  }
}

export function NplTvSection() {
  const twitterRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = twitterRef.current

    if (!element) {
      return
    }

    let cancelled = false

    const renderTimeline = () => {
      if (cancelled) return
      window.twttr?.widgets?.load(element)
    }

    if (window.twttr?.widgets?.load) {
      renderTimeline()
      return
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script#twitter-wjs',
    )

    if (existingScript) {
      existingScript.addEventListener('load', renderTimeline, { once: true })

      return () => {
        cancelled = true
        existingScript.removeEventListener('load', renderTimeline)
      }
    }

    const script = document.createElement('script')
    script.id = 'twitter-wjs'
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    script.charset = 'utf-8'
    script.onload = renderTimeline

    document.body.appendChild(script)

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="home-section npl-tv-section" aria-labelledby="npl-tv-title">
      <div className="ui-section-header npl-tv-section__header">
        <div>
          <h2 id="npl-tv-title">NPL TV</h2>
          <p>Watch NPL broadcasts and follow the latest updates from NPL Zimbabwe.</p>
        </div>
      </div>

      <div className="npl-tv-grid">
        <article className="npl-tv-card npl-tv-card--video">
          <div className="npl-tv-card__head">
            <div>
              <p className="npl-tv-card__eyebrow">Live & replays</p>
              <h3>NPL Zimbabwe on YouTube</h3>
            </div>
            <a href={YOUTUBE_CHANNEL_URL} target="_blank" rel="noreferrer">
              Open YouTube
            </a>
          </div>

          <div className="npl-tv-video">
            <iframe
              src={YOUTUBE_EMBED_URL}
              title="NPL TV YouTube player"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </article>

        <article className="npl-tv-card npl-tv-card--social">
          <div className="npl-tv-card__head">
            <div>
              <p className="npl-tv-card__eyebrow">Latest posts</p>
              <h3>NPL Zimbabwe on X</h3>
            </div>
            <a href={X_PROFILE_DISPLAY_URL} target="_blank" rel="noreferrer">
              Open X
            </a>
          </div>

          <div ref={twitterRef} className="npl-tv-twitter">
            <a
              className="twitter-timeline"
              data-height="430"
              data-theme="light"
              data-chrome="nofooter noborders transparent"
              href={X_PROFILE_URL}
            >
              Posts by NPL Zimbabwe
            </a>
          </div>
        </article>
      </div>
    </section>
  )
}
