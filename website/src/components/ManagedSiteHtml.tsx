import { sanitizeHtml } from '../lib/sanitizeHtml'

export function ManagedSiteHtml({
  html,
  className,
}: {
  html: string
  className?: string
}) {
  if (!html.trim()) return null

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  )
}
