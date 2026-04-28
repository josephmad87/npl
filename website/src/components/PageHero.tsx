import { useQuery } from '@tanstack/react-query'
import siteLogoUrl from '../assets/logo.jpeg'
import { extractList, fetchJson, resolveMediaUrl } from '../lib/publicApi'

type HeroGalleryItem = {
  file_url?: string | null
  thumbnail_url?: string | null
}

type HeroNewsItem = {
  featured_image_url?: string | null
}

function useRandomHeroImage() {
  const { data: images = [] } = useQuery({
    queryKey: ['hero-random-image-pool'],
    queryFn: async () => {
      const [galleryPayload, newsPayload] = await Promise.all([
        fetchJson<unknown>('/public/gallery?page=1&page_size=30'),
        fetchJson<unknown>('/public/news?page=1&page_size=30'),
      ])

      const gallery = extractList<HeroGalleryItem>(galleryPayload)
      const news = extractList<HeroNewsItem>(newsPayload)

      const pool = [
        ...gallery
          .map((item) => resolveMediaUrl(item.thumbnail_url ?? item.file_url))
          .filter((url): url is string => Boolean(url)),
        ...news
          .map((item) => resolveMediaUrl(item.featured_image_url))
          .filter((url): url is string => Boolean(url)),
      ]

      return [...new Set(pool)]
    },
    staleTime: 1000 * 60 * 10,
    retry: 1,
  })

  if (images.length === 0) return null
  const idx = Math.floor(Math.random() * images.length)
  return images[idx] ?? null
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
  const randomHeroImage = useRandomHeroImage()
  const isSiteLogo = variant === 'siteLogo'
  const coverSrc = imageUrl?.trim() ?? randomHeroImage
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
        <img src={coverSrc} alt={title} />
      ) : null}
      {isSiteLogo ? (
        <div className="ui-page-hero__brand-mark">
          <img src={siteLogoUrl} alt="NPL logo" />
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
