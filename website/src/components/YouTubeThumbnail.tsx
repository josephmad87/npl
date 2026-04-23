import { useCallback, useState } from 'react'
import siteLogoUrl from '../assets/logo.jpeg'
import { type YouTubeThumbQuality, getYouTubeThumbnailUrl } from '../lib/youtube'

const FALLBACK_ORDER: YouTubeThumbQuality[] = ['maxresdefault', 'hqdefault', 'mqdefault', 'default']

export function YouTubeThumbnail({
  videoId,
  alt,
  className,
  placeholderClassName = 'ui-gallery-card-placeholder',
}: {
  videoId: string
  alt: string
  className?: string
  placeholderClassName?: string
}) {
  const [index, setIndex] = useState(0)
  const [exhausted, setExhausted] = useState(false)

  const onError = useCallback(() => {
    setIndex((i) => {
      if (i + 1 < FALLBACK_ORDER.length) return i + 1
      setExhausted(true)
      return i
    })
  }, [])

  if (exhausted) {
    return (
      <img
        src={siteLogoUrl}
        alt={alt}
        className={placeholderClassName}
        loading="lazy"
        decoding="async"
      />
    )
  }

  const quality = FALLBACK_ORDER[Math.min(index, FALLBACK_ORDER.length - 1)] ?? 'hqdefault'
  const src = getYouTubeThumbnailUrl(videoId, quality)

  return (
    <img
      key={src}
      src={src}
      alt={alt}
      className={className}
      onError={onError}
      loading="lazy"
      decoding="async"
    />
  )
}
