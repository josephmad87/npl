import { Link } from '@tanstack/react-router'

export function NotFoundPage() {
  return (
    <main className="not-found-page">
      <p className="not-found-page__eyebrow">404</p>
      <h1>Page not found</h1>
      <p>The page may have moved, or the link may be incorrect.</p>
      <div className="not-found-page__actions">
        <Link to="/">Return home</Link>
        <Link to="/fixtures">View fixtures</Link>
      </div>
    </main>
  )
}
