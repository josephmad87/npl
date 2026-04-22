import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { extractList, fetchJson } from './lib/publicApi'
import nplLogoUrl from './assets/logo.jpeg'

type ApiTeam = {
  id: number
  name: string
  slug: string
  category: string | null
}

type ApiLeague = {
  id: number
  name: string
  slug: string
}

type ApiSeason = {
  id: number
  name: string
  slug: string
}

type NavTeamCategory = 'men' | 'ladies' | 'youth'

/** Matches `/public/teams?category=` — exact team.category values used across the site */
function teamsForNavCategory(teams: ApiTeam[], category: NavTeamCategory, limit = 6): ApiTeam[] {
  const key = category.toLowerCase()
  return teams.filter((t) => (t.category ?? '').trim().toLowerCase() === key).slice(0, limit)
}

type HeaderSeason = {
  id: number
  name: string
  slug: string
  leagueSlug: string
}

const fetchTeams = async () => {
  const payload = await fetchJson<unknown>('/public/teams?page=1&page_size=100')
  return extractList<ApiTeam>(payload)
}

const fetchLeagues = async () => {
  const payload = await fetchJson<unknown>('/public/leagues?page=1&page_size=20')
  return extractList<ApiLeague>(payload)
}

const fetchAllSeasons = async () => {
  const leagues = await fetchLeagues()
  const seasonLists = await Promise.all(
    leagues.map(async (league) => {
      const payload = await fetchJson<unknown>(`/public/leagues/${league.slug}/seasons?page=1&page_size=10`)
      return extractList<ApiSeason>(payload).map((season) => ({
        ...season,
        leagueSlug: league.slug,
      }))
    }),
  )
  const seen = new Set<number>()
  const merged: HeaderSeason[] = []
  seasonLists.flat().forEach((season) => {
    if (seen.has(season.id)) return
    seen.add(season.id)
    merged.push(season)
  })
  return merged
}

