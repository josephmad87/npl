import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { EmptyState } from './components/EmptyState'
import { ErrorNotice } from './components/ErrorNotice'
import { PageHero } from './components/PageHero'
import { SectionHeader } from './components/SectionHeader'
import { Spinner } from './components/Spinner'
import { formatMatchDate } from './lib/formatters'
import { useTeamsMap } from './lib/hooks'
import { fetchJson, resolveMediaUrl } from './lib/publicApi'

type MatchDetail = {
  id: number
  season_id: number | null
  home_team_id: number
  away_team_id: number
  venue: string | null
  match_date: string | null
  status: string
  cover_image_url: string | null
  result: {
    winning_team_id: number | null
    margin_text: string | null
    score_summary: string | null
    player_of_match_player_id: number | null
  } | null
  season?: { slug?: string; league?: { slug?: string } | null } | null
  player_stats?: Array<{
    id: number
    team_id: number
    player_id: number
    runs: number
    balls_faced: number
    fours: number
    sixes: number
    dismissal: string | null
    wickets: number
    overs: string | number | null
    runs_conceded: number
  }>
}

export default function MatchDetailPage() {
  const { matchId } = useParams({ from: '/matches/$matchId' })
  const { map: teamsMap } = useTeamsMap()
  const [tab, setTab] = useState<'batting' | 'bowling'>('batting')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['match-detail', matchId],
    queryFn: () => fetchJson<MatchDetail>(`/public/matches/${matchId}`),
    retry: 1,
  })

  const home = data ? teamsMap[data.home_team_id] : null
  const away = data ? teamsMap[data.away_team_id] : null
  const stats = data?.player_stats ?? []

  const batting = [...stats].sort((a, b) => {
    const runsDelta = b.runs - a.runs
    if (runsDelta !== 0) return runsDelta
    return a.balls_faced - b.balls_faced
  })
  const bowling = [...stats].sort((a, b) => {
    const wicketDelta = b.wickets - a.wickets
    if (wicketDelta !== 0) return wicketDelta
    return a.runs_conceded - b.runs_conceded
  })

  const coverHero = data ? resolveMediaUrl(data.cover_image_url) : null
  const title = data
    ? `${home?.name ?? `Team ${data.home_team_id}`} vs ${away?.name ?? `Team ${data.away_team_id}`}`
    : ''
  const subtitle = data
    ? `${formatMatchDate(data.match_date)} • ${data.venue ?? 'Venue TBC'} • ${data.status}`
    : ''

  return (
    <>
      {data ? (
        coverHero ? (
          <PageHero title={title} subtitle={subtitle} imageUrl={coverHero} />
        ) : (
          <PageHero variant="siteLogo" title={title} subtitle={subtitle} />
        )
      ) : null}
      <main className="container">
        <section className="menu-page">
        {isLoading ? <Spinner label="Loading match..." /> : null}
        {isError ? <ErrorNotice message="Could not load match details." /> : null}
        {data ? (
          <>
            <div className="menu-list">
              <article className="menu-list-item">
                <div>
                  <h2>Result</h2>
                  <p>{data.result?.score_summary ?? 'Result pending'}</p>
                  {data.result?.margin_text ? <p>{data.result.margin_text}</p> : null}
                </div>
              </article>
            </div>
            <div className="detail-link-row">
              <Link to="/teams/$slug" params={{ slug: home?.slug ?? '' }}>Home team</Link>
              <Link to="/teams/$slug" params={{ slug: away?.slug ?? '' }}>Away team</Link>
              {data.season?.league?.slug && data.season?.slug ? (
                <Link
                  to="/leagues/$leagueSlug/seasons/$seasonSlug"
                  params={{ leagueSlug: data.season.league.slug, seasonSlug: data.season.slug }}
                >
                  Season
                </Link>
              ) : null}
            </div>
            <SectionHeader title="Scorecard" />
            <div className="detail-tabs">
              <button type="button" className={tab === 'batting' ? 'is-active' : ''} onClick={() => setTab('batting')}>
                batting
              </button>
              <button type="button" className={tab === 'bowling' ? 'is-active' : ''} onClick={() => setTab('bowling')}>
                bowling
              </button>
            </div>
            {tab === 'batting' ? (
              <table className="detail-table">
                <thead>
                  <tr>
                    <th>Player ID</th>
                    <th>Runs</th>
                    <th>Balls</th>
                    <th>4s</th>
                    <th>6s</th>
                    <th>Dismissal</th>
                  </tr>
                </thead>
                <tbody>
                  {batting.map((row) => (
                    <tr key={row.id}>
                      <td>{row.player_id}</td>
                      <td>{row.runs}</td>
                      <td>{row.balls_faced}</td>
                      <td>{row.fours}</td>
                      <td>{row.sixes}</td>
                      <td>{row.dismissal ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="detail-table">
                <thead>
                  <tr>
                    <th>Player ID</th>
                    <th>Wickets</th>
                    <th>Overs</th>
                    <th>Runs Conceded</th>
                  </tr>
                </thead>
                <tbody>
                  {bowling.map((row) => (
                    <tr key={row.id}>
                      <td>{row.player_id}</td>
                      <td>{row.wickets}</td>
                      <td>{String(row.overs ?? '-')}</td>
                      <td>{row.runs_conceded}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {stats.length === 0 ? <EmptyState title="No scorecard data for this match yet" /> : null}
          </>
        ) : null}
        </section>
      </main>
    </>
  )
}
