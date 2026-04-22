import { useEffect } from 'react'
import { extractYouTubeVideoId, getYouTubeEmbedUrl } from '../lib/youtube'
import { resolveMediaUrl } from '../lib/publicApi'

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
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active, onClose])

  if (!active) return null

  const ytId =
    extractYouTubeVideoId(active.file_url) ?? extractYouTubeVideoId(active.thumbnail_url ?? null)
  const isYouTube = ytId !== null
  const isVideo = active.media_type === 'video' || isYouTube

  return (
    <div className="lightbox-modal" role="dialog" aria-modal="true" aria-label={active.title} onClick={onClose}>
      <div className="lightbox-modal-content" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="lightbox-modal-close" onClick={onClose}>
          Close
        </button>
        {isVideo && isYouTube && ytId ? (
          <iframe
            className="lightbox-youtube-embed"
            src={getYouTubeEmbedUrl(ytId, { autoplay: true, mute: true })}
            title={active.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : isVideo ? (
          <video src={resolveMediaUrl(active.file_url) ?? ''} controls autoPlay playsInline className="lightbox-native-video" />
        ) : (
          <img src={resolveMediaUrl(active.file_url) ?? ''} alt={active.title} />
        )}
        <p className="lightbox-modal-title">{active.title}</p>
      </div>
    </div>
  )
}
