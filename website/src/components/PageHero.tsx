import siteLogoUrl from '../assets/logo.jpeg'

export function PageHero({
  title,
  subtitle,
  imageUrl,
  badgeSrc,
  variant = 'default',
  fullWidth = false,
}: {
  title: string
  subtitle?: string
  imageUrl?: string | null
  /** Small crest/badge shown above the title (e.g. team logo on team detail). */
  badgeSrc?: string | null
  /** Full-width brand strip: site logo, title overlay */
  variant?: 'default' | 'siteLogo'
  /** Edge-to-edge (sibling to `.container`, no side padding) */
  fullWidth?: boolean
}) {
  const isSiteLogo = variant === 'siteLogo'
  const coverSrc = isSiteLogo ? null : imageUrl
  return (
    <section
      className={`ui-page-hero${isSiteLogo ? ' ui-page-hero--site-logo' : ''}${
        fullWidth ? ' ui-page-hero--bleed' : ''
      }`}
    >
      {isSiteLogo ? (
        <div className="ui-page-hero__brand-mark">
          <img src={siteLogoUrl} alt="NPL logo" />
        </div>
      ) : coverSrc ? (
        <img src={coverSrc} alt={title} />
      ) : null}
      <div className="ui-page-hero-overlay">
        <div className="ui-page-hero__title-block">
          {badgeSrc ? (
            <img
              className="ui-page-hero__badge"
              src={badgeSrc}
              alt={`${title} crest`}
            />
          ) : null}
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
    </section>
  )
}
