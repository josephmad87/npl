import { Link } from '@tanstack/react-router'

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="site-footer-shell">
        <nav className="site-footer-links" aria-label="Footer">
          <Link to="/">Home</Link>
          <Link to="/news" search={{ q: '' }}>
            News
          </Link>
          <Link to="/gallery">Gallery</Link>
          <Link to="/about-us">About Us</Link>
        </nav>
        <p className="site-footer-copy">© {year} Zimbabwe Cricket NPL. All rights reserved.</p>
      </div>
    </footer>
  )
}
