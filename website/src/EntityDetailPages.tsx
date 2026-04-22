import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { fetchJson } from './lib/publicApi'

type TeamDetail = {
  name: string
  slug: string
  category: string | null
  home_city: string | null
  founded_year: number | null
  status: string
}

type LeagueDetail = {
  id: number
  name: string
  slug: string
  category: string | null
  format: string | null
  status: string
  description: string | null
}

type SeasonDetail = {
  id: number
  name: string
  slug: string
  status: string
  start_date: string | null
  end_date: string | null
  team_ids: number[]
}

export function TeamDetailPage() {
  const { slug } = useParams({ from: '/teams/$slug' })
  const { data, isLoading, isError } = useQuery({
    queryKey: ['team-detail', slug],
    queryFn: () => fetchJson<TeamDetail>(`/public/teams/${slug}`),
    retry: 1,
  })

  return (
    <main className="container">
      <section className="menu-page">
        {isLoading ? <p>Loading team...</p> : null}
        {isError ? <p>Could not load team details.</p> : null}
        {data ? (
          <>
            <header className="menu-page-header">
              <h1>{data.name}</h1>
              <p>{data.category ?? 'Team'}</p>
            </header>
            <div className="menu-list">
              <article className="menu-list-item">
                <div>
                  <h2>Home City</h2>
                  <p>{data.home_city ?? 'N/A'}</p>
                </div>
              </article>
              <article className="menu-list-item">
                <div>
                  <h2>Founded</h2>
                  <p>{data.founded_year ?? 'N/A'}</p>
                </div>
              </article>
              <article className="menu-list-item">
                <div>
                  <h2>Status</h2>
                  <p>{data.status}</p>
                </div>
              </article>
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}

export function LeagueDetailPage() {
  const { slug } = useParams({ from: '/leagues/$slug' })
  const { data, isLoading, isError } = useQuery({
    queryKey: ['league-detail', slug],
    queryFn: () => fetchJson<LeagueDetail>(`/public/leagues/${slug}`),
    retry: 1,
  })

  return (
    <main className="container">
      <section className="menu-page">
        {isLoading ? <p>Loading league...</p> : null}
        {isError ? <p>Could not load league details.</p> : null}
        {data ? (
          <>
            <header className="menu-page-header">
              <h1>{data.name}</h1>
              <p>{data.category ?? 'League'}</p>
            </header>
            <div className="menu-list">
              <article className="menu-list-item">
                <div>
                  <h2>Format</h2>
                  <p>{data.format ?? 'N/A'}</p>
                </div>
              </article>
              <article className="menu-list-item">
                <div>
                  <h2>Status</h2>
                  <p>{data.status}</p>
                </div>
              </article>
              {data.description ? (
                <article className="menu-list-item">
                  <div>
                    <h2>Description</h2>
                    <p>{data.description}</p>
                  </div>
                </article>
              ) : null}
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}

export function SeasonDetailPage() {
  const { leagueSlug, seasonSlug } = useParams({ from: '/leagues/$leagueSlug/seasons/$seasonSlug' })
  const { data, isLoading, isError } = useQuery({
    queryKey: ['season-detail', leagueSlug, seasonSlug],
    queryFn: () => fetchJson<SeasonDetail>(`/public/leagues/${leagueSlug}/seasons/${seasonSlug}`),
    retry: 1,
  })

  return (
    <main className="container">
      <section className="menu-page">
        {isLoading ? <p>Loading season...</p> : null}
        {isError ? <p>Could not load season details.</p> : null}
        {data ? (
          <>
            <header className="menu-page-header">
              <h1>{data.name}</h1>
              <p>Season overview</p>
            </header>
            <div className="menu-list">
              <article className="menu-list-item">
                <div>
                  <h2>Status</h2>
                  <p>{data.status}</p>
                </div>
              </article>
              <article className="menu-list-item">
                <div>
                  <h2>Dates</h2>
                  <p>
                    {data.start_date ?? 'TBD'} - {data.end_date ?? 'TBD'}
                  </p>
                </div>
              </article>
              <article className="menu-list-item">
                <div>
                  <h2>Teams in Season</h2>
                  <p>{data.team_ids.length}</p>
                </div>
              </article>
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}
