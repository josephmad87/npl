import playerPlaceholderSrc from '../assets/player_avatar_placeholder.png'
import { resolveMediaUrl } from './publicApi'

/** Remote photo URL when set; otherwise the same bundled placeholder as admin `PlayerAvatar`. */
export function resolvePlayerPhotoSrc(url: string | null | undefined): string {
  const trimmed = url?.trim() ?? ''
  if (!trimmed) return playerPlaceholderSrc
  return resolveMediaUrl(trimmed) ?? trimmed
}

export { playerPlaceholderSrc }
