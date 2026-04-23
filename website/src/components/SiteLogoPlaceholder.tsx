import siteLogoUrl from '../assets/logo.jpeg'

/** Decorative fill when a non-player card has no image yet (teams, news, gallery, venue, etc.). */
export function SiteLogoPlaceholder({ className }: { className?: string }) {
  return (
    <img
      src={siteLogoUrl}
      alt=""
      aria-hidden
      decoding="async"
      loading="lazy"
      className={className}
    />
  )
}
