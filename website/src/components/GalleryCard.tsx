import { extractYouTubeVideoId } from '../lib/youtube'
import { resolveMediaUrl } from '../lib/publicApi'
import { SiteLogoPlaceholder } from './SiteLogoPlaceholder'
import { YouTubeThumbnail } from './YouTubeThumbnail'

type GalleryItem = {
  id: number
  title: string
  media_type: string
  file_url: string
  thumbnail_url?: string | null
}

type GalleryBadgeVariant = 'youtube' | 'image' | 'video' | 'other'

function galleryMediaBadge(
  item: GalleryItem,
  youtubeVideoId: string | null,
): { variant: GalleryBadgeVariant; label: string } {
  if (youtubeVideoId) {
    return { variant: 'youtube', label: 'YouTube' }
  }
  const t = (item.media_type ?? '').toLowerCase().trim()
  if (t === 'image') return { variant: 'image', label: 'Image' }
  if (t === 'video') return { variant: 'video', label: 'Video' }
  const raw = item.media_type?.trim()
  if (raw) {
    return {
      variant: 'other',
      label: raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase(),
    }
  }
  return { variant: 'other', label: 'Media' }
}

export function GalleryCard({
  item,
  onOpen,
}: {
  item: GalleryItem
  onOpen?: (item: GalleryItem) => void
}) {
  const ytId = extractYouTubeVideoId(item.file_url) ?? extractYouTubeVideoId(item.thumbnail_url ?? null)
  const resolvedThumb = resolveMediaUrl(item.thumbnail_url ?? item.file_url)
  const badge = galleryMediaBadge(item, ytId)

  return (
    <button type="button" className="ui-gallery-card" onClick={() => onOpen?.(item)}>
      {ytId ? (
        <YouTubeThumbnail videoId={ytId} alt={item.title} />
      ) : resolvedThumb ? (
        <img src={resolvedThumb} alt={item.title} loading="lazy" decoding="async" />
      ) : (
        <SiteLogoPlaceholder className="ui-gallery-card-placeholder" />
      )}
      <div className="ui-gallery-card__body">
        <span
          className={`ui-gallery-card__badge ui-gallery-card__badge--${badge.variant}`}
        >
          {badge.label}
        </span>
        <h3 className="ui-gallery-card__title">{item.title}</h3>
      </div>
    </button>
  )
}
