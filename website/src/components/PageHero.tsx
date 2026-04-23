import siteLogoUrl from '../assets/logo.jpeg'

export function PageHero({
  title,
  subtitle,
  imageUrl,
  variant = 'default',
  fullWidth = false,
}: {
  title: string
  subtitle?: string
  imageUrl?: string | null
  /** Full-width brand strip: site logo, title overlay */
  variant?: 'default' | 'siteLogo'
  /** Edge-to-edge (sibling to `.container`, no side padding) */
  fullWidth?: boolean
}) {
  const isSiteLogo = variant === 'siteLogo'
  const resolvedSrc = isSiteLogo ? siteLogoUrl : imageUrl
  return (
    <section
      className={`ui-page-hero${isSiteLogo ? ' ui-page-hero--site-logo' : ''}${
        fullWidth ? ' ui-page-hero--bleed' : ''
      }`}
    >
      {resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={isSiteLogo ? 'NPL logo' : title}
        />
      ) : null}
      <div className="ui-page-hero-overlay">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </section>
  )
}
