import { useState } from 'react'
import playerPlaceholderSrc from '@/assets/player_avatar_placeholder.png'
import { resolvePlayerPhotoSrc } from '@/lib/playerPhotoSrc'

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
  const resolvedSrc = resolvePlayerPhotoSrc(profilePhotoUrl)
  const [failedFor, setFailedFor] = useState<string | null>(null)
  const src = failedFor === resolvedSrc ? playerPlaceholderSrc : resolvedSrc

  return (
    <img
      className={`player-avatar player-avatar--${size}`}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailedFor(resolvedSrc)}
    />
  )
}
