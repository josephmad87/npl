import { Outlet, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import './App.css'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'
import { DEFAULT_SEO_DESCRIPTION, SeoHead } from './components/SeoHead'

const STATIC_SEO: Record<string, { title: string; description: string }> = {
  '/': { title: 'NPL Zimbabwe', description: DEFAULT_SEO_DESCRIPTION },
  '/fixtures': { title: 'Cricket Fixtures', description: 'Upcoming NPL Zimbabwe cricket fixtures, dates, venues and match details.' },
  '/results': { title: 'Cricket Results', description: 'Latest official NPL Zimbabwe cricket results and completed match scorecards.' },
  '/live': { title: 'Live Cricket Scores', description: 'Follow live NPL Zimbabwe cricket scores, ball-by-ball updates and scorecards.' },
  '/news': { title: 'Cricket News', description: 'Latest news, match reports and updates from NPL Zimbabwe club cricket.' },
  '/mens': { title: "Men's Cricket", description: "Men's NPL Zimbabwe competitions, fixtures, results, standings and teams." },
  '/mens/fixtures': { title: "Men's Fixtures", description: "Upcoming men's NPL Zimbabwe cricket fixtures, dates and venues." },
  '/mens/results': { title: "Men's Results", description: "Latest men's NPL Zimbabwe cricket results and scorecards." },
  '/mens/seasons': { title: "Men's Seasons", description: "Men's NPL Zimbabwe seasons, competitions and standings." },
  '/mens/teams': { title: "Men's Teams", description: "Men's teams competing in NPL Zimbabwe club cricket." },
  '/women': { title: "Women's Cricket", description: "Women's NPL Zimbabwe competitions, fixtures, results, standings and teams." },
  '/women/fixtures': { title: "Women's Fixtures", description: "Upcoming women's NPL Zimbabwe cricket fixtures, dates and venues." },
  '/women/results': { title: "Women's Results", description: "Latest women's NPL Zimbabwe cricket results and scorecards." },
  '/women/seasons': { title: "Women's Seasons", description: "Women's NPL Zimbabwe seasons, competitions and standings." },
  '/women/teams': { title: "Women's Teams", description: "Women's teams competing in NPL Zimbabwe club cricket." },
  '/youth': { title: 'Youth Cricket', description: 'NPL Zimbabwe youth cricket competitions, fixtures, results, standings and teams.' },
  '/youth/fixtures': { title: 'Youth Fixtures', description: 'Upcoming NPL Zimbabwe youth cricket fixtures, dates and venues.' },
  '/youth/results': { title: 'Youth Results', description: 'Latest NPL Zimbabwe youth cricket results and scorecards.' },
  '/youth/seasons': { title: 'Youth Seasons', description: 'NPL Zimbabwe youth seasons, competitions and standings.' },
  '/youth/teams': { title: 'Youth Teams', description: 'Youth teams competing in NPL Zimbabwe club cricket.' },
  '/gallery': { title: 'Gallery', description: 'Photos and video highlights from NPL Zimbabwe cricket.' },
  '/gallery/images': { title: 'Photo Gallery', description: 'Photo highlights from NPL Zimbabwe cricket.' },
  '/gallery/video': { title: 'Video Gallery', description: 'Video highlights from NPL Zimbabwe cricket.' },
  '/merchandise': { title: 'Official NPL Merchandise', description: 'Browse official National Premier League supporter merchandise.' },
  '/my-npl': { title: 'My NPL', description: 'Manage your NPL Zimbabwe supporter account, follows, notifications and orders.' },
  '/about-us': { title: 'About NPL Zimbabwe', description: 'Learn about National Premier League cricket in Zimbabwe.' },
  '/contact-us': { title: 'Contact NPL Zimbabwe', description: 'Contact NPL Zimbabwe about competitions, scores, media, support or merchandise.' },
  '/compare-teams': { title: 'Compare Teams', description: 'Compare NPL Zimbabwe cricket team records and performance.' },
  '/search': { title: 'Search', description: 'Search NPL Zimbabwe teams, players, fixtures, results and news.' },
}

export function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [routeAnnouncement, setRouteAnnouncement] = useState('')
  const staticSeo = STATIC_SEO[pathname]

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const main = document.getElementById('main-content')
      main?.focus({ preventScroll: false })
      const pageHeading = document.querySelector('h1')?.textContent?.trim()
      setRouteAnnouncement(pageHeading ? `${pageHeading} page loaded` : 'Page loaded')
    })
    return () => window.cancelAnimationFrame(frame)
  }, [pathname])

  return (
    <div className="app-layout">
      {staticSeo ? (
        <SeoHead
          title={staticSeo.title}
          description={staticSeo.description}
          canonicalPath={pathname}
          noIndex={pathname === '/search'}
        />
      ) : null}
      <a className="npl-skip-link" href="#main-content">Skip to main content</a>
      <div className="npl-sr-only" role="status" aria-live="polite" aria-atomic="true">
        {routeAnnouncement}
      </div>
      <SiteHeader />
      <div id="main-content" className="app-layout-content" tabIndex={-1}>
        <Outlet />
      </div>
      <SiteFooter />
    </div>
  )
}
