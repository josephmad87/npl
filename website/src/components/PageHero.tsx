import siteLogoUrl from '../assets/logo.jpeg'

export function PageHero({
  title,
  subtitle,
  imageUrl,
  badgeSrc,
  variant = 'default',
  fullWidth = false,
  titleAlign = 'start',
  className,
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
  /** Horizontal alignment of badge + title + subtitle in the overlay. */
  titleAlign?: 'start' | 'center'
  /** Extra section classes (e.g. alignment with site header on team detail). */
  className?: string
}) {
  const isSiteLogo = variant === 'siteLogo'
  const coverSrc = isSiteLogo ? null : imageUrl
  const titleBlockClass =
    titleAlign === 'center'
      ? 'ui-page-hero__title-block ui-page-hero__title-block--center'
      : 'ui-page-hero__title-block'
  const rootClass = [
    'ui-page-hero',
    isSiteLogo ? 'ui-page-hero--site-logo' : '',
    fullWidth ? 'ui-page-hero--bleed' : '',
    className?.trim() ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <section className={rootClass}>
      {isSiteLogo ? (
        <div className="ui-page-hero__brand-mark">
          <img src={siteLogoUrl} alt="NPL logo" />
        </div>
      ) : coverSrc ? (
        <img src={coverSrc} alt={title} />
      ) : null}
      <div
        className={`ui-page-hero-overlay${
          isSiteLogo && titleAlign === 'start' && badgeSrc
            ? ' ui-page-hero-overlay--site-logo-title-start'
            : ''
        }`}
      >
        <div className={titleBlockClass}>
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
