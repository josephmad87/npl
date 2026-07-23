/**
 * Browser-side hardening for super-admin-authored rich HTML.
 * Removes executable elements, inline handlers, and JavaScript URLs.
 */
export function sanitizeHtml(html: string): string {
  const raw = html.trim()
  if (!raw) return ''
  if (typeof document === 'undefined') return raw

  try {
    const doc = new DOMParser().parseFromString(raw, 'text/html')
    doc
      .querySelectorAll(
        'script,iframe,object,embed,link[rel="import"],meta[http-equiv="refresh"]',
      )
      .forEach((element) => element.remove())

    doc.querySelectorAll('*').forEach((element) => {
      for (const attribute of element.attributes) {
        const name = attribute.name.toLowerCase()
        const value = attribute.value.trim().toLowerCase()
        if (
          name.startsWith('on') ||
          ((name === 'href' || name === 'src') &&
            value.startsWith('javascript:'))
        ) {
          element.removeAttribute(attribute.name)
        }
      }
    })

    return doc.body.innerHTML
  } catch {
    return ''
  }
}
