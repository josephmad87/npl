export function getYouTubeVideoId(raw: string | null | undefined): string | null {
  const input = raw?.trim() ?? ''
  if (!input) return null

  try {
    const url = new URL(input)
    const host = url.hostname.toLowerCase()

    if (host === 'youtu.be') {
      const seg = url.pathname.split('/').filter(Boolean)[0]
      return seg?.trim() || null
    }

    if (
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtube-nocookie.com' ||
      host === 'www.youtube-nocookie.com'
    ) {
      const v = url.searchParams.get('v')
      if (v?.trim()) return v.trim()

      const parts = url.pathname.split('/').filter(Boolean)
      const markerIdx = parts.findIndex((p) =>
        ['embed', 'shorts', 'live', 'v'].includes(p),
      )
      if (markerIdx >= 0 && parts[markerIdx + 1]) {
        return parts[markerIdx + 1]!.trim()
      }
    }
  } catch {
    // ignore parse errors and fallback to regex below
  }

  const re = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{6,})/
  const m = input.match(re)
  return m?.[1] ?? null
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?rel=0`
}