export function SiteHeader() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { data: teams = [] } = useQuery({
    queryKey: ['header-teams'],
    queryFn: fetchTeams,
    retry: 1,
  })
  const { data: leagues = [] } = useQuery({
    queryKey: ['header-leagues'],
    queryFn: fetchLeagues,
    retry: 1,
  })
  const { data: seasons = [] } = useQuery({
    queryKey: ['header-seasons'],
    queryFn: fetchAllSeasons,
    retry: 1,
  })

  const closeMobileNav = () => setMobileNavOpen(false)

  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [mobileNavOpen])

  const menNavTeams = useMemo(() => teamsForNavCategory(teams, 'men'), [teams])
  const ladiesNavTeams = useMemo(() => teamsForNavCategory(teams, 'ladies'), [teams])
  const youthNavTeams = useMemo(() => teamsForNavCategory(teams, 'youth'), [teams])

  const seasonLinks =
    seasons.length > 0
      ? seasons.slice(0, 5)
      : [{ id: -1, name: 'Current Season', slug: 'current-season', leagueSlug: 'npl' }]

  const leagueLinks =
    leagues.length > 0 ? leagues : [{ id: -1, name: 'National Premier League', slug: 'npl' }]

  return (
    <header className="site-header">
      <div className="header-shell">
        <div className="site-header-mobile">
          <div className="site-header-mobile__bar">
            <Link to="/" className="site-header-mobile__logo" aria-label="NPL home" onClick={closeMobileNav}>
              <img src={nplLogoUrl} alt="" />
            </Link>
            <input type="search" className="site-header-mobile__search" placeholder="Search" aria-label="Search" />
            <button
              type="button"
              className={`site-header-mobile__menu-btn${mobileNavOpen ? ' is-open' : ''}`}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              <span className="site-header-mobile__menu-bar" />
              <span className="site-header-mobile__menu-bar" />
              <span className="site-header-mobile__menu-bar" />
            </button>
          </div>

          {mobileNavOpen ? (
            <div
              className="site-header-mobile__backdrop"
              aria-hidden="true"
              onClick={closeMobileNav}
            />
          ) : null}

          <nav
            id="mobile-navigation"
            className={`site-header-mobile__drawer${mobileNavOpen ? ' is-open' : ''}`}
            aria-hidden={!mobileNavOpen}
            inert={!mobileNavOpen}
          >
            <div className="site-header-mobile__drawer-head">
              <span className="site-header-mobile__drawer-title">Menu</span>
              <button type="button" className="site-header-mobile__drawer-close" onClick={closeMobileNav} aria-label="Close menu">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="site-header-mobile__drawer-scroll">
              <Link to="/" className="site-header-mobile__drawer-link site-header-mobile__drawer-link--top" onClick={closeMobileNav}>
                Home
              </Link>
              <Link to="/news" search={{ q: '' }} className="site-header-mobile__drawer-link site-header-mobile__drawer-link--top" onClick={closeMobileNav}>
                News
              </Link>
              <Link to="/about-us" className="site-header-mobile__drawer-link site-header-mobile__drawer-link--top" onClick={closeMobileNav}>
                About Us
              </Link>

              <details className="site-header-mobile__details">
                <summary className="site-header-mobile__summary">Mens</summary>
                <div className="site-header-mobile__panel">
                  <Link to="/mens" className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                    Mens overview
                  </Link>
                  <Link to="/mens/fixtures" className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                    Fixtures
                  </Link>
                  <Link to="/mens/results" className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                    Results
                  </Link>
                  <p className="site-header-mobile__group-label">Seasons</p>
                  {seasonLinks.map((season) => (
                    <Link
                      key={`m-drawer-season-${season.id}`}
                      to="/leagues/$leagueSlug/seasons/$seasonSlug"
                      params={{ leagueSlug: season.leagueSlug, seasonSlug: season.slug }}
                      className="site-header-mobile__drawer-link"
                      onClick={closeMobileNav}
                    >
                      {season.name}
                    </Link>
                  ))}
                  <p className="site-header-mobile__group-label">Teams</p>
                  {menNavTeams.map((team) => (
                    <Link key={`m-drawer-team-${team.id}`} to="/mens/teams" search={{ teamSlug: team.slug }} className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                      {team.name}
                    </Link>
                  ))}
                  <p className="site-header-mobile__group-label">Leagues</p>
                  {leagueLinks.map((league) => (
                    <Link key={`m-drawer-league-${league.id}`} to="/mens/seasons" search={{ leagueSlug: league.slug }} className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                      {league.name}
                    </Link>
                  ))}
                </div>
              </details>

              <details className="site-header-mobile__details">
                <summary className="site-header-mobile__summary">Ladies</summary>
                <div className="site-header-mobile__panel">
                  <Link to="/ladies" className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                    Ladies overview
                  </Link>
                  <Link to="/ladies/fixtures" className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                    Fixtures
                  </Link>
                  <Link to="/ladies/results" className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                    Results
                  </Link>
                  <p className="site-header-mobile__group-label">Teams</p>
                  {ladiesNavTeams.map((team) => (
                    <Link key={`l-drawer-team-${team.id}`} to="/ladies/teams" search={{ teamSlug: team.slug }} className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                      {team.name}
                    </Link>
                  ))}
                </div>
              </details>

              <details className="site-header-mobile__details">
                <summary className="site-header-mobile__summary">Youth</summary>
                <div className="site-header-mobile__panel">
                  <Link to="/youth" className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                    Youth overview
                  </Link>
                  <Link to="/youth/fixtures" className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                    Fixtures
                  </Link>
                  <Link to="/youth/results" className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                    Results
                  </Link>
                  <p className="site-header-mobile__group-label">Teams</p>
                  {youthNavTeams.map((team) => (
                    <Link key={`y-drawer-team-${team.id}`} to="/youth/teams" search={{ teamSlug: team.slug }} className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                      {team.name}
                    </Link>
                  ))}
                </div>
              </details>

              <details className="site-header-mobile__details">
                <summary className="site-header-mobile__summary">Gallery</summary>
                <div className="site-header-mobile__panel">
                  <Link to="/gallery" className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                    Gallery
                  </Link>
                  <Link to="/gallery/images" className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                    Images
                  </Link>
                  <Link to="/gallery/video" className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                    Video
                  </Link>
                </div>
              </details>
            </div>
          </nav>
        </div>

        <div className="site-header-desktop">
          <div className="utility-row">
            <div className="utility-controls">
              <input type="search" placeholder="Search" aria-label="Search" />
            </div>
          </div>
          <nav className="main-nav nav-row" aria-label="Main">
            <Link to="/" className="site-brand site-brand--inline" aria-label="NPL home">
              <img src={nplLogoUrl} alt="NPL logo" />
            </Link>
            <Link to="/">Home</Link>

            <div className="menu-item">
              <Link to="/mens">Mens</Link>
              <div className="dropdown">
                <Link to="/mens/fixtures">Fixtures</Link>
                <Link to="/mens/results">Results</Link>
                <div className="dropdown-group">
                  <span>Seasons</span>
                  {seasonLinks.map((season) => (
                    <Link
                      key={`mens-season-${season.id}`}
                      to="/leagues/$leagueSlug/seasons/$seasonSlug"
                      params={{ leagueSlug: season.leagueSlug, seasonSlug: season.slug }}
                    >
                      {season.name}
                    </Link>
                  ))}
                </div>
                <div className="dropdown-group">
                  <span>Teams</span>
                  {menNavTeams.map((team) => (
                    <Link key={`mens-team-${team.id}`} to="/mens/teams" search={{ teamSlug: team.slug }}>
                      {team.name}
                    </Link>
                  ))}
                </div>
                <div className="dropdown-group">
                  <span>Leagues</span>
                  {leagueLinks.map((league) => (
                    <Link key={`mens-league-${league.id}`} to="/mens/seasons" search={{ leagueSlug: league.slug }}>
                      {league.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="menu-item">
              <Link to="/ladies">Ladies</Link>
              <div className="dropdown">
                <Link to="/ladies/fixtures">Fixtures</Link>
                <Link to="/ladies/results">Results</Link>
                <div className="dropdown-group">
                  <span>Teams</span>
                  {ladiesNavTeams.map((team) => (
                    <Link key={`ladies-team-${team.id}`} to="/ladies/teams" search={{ teamSlug: team.slug }}>
                      {team.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="menu-item">
              <Link to="/youth">Youth</Link>
              <div className="dropdown">
                <Link to="/youth/fixtures">Fixtures</Link>
                <Link to="/youth/results">Results</Link>
                <div className="dropdown-group">
                  <span>Teams</span>
                  {youthNavTeams.map((team) => (
                    <Link key={`youth-team-${team.id}`} to="/youth/teams" search={{ teamSlug: team.slug }}>
                      {team.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <Link to="/news" search={{ q: '' }}>
              News
            </Link>
            <div className="menu-item">
              <Link to="/gallery">Gallery</Link>
              <div className="dropdown">
                <Link to="/gallery/images">Images</Link>
                <Link to="/gallery/video">Video</Link>
              </div>
            </div>
            <Link to="/about-us">About Us</Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
