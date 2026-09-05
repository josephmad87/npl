import { useState, type ReactNode } from 'react'
import siteLogoUrl from '../assets/logo-optimized.png'
import { ResponsiveImage } from './ResponsiveImage'
import { managedSection, useSitePageContent } from '../lib/siteContent'
import { ManagedSiteHtml } from './ManagedSiteHtml'

const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@nplzimbabwe'
const X_PROFILE_URL = 'https://x.com/nplzimbabwe'

const YOUTUBE_EMBED_URL =
  'https://www.youtube.com/embed/videoseries?list=UUZK0q-HMFz_OnmJi3u5mpiw&rel=0'

export function NplTvSection({
  title = 'NPL TV',
  description,
}: {
  title?: string
  description?: ReactNode
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const contentQ = useSitePageContent('home')
  const youtubeContent = managedSection(contentQ.data, 'npl-tv-youtube', 'NPL Zimbabwe on YouTube')
  const socialContent = managedSection(contentQ.data, 'npl-tv-social', 'NPL Zimbabwe on X')

  return (
    <section className="home-section npl-tv-section" aria-labelledby="npl-tv-title">
      <div className="ui-section-header npl-tv-section__header">
        <div>
          <h2 id="npl-tv-title">{title}</h2>
          {description ? <div className="ui-section-header-description">{description}</div> : null}
        </div>
      </div>

      <div className="npl-tv-grid">
        <article className="npl-tv-card npl-tv-card--video">
          <div className="npl-tv-card__head">
            <div>
              <p className="npl-tv-card__eyebrow">Live & replays</p>
              <h3>{youtubeContent.heading}</h3>
              <ManagedSiteHtml html={youtubeContent.body_html} />
            </div>
            <a href={YOUTUBE_CHANNEL_URL} target="_blank" rel="noreferrer">
              Open YouTube
            </a>
          </div>

          <div className="npl-tv-video">
            {isPlaying ? (
              <iframe
                src={`${YOUTUBE_EMBED_URL}&autoplay=1`}
                title="NPL TV YouTube player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <button
                type="button"
                className="npl-tv-video__preview"
                onClick={() => setIsPlaying(true)}
                aria-label="Load and play NPL TV from YouTube"
              >
                <ResponsiveImage
                  src={siteLogoUrl}
                  alt=""
                  widths={[320, 480, 720]}
                  sizes="(max-width: 900px) 100vw, 60vw"
                  fallbackWidth={720}
                />
                <span className="npl-tv-video__play" aria-hidden="true">▶</span>
                <strong>Click to play NPL TV</strong>
                <small>YouTube loads only after you choose to play.</small>
              </button>
            )}
          </div>
        </article>

        <article className="npl-tv-card npl-tv-card--social">
          <div className="npl-tv-card__head">
            <div>
              <p className="npl-tv-card__eyebrow">Latest posts</p>
              <h3>{socialContent.heading}</h3>
              <ManagedSiteHtml html={socialContent.body_html} />
            </div>
            <a href={X_PROFILE_URL} target="_blank" rel="noreferrer">
              Open X
            </a>
          </div>

          <div className="npl-tv-social-fallback">
            <p className="npl-tv-social-fallback__handle">@nplzimbabwe</p>
            <a href={X_PROFILE_URL} target="_blank" rel="noreferrer">
              Follow NPL Zimbabwe on X
            </a>
          </div>
        </article>
      </div>
    </section>
  )
}
