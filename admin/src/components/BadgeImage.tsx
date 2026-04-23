import { useState } from 'react'
import logoFallbackSrc from '@/assets/logo.jpeg'
import { resolveBadgeSrc } from '@/lib/badgeSrc'

type BadgeImageProps = Readonly<{
  /** Remote URL when set; otherwise bundled NPL logo is used. */
  imageUrl: string | null | undefined
  alt: string
  size?: 'sm' | 'md' | 'lg'
}>

export function BadgeImage({ imageUrl, alt, size = 'md' }: BadgeImageProps) {
  const resolvedSrc = resolveBadgeSrc(imageUrl)
  const [failedFor, setFailedFor] = useState<string | null>(null)
  const src = failedFor === resolvedSrc ? logoFallbackSrc : resolvedSrc

  return (
    <img
      className={`entity-badge entity-badge--${size}`}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailedFor(resolvedSrc)}
    />
  )
}
