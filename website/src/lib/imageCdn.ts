const DEFAULT_WIDTHS = [320, 480, 640, 960, 1280, 1600]

export type ResponsiveImageFormat = 'avif' | 'webp'

function isNetlifyHostedPage(): boolean {
  if (typeof globalThis.location === 'undefined') return false
  const hostname = globalThis.location.hostname.toLowerCase()
  return (
    hostname === 'npl.co.zw' ||
    hostname === 'www.npl.co.zw' ||
    hostname.endsWith('.netlify.app')
  )
}

function canTransform(src: string): boolean {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return false
  if (src.startsWith('/')) return true
  try {
    const hostname = new URL(src, globalThis.location.origin).hostname.toLowerCase()
    return (
      hostname === globalThis.location.hostname.toLowerCase() ||
      hostname === 'admin.npl.co.zw' ||
      hostname === 'i.ytimg.com' ||
      /^[a-z0-9-]+\.supabase\.co$/.test(hostname)
    )
  } catch {
    return false
  }
}

/**
 * Build a Netlify Image CDN URL. The CDN resizes the original once, caches it
 * at the edge, and negotiates modern formats without changing stored CMS URLs.
 */
export function imageCdnUrl(
  src: string,
  width: number,
  format?: ResponsiveImageFormat,
  quality = 78,
): string {
  if (!isNetlifyHostedPage() || !canTransform(src)) return src

  const params = new URLSearchParams({
    url: src,
    w: String(Math.max(1, Math.round(width))),
    q: String(Math.min(100, Math.max(1, Math.round(quality)))),
  })
  if (format) params.set('fm', format)
  return `/.netlify/images?${params.toString()}`
}

export function imageCdnSrcSet(
  src: string,
  format: ResponsiveImageFormat,
  widths: readonly number[] = DEFAULT_WIDTHS,
  quality = 78,
): string | undefined {
  if (!isNetlifyHostedPage() || !canTransform(src)) return undefined

  return [...new Set(widths)]
    .filter((width) => Number.isFinite(width) && width > 0)
    .sort((a, b) => a - b)
    .map((width) => `${imageCdnUrl(src, width, format, quality)} ${width}w`)
    .join(', ')
}
