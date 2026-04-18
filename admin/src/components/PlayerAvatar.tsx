import playerPlaceholderSrc from '@/assets/player_avatar_placeholder.png'

export function resolvePlayerPhotoSrc(url: string | null | undefined): string {
  const t = url?.trim()
  return t && t.length > 0 ? t : playerPlaceholderSrc
}

type PlayerAvatarProps = Readonly<{
  /** Remote URL when set; otherwise bundled placeholder is used. */
  profilePhotoUrl: string | null | undefined
  alt: string
  size?: 'sm' | 'md' | 'lg'
}>

export function PlayerAvatar({
  profilePhotoUrl,
  alt,
  size = 'md',
}: PlayerAvatarProps) {
  return (
    <img
      className={`player-avatar player-avatar--${size}`}
      src={resolvePlayerPhotoSrc(profilePhotoUrl)}
      alt={alt}
      loading="lazy"
      decoding="async"
    />
  )
}
