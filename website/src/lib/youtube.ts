const YT_HOST = /youtube\.com|youtu\.be|youtube-nocookie\.com/i

/**
 * Returns the 11-character YouTube video id if `raw` is a known YouTube URL or a bare id.
 */
export function extractYouTubeVideoId(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? ''
  if (!value) return null
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value

  try {
    const withProtocol = value.startsWith('//')
      ? `https:${value}`
      : value.startsWith('http://') || value.startsWith('https://')
        ? value
        : `https://${value}`
    const u = new URL(withProtocol)

    if (u.hostname === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0] ?? ''
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
    }

    if (YT_HOST.test(u.hostname)) {
      const v = u.searchParams.get('v')
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v

      const fromPath = (pattern: RegExp) => {
        const m = u.pathname.match(pattern)
        return m?.[1] && /^[a-zA-Z0-9_-]{11}$/.test(m[1]) ? m[1] : null
      }

      return (
        fromPath(/\/embed\/([a-zA-Z0-9_-]{11})/) ??
        fromPath(/\/shorts\/([a-zA-Z0-9_-]{11})/) ??
        fromPath(/\/live\/([a-zA-Z0-9_-]{11})/) ??
        null
      )
    }
  } catch {
    return null
  }

  return null
}

export type YouTubeThumbQuality = 'maxresdefault' | 'hqdefault' | 'mqdefault' | 'default'

export function getYouTubeThumbnailUrl(videoId: string, quality: YouTubeThumbQuality = 'hqdefault'): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`
}

export function getYouTubeEmbedUrl(
  videoId: string,
  opts?: { autoplay?: boolean; mute?: boolean; modestBranding?: boolean },
): string {
  const params = new URLSearchParams()
  params.set('rel', '0')
  params.set('modestbranding', opts?.modestBranding === false ? '0' : '1')
  params.set('playsinline', '1')
  if (opts?.autoplay) params.set('autoplay', '1')
  if (opts?.mute) params.set('mute', '1')
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`
}
