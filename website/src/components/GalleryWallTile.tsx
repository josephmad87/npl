import { extractYouTubeVideoId } from '../lib/youtube'
import { resolveMediaUrl } from '../lib/publicApi'
import { ResponsiveImage } from './ResponsiveImage'
import { SiteLogoPlaceholder } from './SiteLogoPlaceholder'
import { YouTubeThumbnail } from './YouTubeThumbnail'

type GalleryWallItem = {
  id: number
  title: string
  media_type: string
  file_url: string
  thumbnail_url?: string | null
}

export function GalleryWallTile({
  item,
  priority = false,
  onOpen,
}: {
  item: GalleryWallItem
  priority?: boolean
  onOpen: (item: GalleryWallItem) => void
}) {
  const youtubeId = extractYouTubeVideoId(item.file_url) ?? extractYouTubeVideoId(item.thumbnail_url ?? null)
  const isVideo = item.media_type === 'video' || youtubeId !== null
  const image = resolveMediaUrl(item.thumbnail_url ?? item.file_url)

  return (
    <button
      className="gallery-wall__tile"
      type="button"
      onClick={() => onOpen(item)}
      aria-label={`${isVideo ? 'Play video' : 'View photo'}: ${item.title}`}
    >
      {youtubeId ? (
        <YouTubeThumbnail videoId={youtubeId} alt="" />
      ) : image ? (
        <ResponsiveImage
          src={image}
          alt=""
          widths={[320, 480, 720, 960]}
          sizes="(max-width: 680px) 100vw, (max-width: 1100px) 50vw, 45vw"
          fallbackWidth={720}
          priority={priority}
        />
      ) : (
        <SiteLogoPlaceholder />
      )}
      {isVideo ? (
        <span className="gallery-wall__play" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="m8 5 11 7-11 7V5Z" /></svg>
        </span>
      ) : null}
    </button>
  )
}
