/**
 * Browser-only hardening for admin-authored article HTML (no extra npm deps).
 * Strips script-like tags and inline event handlers before `dangerouslySetInnerHTML`.
 */
export function sanitizeArticleHtml(html: string): string {
  const raw = html.trim()
  if (!raw) return ''
  if (typeof document === 'undefined') {
    return raw
  }
  try {
    const doc = new DOMParser().parseFromString(raw, 'text/html')
    doc
      .querySelectorAll(
        'script,iframe,object,embed,link[rel="import"],meta[http-equiv="refresh"]',
      )
      .forEach((el) => el.remove())
    doc.querySelectorAll('*').forEach((el) => {
      for (const attr of el.attributes) {
        const n = attr.name.toLowerCase()
        const v = attr.value.trim().toLowerCase()
        if (
          n.startsWith('on') ||
          (n === 'href' && v.startsWith('javascript:')) ||
          (n === 'src' && v.startsWith('javascript:'))
        ) {
          el.removeAttribute(attr.name)
        }
      }
    })
    return doc.body.innerHTML
  } catch {
    return ''
  }
}
