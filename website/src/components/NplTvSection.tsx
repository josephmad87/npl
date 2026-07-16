import { useEffect } from 'react'

const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@nplzimbabwe'
const X_PROFILE_URL = 'https://x.com/nplzimbabwe'

const YOUTUBE_EMBED_URL =
  'https://www.youtube.com/embed/videoseries?list=UUZK0q-HMFz_OnmJi3u5mpiw&rel=0'

export function NplTvSection() {
  useEffect(() => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://elfsightcdn.com/platform.js"]',
    )

    if (existingScript) {
      return
    }

    const script = document.createElement('script')
    script.src = 'https://elfsightcdn.com/platform.js'
    script.async = true

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

          <div className="npl-tv-elfsight">
            <div
              className="elfsight-app-78fc0cb4-0a99-433d-9e17-f3b641a46c96"
              data-elfsight-app-lazy=""
            />
          </div>
        </article>
      </div>
    </section>
  )
}
