import { useEffect, useRef } from 'react'

const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@nplzimbabwe'
const X_PROFILE_URL = 'https://x.com/nplzimbabwe'

// Live stream embed for NPL Zimbabwe YouTube channel.
const YOUTUBE_EMBED_URL =
  'https://www.youtube.com/embed/live_stream?channel=UCZK0q-HMFz_OnmJi3u5mpiw&autoplay=0&rel=0'

// To show latest channel videos instead of the live player, use this line instead:
// const YOUTUBE_EMBED_URL =
//   'https://www.youtube.com/embed/videoseries?list=UUZK0q-HMFz_OnmJi3u5mpiw'

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
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://platform.twitter.com/widgets.js"]',
    )

    if (existingScript) {
      window.twttr?.widgets?.load(twitterRef.current)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    script.charset = 'utf-8'
    script.onload = () => {
      window.twttr?.widgets?.load(twitterRef.current)
    }

    document.body.appendChild(script)
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
            <a href={X_PROFILE_URL} target="_blank" rel="noreferrer">
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
