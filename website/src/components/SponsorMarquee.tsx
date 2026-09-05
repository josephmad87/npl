import type { ReactNode } from 'react'
import { ResponsiveImage } from './ResponsiveImage'

type Sponsor = {
  id: number
  name: string
  image_url: string
  link_url?: string | null
  team_id?: number | null
  team_name?: string | null
}

type SponsorMarqueeProps = Readonly<{
  title?: string
  description?: ReactNode
  sponsors: Sponsor[]
}>

export function SponsorMarquee({
  title = 'Partners & Sponsors',
  description,
  sponsors,
}: SponsorMarqueeProps) {
  const visibleSponsors = sponsors.filter((s) => s.image_url)

  if (visibleSponsors.length === 0) {
    return null
  }

  const marqueeSponsors =
    visibleSponsors.length >= 4
      ? [...visibleSponsors, ...visibleSponsors]
      : [...visibleSponsors, ...visibleSponsors, ...visibleSponsors]

  return (
    <section className="sponsor-marquee-section">
      <h2>{title}</h2>
      {description ? <div className="ui-section-header-description">{description}</div> : null}

      <div className="sponsor-marquee" aria-label={title}>
        <div className="sponsor-marquee__track">
          {marqueeSponsors.map((s, index) => {
            const logo = (
              <ResponsiveImage
                src={s.image_url}
                alt={s.name}
                className="sponsor-marquee__logo"
                widths={[160, 240, 320]}
                sizes="160px"
                fallbackWidth={240}
              />
            )

            return (
              <div
                className="sponsor-marquee__item"
                key={`${s.id}-${index}`}
              >
                {s.link_url ? (
                  <a
                    href={s.link_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={s.name}
                  >
                    {logo}
                  </a>
                ) : (
                  logo
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
