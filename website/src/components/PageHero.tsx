import { useQuery } from '@tanstack/react-query'
import siteLogoUrl from '../assets/logo-optimized.png'
import { fetchJson, resolveMediaUrl } from '../lib/publicApi'
import { ResponsiveImage } from './ResponsiveImage'

function useRandomHeroImage(enabled: boolean) {
  const { data: image = null } = useQuery({
    queryKey: ['hero-random-image-pool'],
    queryFn: async () => {
      const payload = await fetchJson<{ images: string[] }>('/public/hero-images')
      const images = payload.images
        .map((url) => resolveMediaUrl(url))
        .filter((url): url is string => Boolean(url))
      if (images.length === 0) return null
      const idx = Math.floor(Math.random() * images.length)
      return images[idx] ?? null
    },
    staleTime: 1000 * 60 * 10,
    retry: 1,
    enabled,
  })

  return image
}

export function PageHero({
  title,
  subtitle,
  imageUrl,
  badgeSrc,
  variant = 'default',
  fullWidth = false,
  titleAlign = 'start',
  className,
  fallbackMode = 'related',
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
  /** Related = random gallery/news fallback, none = no image fallback. */
  fallbackMode?: 'related' | 'none'
}) {
  const isSiteLogo = variant === 'siteLogo'
  const randomHeroImage = useRandomHeroImage(fallbackMode === 'related')
  const explicitImage = imageUrl?.trim() ?? ''
  const coverSrc = explicitImage || (fallbackMode === 'related' ? randomHeroImage : null)
  const showSiteLogoMark = isSiteLogo && !coverSrc
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
      {coverSrc ? (
        <ResponsiveImage
          src={coverSrc}
          alt=""
          widths={[480, 768, 1024, 1280, 1600]}
          sizes="100vw"
          fallbackWidth={1280}
          priority
        />
      ) : null}
      {showSiteLogoMark ? (
        <div className="ui-page-hero__brand-mark">
          <ResponsiveImage
            src={siteLogoUrl}
            alt=""
            widths={[320, 480, 720]}
            sizes="(max-width: 700px) 70vw, 420px"
            fallbackWidth={480}
            priority
          />
        </div>
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
