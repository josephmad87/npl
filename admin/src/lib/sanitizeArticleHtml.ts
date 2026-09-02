import DOMPurify from 'dompurify'

export function sanitizeArticleHtml(html: string): string {
  const raw = html.trim()
  if (!raw || typeof window === 'undefined') return ''

  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      'style',
      'form',
      'input',
      'button',
      'textarea',
      'select',
      'option',
      'svg',
      'math',
      'template',
    ],
    FORBID_ATTR: ['style', 'srcset'],
    ALLOW_DATA_ATTR: false,
  })
}
