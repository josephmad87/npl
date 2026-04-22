import { extractYouTubeVideoId } from '../lib/youtube'
import { resolveMediaUrl } from '../lib/publicApi'
import { YouTubeThumbnail } from './YouTubeThumbnail'

type GalleryItem = {
  id: number
  title: string
  media_type: string
  file_url: string
  thumbnail_url?: string | null
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

  return (
    <button type="button" className="ui-gallery-card" onClick={() => onOpen?.(item)}>
      {ytId ? (
        <YouTubeThumbnail videoId={ytId} alt={item.title} />
      ) : resolvedThumb ? (
        <img src={resolvedThumb} alt={item.title} loading="lazy" decoding="async" />
      ) : (
        <div className="ui-gallery-card-placeholder" />
      )}
      <div>
        <p>{ytId ? 'YouTube' : item.media_type}</p>
        <h3>{item.title}</h3>
      </div>
    </button>
  )
}
