import logoFallbackSrc from '@/assets/logo.jpeg'

export function resolveBadgeSrc(url: string | null | undefined): string {
  const t = url?.trim()
  return t && t.length > 0 ? t : logoFallbackSrc
}

type BadgeImageProps = Readonly<{
  /** Remote URL when set; otherwise bundled NPL logo is used. */
  imageUrl: string | null | undefined
  alt: string
  size?: 'sm' | 'md' | 'lg'
}>

export function BadgeImage({ imageUrl, alt, size = 'md' }: BadgeImageProps) {
  return (
    <img
      className={`entity-badge entity-badge--${size}`}
      src={resolveBadgeSrc(imageUrl)}
      alt={alt}
      loading="lazy"
      decoding="async"
    />
  )
}
