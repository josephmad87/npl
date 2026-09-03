import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import nplLogoUrl from './assets/logo-optimized.png'
import { fetchJson } from './lib/publicApi'

type FooterAboutContent = {
  social_links?: {
    facebook?: string
    instagram?: string
    twitter?: string
    youtube?: string
  }
}

function normalizeSocialLink(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? ''
  if (!value) return null
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (value.startsWith('//')) return `https:${value}`
  return `https://${value}`
}

export function SiteFooter() {
  const year = new Date().getFullYear()
  const aboutQ = useQuery({
    queryKey: ['public-about-footer-socials'],
    queryFn: () => fetchJson<FooterAboutContent>('/public/about'),
    retry: 1,
  })
  const socials = aboutQ.data?.social_links
  const facebook = normalizeSocialLink(socials?.facebook)
  const instagram = normalizeSocialLink(socials?.instagram)
  const twitter = normalizeSocialLink(socials?.twitter)
  const youtube = normalizeSocialLink(socials?.youtube)

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
            <Link to="/merchandise">Merchandise</Link>
          </nav>
        </div>

        <div className="site-footer-grid">
          <div className="site-footer-brand" aria-label="Zimbabwe Cricket NPL">
            <img src={nplLogoUrl} alt="NPL logo" />
          </div>

          <nav className="site-footer-col" aria-label="Competitions">
            <h3>Competitions</h3>
            <Link to="/mens">Mens Hub</Link>
            <Link to="/women">Women Hub</Link>
            <Link to="/youth">Youth Hub</Link>
            <Link to="/fixtures">All Fixtures</Link>
            <Link to="/results">All Results</Link>
          </nav>

          <nav className="site-footer-col" aria-label="Media and updates">
            <h3>Media &amp; updates</h3>
            <Link to="/news" search={{ q: '' }}>
              Newsroom
            </Link>
            <Link to="/gallery">Photo Gallery</Link>
            <Link to="/gallery/images">Image Highlights</Link>
            <Link to="/gallery/video">Video Highlights</Link>
          </nav>

          <nav className="site-footer-col" aria-label="About and support">
            <h3>About &amp; support</h3>
            <Link to="/about-us">About Us</Link>
            <Link to="/safeguarding">Safeguarding</Link>
            <Link to="/scorecard-corrections">Scorecard Corrections</Link>
            <Link to="/contact-us">Contact Us</Link>
            <Link to="/support">Support</Link>
          </nav>

          <nav className="site-footer-col" aria-label="Social">
            <h3>Social</h3>
            {facebook !== null ? (
              <a href={facebook} target="_blank" rel="noreferrer">
                Facebook
              </a>
            ) : null}
            {instagram !== null ? (
              <a href={instagram} target="_blank" rel="noreferrer">
                Instagram
              </a>
            ) : null}
            {twitter !== null ? (
              <a href={twitter} target="_blank" rel="noreferrer">
                Twitter / X
              </a>
            ) : null}
            {youtube !== null ? (
              <a href={youtube} target="_blank" rel="noreferrer">
                YouTube
              </a>
            ) : null}
          </nav>
        </div>

        <div className="site-footer-bottom">
          <p className="site-footer-copy">© {year} Zimbabwe Cricket NPL. All rights reserved.</p>
          <nav className="site-footer-legal" aria-label="Legal and account links">
            <Link to="/account-deletion">Delete Account</Link>
            <span aria-hidden="true">|</span>
            <Link to="/privacy">Privacy Policy</Link>
            <span aria-hidden="true">|</span>
            <Link to="/terms">Terms of Use</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
