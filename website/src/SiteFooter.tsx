import { Link } from '@tanstack/react-router'

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="site-footer-shell">
        <div className="site-footer-top">
          <h2 className="site-footer-title">Explore the competition</h2>
          <nav className="site-footer-quick" aria-label="Competition quick links">
            <Link to="/mens">Mens</Link>
            <Link to="/women">Women</Link>
            <Link to="/youth">Youth</Link>
            <Link to="/fixtures">Fixtures</Link>
            <Link to="/results">Results</Link>
            <Link to="/news" search={{ q: '' }}>
              News
            </Link>
            <Link to="/gallery">Gallery</Link>
          </nav>
        </div>

        <div className="site-footer-grid">
          <nav className="site-footer-col" aria-label="Competitions">
            <h3>Competitions</h3>
            <Link to="/mens">Mens hub</Link>
            <Link to="/women">Women hub</Link>
            <Link to="/youth">Youth hub</Link>
            <Link to="/fixtures">All fixtures</Link>
            <Link to="/results">All results</Link>
          </nav>

          <nav className="site-footer-col" aria-label="Teams and players">
            <h3>Teams &amp; players</h3>
            <Link to="/mens/teams">Mens teams</Link>
            <Link to="/women/teams">Women teams</Link>
            <Link to="/youth/teams">Youth teams</Link>
            <Link to="/mens/seasons" search={{ leagueSlug: 'npl' }}>
              Mens seasons
            </Link>
            <Link to="/women/seasons" search={{ leagueSlug: 'npl' }}>
              Women seasons
            </Link>
            <Link to="/youth/seasons" search={{ leagueSlug: 'npl' }}>
              Youth seasons
            </Link>
          </nav>

          <nav className="site-footer-col" aria-label="Media and updates">
            <h3>Media &amp; updates</h3>
            <Link to="/news" search={{ q: '' }}>
              Newsroom
            </Link>
            <Link to="/gallery">Photo gallery</Link>
            <Link to="/gallery/images">Image highlights</Link>
            <Link to="/gallery/video">Video highlights</Link>
          </nav>

          <nav className="site-footer-col" aria-label="About and support">
            <h3>About &amp; support</h3>
            <Link to="/about-us">About us</Link>
            <Link to="/contact-us">Contact us</Link>
            <Link to="/">Homepage</Link>
            <Link to="/news" search={{ q: 'press' }}>
              Press updates
            </Link>
            <Link to="/news" search={{ q: 'announcement' }}>
              Announcements
            </Link>
          </nav>
        </div>

        <div className="site-footer-bottom">
          <p className="site-footer-copy">© {year} Zimbabwe Cricket NPL. All rights reserved.</p>
          <p className="site-footer-meta">Built for supporters, teams, and officials across Zimbabwe.</p>
        </div>
      </div>
    </footer>
  )
}
