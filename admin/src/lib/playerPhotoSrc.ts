import playerPlaceholderSrc from '@/assets/player_avatar_placeholder.png'
import { resolveAdminMediaUrl } from '@/lib/media-url'

export function resolvePlayerPhotoSrc(url: string | null | undefined): string {
  return resolveAdminMediaUrl(url) ?? playerPlaceholderSrc
}
