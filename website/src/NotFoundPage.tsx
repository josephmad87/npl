import { Link } from '@tanstack/react-router'

import { useSitePageContent } from './lib/siteContent'

export function NotFoundPage() {
  const contentQ = useSitePageContent('not-found')
  return (
    <main className="not-found-page">
      <p className="not-found-page__eyebrow">404</p>
      <h1>{contentQ.data?.title || 'Page Not Found'}</h1>
      <p>{contentQ.data?.subtitle || 'The page may have moved, or the link may be incorrect.'}</p>
      <div className="not-found-page__actions">
        <Link to="/">Return home</Link>
        <Link to="/fixtures">View fixtures</Link>
      </div>
    </main>
  )
}
