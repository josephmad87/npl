import logoFallbackSrc from '@/assets/logo.jpeg'
import { resolveAdminMediaUrl } from '@/lib/media-url'

export function resolveBadgeSrc(url: string | null | undefined): string {
  return resolveAdminMediaUrl(url) ?? logoFallbackSrc
}
