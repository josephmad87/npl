import { useEffect, useRef } from 'react'

const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@nplzimbabwe'
const X_PROFILE_URL = 'https://x.com/nplzimbabwe'

const YOUTUBE_EMBED_URL =
  'https://www.youtube.com/embed/videoseries?list=UUZK0q-HMFz_OnmJi3u5mpiw&rel=0'

declare global {
  interface Window {
    twttr?: {
      widgets?: {
        load: (element?: HTMLElement | null) => void
        createTimeline: (
          source: { sourceType: 'profile'; screenName: string },
          element: HTMLElement,
          options?: {
            height?: number
            chrome?: string
            theme?: 'light' | 'dark'
            dnt?: boolean
          },
        ) => Promise<HTMLElement>
      }
    }
  }
}

function loadTwitterWidgets(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.twttr?.widgets?.createTimeline) {
      resolve()
      return
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script#twitter-wjs',
    )

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('X script failed to load')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.id = 'twitter-wjs'
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    script.charset = 'utf-8'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('X script failed to load'))

    document.body.appendChild(script)
  })
}

export function NplTvSection() {
  const twitterRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false

    async function renderTimeline() {
      const element = twitterRef.current

      if (!element) {
        return
      }

      element.innerHTML = ''

      try {
        await loadTwitterWidgets()

        if (cancelled || !window.twttr?.widgets?.createTimeline) {
          return
        }

        await window.twttr.widgets.createTimeline(
          {
            sourceType: 'profile',
            screenName: 'nplzimbabwe',
          },
          element,
          {
            height: 430,
            chrome: 'nofooter noborders transparent',
            theme: 'light',
            dnt: true,
          },
        )
      } catch {
        if (!cancelled) {
          element.innerHTML =
            '<p class="npl-tv-twitter__fallback">Unable to load the X feed here. Please use the Open X button above.</p>'
        }
      }
    }

    void renderTimeline()

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
            <a href={X_PROFILE_URL} target="_blank" rel="noreferrer">
              Open X
            </a>
          </div>

          <div ref={twitterRef} className="npl-tv-twitter">
            <p className="npl-tv-twitter__fallback">Loading X feed…</p>
          </div>
        </article>
      </div>
    </section>
  )
}
