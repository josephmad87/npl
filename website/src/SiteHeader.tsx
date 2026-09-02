import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { fetchJson } from './lib/publicApi'
import nplLogoUrl from './assets/logo-optimized.png'

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
  category: string
}

type NavTeamCategory = 'mens' | 'women' | 'youth'

type HeaderSeason = {
  id: number
  name: string
  slug: string
  leagueSlug: string
}

type NavigationPayload = {
  teams: ApiTeam[]
  leagues: ApiLeague[]
  seasons: Array<{
    id: number
    name: string
    slug: string
    league_slug: string
    league_category: string
  }>
}

export function SiteHeader() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const navigate = useNavigate()
  const location = useRouterState({ select: (s) => s.location })
  const routeSearchText =
    location.pathname === '/search' && typeof location.search.q === 'string'
      ? location.search.q
      : ''
  const [searchDraft, setSearchDraft] = useState(() => ({
    source: routeSearchText,
    value: routeSearchText,
  }))
  const searchText =
    searchDraft.source === routeSearchText ? searchDraft.value : routeSearchText
  const setSearchText = (value: string) => {
    setSearchDraft({ source: routeSearchText, value })
  }
  const { data: navigation } = useQuery({
    queryKey: ['public-navigation'],
    queryFn: () => fetchJson<NavigationPayload>('/public/navigation'),
    staleTime: 5 * 60_000,
    retry: 1,
  })
  const teamsFor = (category: NavTeamCategory) =>
    (navigation?.teams ?? []).filter((team) => team.category === category)
  const leaguesFor = (category: NavTeamCategory) =>
    (navigation?.leagues ?? []).filter((league) => league.category === category)
  const seasonsFor = (category: NavTeamCategory): HeaderSeason[] =>
    (navigation?.seasons ?? [])
      .filter((season) => season.league_category === category)
      .map((season) => ({
        id: season.id,
        name: season.name,
        slug: season.slug,
        leagueSlug: season.league_slug,
      }))
  const mensNavTeams = teamsFor('mens')
  const womenNavTeams = teamsFor('women')
  const youthNavTeams = teamsFor('youth')
  const mensLeagues = leaguesFor('mens')
  const womenLeagues = leaguesFor('women')
  const youthLeagues = leaguesFor('youth')
  const mensSeasons = seasonsFor('mens')
  const womenSeasons = seasonsFor('women')
  const youthSeasons = seasonsFor('youth')

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

  const mensSeasonLinks = mensSeasons.slice(0, 5)
  const womenSeasonLinks = womenSeasons.slice(0, 5)
  const youthSeasonLinks = youthSeasons.slice(0, 5)

  const submitSearch = () => {
    const q = searchText.trim()
    void navigate({
      to: '/search',
      search: { q, type: 'all' },
    })
    setMobileNavOpen(false)
  }

  return (
    <header className="site-header">
      <div className="header-shell">
        <div className="site-header-mobile">
          <div className="site-header-mobile__bar">
            <Link to="/" className="site-header-mobile__logo" aria-label="NPL home" onClick={closeMobileNav}>
              <img src={nplLogoUrl} alt="" />
            </Link>
            <input
              type="search"
              className="site-header-mobile__search"
              placeholder="Search"
              aria-label="Search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submitSearch()
                }
              }}
            />
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

          <div
            id="mobile-navigation"
            className={`site-header-mobile__drawer${mobileNavOpen ? ' is-open' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile menu"
            aria-hidden={!mobileNavOpen}
            inert={!mobileNavOpen}
          >
            <div className="site-header-mobile__drawer-head">
              <span className="site-header-mobile__drawer-title">Menu</span>
              <button type="button" className="site-header-mobile__drawer-close" onClick={closeMobileNav} aria-label="Close menu">
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <nav className="site-header-mobile__drawer-scroll" aria-label="Mobile">
                          <Link
                to="/"
                className="site-header-mobile__drawer-link site-header-mobile__drawer-link--top"
                onClick={closeMobileNav}
              >
                Home
              </Link>
              <Link
                to="/news"
                search={{ q: '' }}
                className="site-header-mobile__drawer-link site-header-mobile__drawer-link--top"
                onClick={closeMobileNav}
              >
                News
              </Link>
              <Link
                to="/compare-teams"
                className="site-header-mobile__drawer-link site-header-mobile__drawer-link--top"
                onClick={closeMobileNav}
              >
                Compare Teams
              </Link>
              <Link
                to="/merchandise"
                className="site-header-mobile__drawer-link site-header-mobile__drawer-link--top"
                onClick={closeMobileNav}
              >
                Merch
              </Link>
              <Link
                to="/about-us"
                className="site-header-mobile__drawer-link site-header-mobile__drawer-link--top"
                onClick={closeMobileNav}
              >
                About Us
              </Link>
              <Link
                to="/contact-us"
                className="site-header-mobile__drawer-link site-header-mobile__drawer-link--top"
                onClick={closeMobileNav}
              >
                Contact Us
              </Link>
              <Link
                to="/my-npl"
                className="site-header-mobile__drawer-link site-header-mobile__drawer-link--top"
                onClick={closeMobileNav}
              >
                My NPL
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
                  {mensSeasonLinks.map((season) => (
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
                  {mensNavTeams.map((team) => (
                    <Link
                      key={`m-drawer-team-${team.id}`}
                      to="/teams/$slug"
                      params={{ slug: team.slug }}
                      className="site-header-mobile__drawer-link"
                      onClick={closeMobileNav}
                    >
                      {team.name}
                    </Link>
                  ))}
                  <p className="site-header-mobile__group-label">Leagues</p>
                  {mensLeagues.map((league) => (
                    <Link key={`m-drawer-league-${league.id}`} to="/leagues/$slug" params={{ slug: league.slug }} className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                      {league.name}
                    </Link>
                  ))}
                </div>
              </details>

              <details className="site-header-mobile__details">
                <summary className="site-header-mobile__summary">Women</summary>
                <div className="site-header-mobile__panel">
                  <Link to="/women" className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                    Women overview
                  </Link>
                  <Link to="/women/fixtures" className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                    Fixtures
                  </Link>
                  <Link to="/women/results" className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                    Results
                  </Link>
                  <p className="site-header-mobile__group-label">Seasons</p>
                  {womenSeasonLinks.map((season) => (
                    <Link
                      key={`w-drawer-season-${season.id}`}
                      to="/leagues/$leagueSlug/seasons/$seasonSlug"
                      params={{ leagueSlug: season.leagueSlug, seasonSlug: season.slug }}
                      className="site-header-mobile__drawer-link"
                      onClick={closeMobileNav}
                    >
                      {season.name}
                    </Link>
                  ))}
                  <p className="site-header-mobile__group-label">Teams</p>
                  {womenNavTeams.map((team) => (
                    <Link
                      key={`l-drawer-team-${team.id}`}
                      to="/teams/$slug"
                      params={{ slug: team.slug }}
                      className="site-header-mobile__drawer-link"
                      onClick={closeMobileNav}
                    >
                      {team.name}
                    </Link>
                  ))}
                  <p className="site-header-mobile__group-label">Leagues</p>
                  {womenLeagues.map((league) => (
                    <Link key={`w-drawer-league-${league.id}`} to="/leagues/$slug" params={{ slug: league.slug }} className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                      {league.name}
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
                  <p className="site-header-mobile__group-label">Seasons</p>
                  {youthSeasonLinks.map((season) => (
                    <Link
                      key={`y-drawer-season-${season.id}`}
                      to="/leagues/$leagueSlug/seasons/$seasonSlug"
                      params={{ leagueSlug: season.leagueSlug, seasonSlug: season.slug }}
                      className="site-header-mobile__drawer-link"
                      onClick={closeMobileNav}
                    >
                      {season.name}
                    </Link>
                  ))}
                  <p className="site-header-mobile__group-label">Teams</p>
                  {youthNavTeams.map((team) => (
                    <Link
                      key={`y-drawer-team-${team.id}`}
                      to="/teams/$slug"
                      params={{ slug: team.slug }}
                      className="site-header-mobile__drawer-link"
                      onClick={closeMobileNav}
                    >
                      {team.name}
                    </Link>
                  ))}
                  <p className="site-header-mobile__group-label">Leagues</p>
                  {youthLeagues.map((league) => (
                    <Link key={`y-drawer-league-${league.id}`} to="/leagues/$slug" params={{ slug: league.slug }} className="site-header-mobile__drawer-link" onClick={closeMobileNav}>
                      {league.name}
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
            </nav>
          </div>
        </div>

        <div className="site-header-desktop">
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
                  {mensSeasonLinks.map((season) => (
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
                  {mensNavTeams.map((team) => (
                    <Link key={`mens-team-${team.id}`} to="/teams/$slug" params={{ slug: team.slug }}>
                      {team.name}
                    </Link>
                  ))}
                </div>
                <div className="dropdown-group">
                  <span>Leagues</span>
                  {mensLeagues.map((league) => (
                    <Link key={`mens-league-${league.id}`} to="/leagues/$slug" params={{ slug: league.slug }}>
                      {league.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="menu-item">
              <Link to="/women">Women</Link>
              <div className="dropdown">
                <Link to="/women/fixtures">Fixtures</Link>
                <Link to="/women/results">Results</Link>
                <div className="dropdown-group">
                  <span>Seasons</span>
                  {womenSeasonLinks.map((season) => (
                    <Link
                      key={`women-season-${season.id}`}
                      to="/leagues/$leagueSlug/seasons/$seasonSlug"
                      params={{ leagueSlug: season.leagueSlug, seasonSlug: season.slug }}
                    >
                      {season.name}
                    </Link>
                  ))}
                </div>
                <div className="dropdown-group">
                  <span>Teams</span>
                  {womenNavTeams.map((team) => (
                    <Link key={`women-team-${team.id}`} to="/teams/$slug" params={{ slug: team.slug }}>
                      {team.name}
                    </Link>
                  ))}
                </div>
                <div className="dropdown-group">
                  <span>Leagues</span>
                  {womenLeagues.map((league) => (
                    <Link key={`women-league-${league.id}`} to="/leagues/$slug" params={{ slug: league.slug }}>
                      {league.name}
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
                  <span>Seasons</span>
                  {youthSeasonLinks.map((season) => (
                    <Link
                      key={`youth-season-${season.id}`}
                      to="/leagues/$leagueSlug/seasons/$seasonSlug"
                      params={{ leagueSlug: season.leagueSlug, seasonSlug: season.slug }}
                    >
                      {season.name}
                    </Link>
                  ))}
                </div>
                <div className="dropdown-group">
                  <span>Teams</span>
                  {youthNavTeams.map((team) => (
                    <Link key={`youth-team-${team.id}`} to="/teams/$slug" params={{ slug: team.slug }}>
                      {team.name}
                    </Link>
                  ))}
                </div>
                <div className="dropdown-group">
                  <span>Leagues</span>
                  {youthLeagues.map((league) => (
                    <Link key={`youth-league-${league.id}`} to="/leagues/$slug" params={{ slug: league.slug }}>
                      {league.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

                      <Link to="/news" search={{ q: '' }}>
              News
            </Link>

            <Link to="/compare-teams">
              Compare
            </Link>

            <div className="menu-item">
              <Link to="/gallery">Gallery</Link>
              <div className="dropdown">
                <Link to="/gallery/images">Images</Link>
                <Link to="/gallery/video">Video</Link>
              </div>
            </div>

            <Link to="/merchandise">
              Merch
            </Link>

            <Link to="/about-us">About</Link>
            <Link to="/contact-us">Contact</Link>
            <Link to="/my-npl" className="site-header-desktop__account">My NPL</Link>
            <form
              className="site-header-desktop__search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault()
                submitSearch()
              }}
            >
              <input
                type="search"
                placeholder="Search"
                aria-label="Search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </form>
          </nav>
        </div>
      </div>
    </header>
  )
}
