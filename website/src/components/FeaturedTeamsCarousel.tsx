import { useCallback, useRef, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { preferredScrollBehavior } from '@npl/ui/accessibility'
import { SectionHeader } from './SectionHeader'
import { SiteLogoPlaceholder } from './SiteLogoPlaceholder'
import type { TeamLite } from '../lib/hooks'
import { resolveMediaUrl } from '../lib/publicApi'
import { ResponsiveImage } from './ResponsiveImage'

export function FeaturedTeamsCarousel({
  teams,
  title = 'Featured Teams',
  linkTo = '/mens/teams',
  description,
}: {
  teams: TeamLite[]
  title?: string
  linkTo?: string
  description?: ReactNode
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  const scrollBy = useCallback((direction: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('.featured-teams-carousel__card')
    const gap = 16
    const step = card ? card.offsetWidth + gap : Math.min(el.clientWidth * 0.5, 240)
    el.scrollBy({ left: direction * step, behavior: preferredScrollBehavior() })
  }, [])

  if (teams.length === 0) return null

  return (
    <section className="home-section home-featured-teams" aria-label={title}>
      <div className="featured-teams-carousel__toolbar">
        <div className="featured-teams-carousel__header-wrap">
          <SectionHeader title={title} linkTo={linkTo} description={description} />
        </div>
        <div className="featured-teams-carousel__nav" aria-label="Scroll teams">
          <button type="button" className="featured-teams-carousel__nav-btn" aria-label="Scroll left" onClick={() => scrollBy(-1)}>
            <span aria-hidden="true">‹</span>
          </button>
          <button type="button" className="featured-teams-carousel__nav-btn" aria-label="Scroll right" onClick={() => scrollBy(1)}>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>

      <div ref={trackRef} className="featured-teams-carousel__track">
        {teams.map((team) => {
          const image = resolveMediaUrl(team.cover_image_url) ?? resolveMediaUrl(team.logo_url)
          return (
            <Link
              key={team.id}
              to="/teams/$slug"
              params={{ slug: team.slug }}
              className="featured-teams-carousel__card"
              aria-label={team.name}
            >
              {image ? (
                <ResponsiveImage
                  src={image}
                  alt=""
                  widths={[240, 360, 480]}
                  sizes="240px"
                  fallbackWidth={360}
                />
              ) : (
                <SiteLogoPlaceholder className="featured-teams-carousel__placeholder" />
              )}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
