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

  const menTeams = teams.filter((team) => (team.category ?? '').toLowerCase().includes('men')).slice(0, 6)
  const ladiesTeams = teams
    .filter((team) => (team.category ?? '').toLowerCase().includes('ladies'))
    .slice(0, 6)
  const youthTeams = teams.filter((team) => (team.category ?? '').toLowerCase().includes('youth')).slice(0, 6)

  return (
    <header className="site-header">
      <div className="header-shell">
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
                {(seasons.length > 0
                  ? seasons
                  : [{ id: -1, name: 'Current Season', slug: 'current-season', leagueSlug: 'npl' }]
                )
                  .slice(0, 5)
                  .map((season) => (
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
                {(menTeams.length > 0 ? menTeams : teams.slice(0, 6)).map((team) => (
                  <Link key={`mens-team-${team.id}`} to="/mens/teams" search={{ teamSlug: team.slug }}>
                    {team.name}
                  </Link>
                ))}
              </div>
              <div className="dropdown-group">
                <span>Leagues</span>
                {(leagues.length > 0 ? leagues : [{ id: -1, name: 'National Premier League', slug: 'npl' }]).map(
                  (league) => (
                    <Link key={`mens-league-${league.id}`} to="/mens/seasons" search={{ leagueSlug: league.slug }}>
                      {league.name}
                    </Link>
                  ),
                )}
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
                {(ladiesTeams.length > 0 ? ladiesTeams : teams.slice(0, 6)).map((team) => (
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
                {(youthTeams.length > 0 ? youthTeams : teams.slice(0, 6)).map((team) => (
                  <Link key={`youth-team-${team.id}`} to="/youth/teams" search={{ teamSlug: team.slug }}>
                    {team.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <Link to="/news">News</Link>
          <Link to="/center">Center</Link>
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
    </header>
  )
}
