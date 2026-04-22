import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { EmptyState } from './components/EmptyState'
import { ErrorNotice } from './components/ErrorNotice'
import { MatchCard } from './components/MatchCard'
import { PageHero } from './components/PageHero'
import { PlayerCard } from './components/PlayerCard'
import { SectionHeader } from './components/SectionHeader'
import { Spinner } from './components/Spinner'
import { TeamCard } from './components/TeamCard'
import { formatCategoryLabel, formatDateRange } from './lib/formatters'
import { type MatchLite, useTeamsMap } from './lib/hooks'
import { extractList, fetchJson, resolveMediaUrl } from './lib/publicApi'

type TeamDetail = {
  id: number
  name: string
  slug: string
  category: string | null
  logo_url: string | null
  cover_image_url: string | null
  home_ground: string | null
  captain: string | null
  coach: string | null
  year_founded: number | null
  description: string | null
  social_links: Record<string, string> | null
  status: string
}

type LeagueDetail = {
  id: number
  name: string
  slug: string
  category: string | null
  banner_url: string | null
  logo_url: string | null
  status: string
  description: string | null
  seasons: Array<{
    id: number
    name: string
    slug: string
    start_date: string | null
    end_date: string | null
    status: string
  }>
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
  const [tab, setTab] = useState<'overview' | 'squad' | 'upcoming' | 'results'>('overview')
  const { map: teamsMap } = useTeamsMap()
  const playersQ = useQuery({
    queryKey: ['team-players', data?.id ?? 'none'],
    queryFn: async () =>
      extractList<{ id: number; full_name: string; role: string | null; jersey_number: number | null; profile_photo_url: string | null }>(
        await fetchJson<unknown>(`/public/players?page=1&page_size=40&team_id=${data?.id ?? -1}`),
      ),
    enabled: Boolean(data?.id),
    retry: 1,
  })
  const fixturesQ = useQuery({
    queryKey: ['team-fixtures', data?.id ?? 'none'],
    queryFn: async () =>
      extractList<MatchLite>(await fetchJson<unknown>(`/public/fixtures?page=1&page_size=12&team_id=${data?.id ?? -1}`)),
    enabled: Boolean(data?.id),
    retry: 1,
  })
  const resultsQ = useQuery({
    queryKey: ['team-results', data?.id ?? 'none'],
    queryFn: async () =>
      extractList<MatchLite>(await fetchJson<unknown>(`/public/results?page=1&page_size=12&team_id=${data?.id ?? -1}`)),
    enabled: Boolean(data?.id),
    retry: 1,
  })

  return (
    <main className="container">
      <section className="menu-page">
        {isLoading ? <Spinner label="Loading team..." /> : null}
        {isError ? <ErrorNotice message="Could not load team details." /> : null}
        {data ? (
          <>
            <PageHero
              title={data.name}
              subtitle={`${formatCategoryLabel(data.category)} • ${data.home_ground ?? 'Venue TBC'} • ${data.status}`}
              imageUrl={resolveMediaUrl(data.cover_image_url) ?? resolveMediaUrl(data.logo_url)}
            />
            <div className="detail-tabs">
              {(['overview', 'squad', 'upcoming', 'results'] as const).map((item) => (
                <button key={item} type="button" className={tab === item ? 'is-active' : ''} onClick={() => setTab(item)}>
                  {item}
                </button>
              ))}
            </div>
            {tab === 'overview' ? (
              <div className="menu-list">
                <article className="menu-list-item">
                  <div>
                    <h2>Leadership</h2>
                    <p>Captain: {data.captain ?? 'TBA'} • Coach: {data.coach ?? 'TBA'}</p>
                  </div>
                </article>
                <article className="menu-list-item">
                  <div>
                    <h2>Founded</h2>
                    <p>{data.year_founded ?? 'N/A'}</p>
                  </div>
                </article>
                <article className="menu-list-item">
                  <div>
                    <h2>About</h2>
                    <p>{data.description ?? 'Team profile coming soon.'}</p>
                  </div>
                </article>
              </div>
            ) : null}
            {tab === 'squad' ? (
              <div className="home-grid home-grid--players">
                {(playersQ.data ?? []).map((player) => (
                  <PlayerCard key={player.id} player={player} />
                ))}
              </div>
            ) : null}
            {tab === 'upcoming' ? (
              <div className="home-grid home-grid--matches">
                {(fixturesQ.data ?? []).map((match) => (
                  <MatchCard key={match.id} match={match} teamsMap={teamsMap} />
                ))}
              </div>
            ) : null}
            {tab === 'results' ? (
              <div className="home-grid home-grid--matches">
                {(resultsQ.data ?? []).map((match) => (
                  <MatchCard key={match.id} match={match} teamsMap={teamsMap} mode="result" />
                ))}
              </div>
            ) : null}
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
  const { map: teamsMap } = useTeamsMap()
  const [seasonTab, setSeasonTab] = useState<string>('all')
  const seasonQuery = useQuery({
    queryKey: ['league-season-detail', slug, seasonTab],
    queryFn: () => fetchJson<SeasonDetail>(`/public/leagues/${slug}/seasons/${seasonTab}`),
    enabled: Boolean(slug) && seasonTab !== 'all',
    retry: 1,
  })

  return (
    <main className="container">
      <section className="menu-page">
        {isLoading ? <Spinner label="Loading league..." /> : null}
        {isError ? <ErrorNotice message="Could not load league details." /> : null}
        {data ? (
          <>
            <PageHero
              title={data.name}
              subtitle={`${formatCategoryLabel(data.category)} • ${data.status}`}
              imageUrl={resolveMediaUrl(data.banner_url) ?? resolveMediaUrl(data.logo_url)}
            />
            <p className="menu-page-copy">{data.description ?? 'League overview coming soon.'}</p>
            <SectionHeader title="Seasons" />
            <div className="detail-tabs">
              <button type="button" className={seasonTab === 'all' ? 'is-active' : ''} onClick={() => setSeasonTab('all')}>
                all
              </button>
              {data.seasons.map((season) => (
                <button
                  key={season.id}
                  type="button"
                  className={seasonTab === season.slug ? 'is-active' : ''}
                  onClick={() => setSeasonTab(season.slug)}
                >
                  {season.name}
                </button>
              ))}
            </div>
            <div className="menu-list">
              {(seasonTab === 'all' ? data.seasons : data.seasons.filter((s) => s.slug === seasonTab)).map((season) => (
                <article key={season.id} className="menu-list-item">
                  <div>
                    <h2>{season.name}</h2>
                    <p>{formatDateRange(season.start_date, season.end_date)} • {season.status}</p>
                    <Link to="/leagues/$leagueSlug/seasons/$seasonSlug" params={{ leagueSlug: slug, seasonSlug: season.slug }} className="menu-list-link">
                      Open season
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            {seasonQuery.data ? (
              <>
                <SectionHeader title="Teams in selected season" />
                <div className="home-grid home-grid--teams">
                  {seasonQuery.data.team_ids.map((teamId) => {
                    const team = teamsMap[teamId]
                    return team ? <TeamCard key={teamId} team={team} /> : null
                  })}
                </div>
              </>
            ) : null}
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
  const { map: teamsMap } = useTeamsMap()
  const [tab, setTab] = useState<'fixtures' | 'results'>('fixtures')
  const fixturesQ = useQuery({
    queryKey: ['season-fixtures', data?.id ?? 'none'],
    queryFn: async () =>
      extractList<MatchLite>(await fetchJson<unknown>(`/public/fixtures?page=1&page_size=20&season_id=${data?.id ?? -1}`)),
    enabled: Boolean(data?.id),
    retry: 1,
  })
  const resultsQ = useQuery({
    queryKey: ['season-results', data?.id ?? 'none'],
    queryFn: async () =>
      extractList<MatchLite>(await fetchJson<unknown>(`/public/results?page=1&page_size=20&season_id=${data?.id ?? -1}`)),
    enabled: Boolean(data?.id),
    retry: 1,
  })

  return (
    <main className="container">
      <section className="menu-page">
        {isLoading ? <Spinner label="Loading season..." /> : null}
        {isError ? <ErrorNotice message="Could not load season details." /> : null}
        {data ? (
          <>
            <PageHero title={data.name} subtitle={`${data.status} • ${formatDateRange(data.start_date, data.end_date)}`} />
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
            <SectionHeader title="Teams in season" />
            <div className="home-grid home-grid--teams">
              {data.team_ids.map((id) => (teamsMap[id] ? <TeamCard key={id} team={teamsMap[id]} /> : null))}
            </div>
            <SectionHeader title="Schedule" />
            <div className="detail-tabs">
              <button type="button" className={tab === 'fixtures' ? 'is-active' : ''} onClick={() => setTab('fixtures')}>
                fixtures
              </button>
              <button type="button" className={tab === 'results' ? 'is-active' : ''} onClick={() => setTab('results')}>
                results
              </button>
            </div>
            <div className="home-grid home-grid--matches">
              {(tab === 'fixtures' ? fixturesQ.data : resultsQ.data)?.map((match) => (
                <MatchCard key={match.id} match={match} teamsMap={teamsMap} mode={tab === 'fixtures' ? 'fixture' : 'result'} />
              )) ?? null}
            </div>
            {(tab === 'fixtures' ? fixturesQ.data : resultsQ.data)?.length === 0 ? (
              <EmptyState title={`No ${tab} available for this season`} />
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  )
}
