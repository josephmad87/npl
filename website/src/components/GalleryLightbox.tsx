import { extractYouTubeVideoId, getYouTubeEmbedUrl } from '../lib/youtube'
import { resolveMediaUrl } from '../lib/publicApi'
import { MediaLightbox } from './MediaLightbox'

export type GalleryLightboxItem = {
  id: number
  title: string
  media_type: string
  file_url: string
  thumbnail_url?: string | null
}

export function GalleryLightbox({
  active,
  onClose,
}: {
  active: GalleryLightboxItem | null
  onClose: () => void
}) {
  if (!active) return null

  const ytId =
    extractYouTubeVideoId(active.file_url) ?? extractYouTubeVideoId(active.thumbnail_url ?? null)
  const isYouTube = ytId !== null
  const isVideo = active.media_type === 'video' || isYouTube

  const media =
    isVideo && isYouTube && ytId ? (
      <iframe
        className="media-lightbox__youtube"
        src={getYouTubeEmbedUrl(ytId, { autoplay: true, mute: true })}
        title={active.title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    ) : isVideo ? (
      <video
        src={resolveMediaUrl(active.file_url) ?? ''}
        controls
        autoPlay
        playsInline
        className="media-lightbox__native-video"
      />
    ) : (
      <img src={resolveMediaUrl(active.file_url) ?? ''} alt={active.title} className="media-lightbox__image" />
    )

  return (
    <MediaLightbox key={active.id} open onClose={onClose} title={active.title} ariaLabel={active.title}>
      {media}
    </MediaLightbox>
  )
}
