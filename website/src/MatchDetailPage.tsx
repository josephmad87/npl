import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import nplLogoUrl from './assets/logo.png'
import { ErrorNotice } from './components/ErrorNotice'
import { InningsScorecardPanels } from './components/InningsScorecardPanels'
import { Spinner } from './components/Spinner'
import { getInningsSides, type InningsNumber } from './lib/cricket'
import { formatCategoryLabel, formatMatchDate } from './lib/formatters'
import { type MatchLite, useTeamsMap } from './lib/hooks'
import {
  matchResultSummaryLine,
  matchWinnerSide,
} from './lib/match-result'
import { formatExtrasBreakdown } from './lib/match-extras'
import { fetchAllPaginatedList, fetchJson, resolveMediaUrl } from './lib/publicApi'

type MatchResultDetail = {
  winning_team_id: number | null
  batting_first_team_id: number | null
  margin_text: string | null
  score_summary: string | null
  innings_breakdown: string | null
  top_performers: string | null
  player_of_match_player_id: number | null
  match_report: string | null
  home_extras_wides?: number
  home_extras_byes?: number
  home_extras_no_balls?: number
  home_extras_leg_byes?: number
  away_extras_wides?: number
  away_extras_byes?: number
  away_extras_no_balls?: number
  away_extras_leg_byes?: number
}

type MatchPlayerStat = {
  id: number
  player_id: number
  team_id: number
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  dismissal: string | null
  overs: string | number | null
  maidens: number
  runs_conceded: number
  wickets: number
  catches: number
  stumpings: number
  run_outs: number
  notes: string | null
}

type MatchDetail = {
  id: number
  season_id: number | null
  category: string
  home_team_id: number
  away_team_id: number
  title: string | null
  venue: string | null
  match_date: string | null
  start_time: string | null
  toss_info: string | null
  umpires: string | null
  description: string | null
  status: string
  result: MatchResultDetail | null
  player_stats: MatchPlayerStat[]
  season: {
    id: number
    league_id: number
    name: string
    slug: string
    league: { id: number; name: string; slug: string }
  } | null
}

type PublicPlayerRow = { id: number; full_name: string }

const NO_PLAYER_STATS: MatchPlayerStat[] = []

function fixturesHrefForMatch(category: string | null | undefined): string {
  const c = (category ?? '').trim().toLowerCase()
  if (c === 'mens' || c === 'men' || c === 'man') return '/mens/fixtures'
  if (
    c === 'women' ||
    c === 'womens' ||
    c === 'ladies' ||
    c === 'lady' ||
    c === 'woman'
  ) {
    return '/women/fixtures'
  }
  if (c === 'youth') return '/youth/fixtures'
  return '/fixtures'
}

function matchStatusPillClass(status: string | undefined): string {
  const s = (status ?? 'scheduled').toLowerCase()
  if (s === 'completed') return 'match-centre__status-pill--completed'
  if (s === 'live') return 'match-centre__status-pill--live'
  if (s === 'postponed' || s === 'abandoned' || s === 'cancelled') {
    return 'match-centre__status-pill--inactive'
  }
  return 'match-centre__status-pill--scheduled'
}

function formatStatusLabel(status: string | undefined): string {
  return (status ?? 'scheduled').replaceAll('_', ' ').toUpperCase()
}

function TeamLogoWithFallback({
  logoUrl,
  className,
  alt,
}: {
  logoUrl: string | null
  className: string
  alt: string
}) {
  const initial = resolveMediaUrl(logoUrl) ?? nplLogoUrl
  const [src, setSrc] = useState(initial)
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setSrc(nplLogoUrl)}
    />
  )
}

function MatchCentreHeroLogo({ logoUrl, isWinner }: { logoUrl: string | null; isWinner: boolean }) {
  const initial = resolveMediaUrl(logoUrl) ?? nplLogoUrl
  const [src, setSrc] = useState(initial)
  return (
    <span
      className={`match-centre-hero__badge-wrap${
        isWinner ? ' match-centre-hero__badge-wrap--winner' : ''
      }`}
      aria-label={isWinner ? 'Winner' : undefined}
    >
      <img
        className="match-centre-hero__logo"
        src={src}
        alt=""
        loading="eager"
        decoding="async"
        onError={() => setSrc(nplLogoUrl)}
      />
      {isWinner ? (
        <span className="match-centre-hero__cup" aria-hidden title="Winner">
          🏆
        </span>
      ) : null}
    </span>
  )
}

export default function MatchDetailPage() {
  const { matchId } = useParams({ from: '/matches/$matchId' })
  const { map: teamsMap } = useTeamsMap()
  const [scorecardInnings, setScorecardInnings] = useState<InningsNumber>(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['match-detail', matchId],
    queryFn: () => fetchJson<MatchDetail>(`/public/matches/${matchId}`),
    retry: 1,
  })

  const home = data ? teamsMap[data.home_team_id] : null
  const away = data ? teamsMap[data.away_team_id] : null
  const homeName = home?.name ?? `Team ${data?.home_team_id ?? ''}`
  const awayName = away?.name ?? `Team ${data?.away_team_id ?? ''}`

  const homePlayersQ = useQuery({
    queryKey: ['match-players', 'home', data?.home_team_id],
    queryFn: async () =>
      fetchAllPaginatedList<PublicPlayerRow>((page) =>
        `/public/players?page=${page}&page_size=100&team_id=${data?.home_team_id ?? -1}&include_inactive=true`,
      ),
    enabled: Boolean(data?.home_team_id),
    retry: 1,
  })

  const awayPlayersQ = useQuery({
    queryKey: ['match-players', 'away', data?.away_team_id],
    queryFn: async () =>
      fetchAllPaginatedList<PublicPlayerRow>((page) =>
        `/public/players?page=${page}&page_size=100&team_id=${data?.away_team_id ?? -1}&include_inactive=true`,
      ),
    enabled: Boolean(data?.away_team_id),
    retry: 1,
  })

  const playerById = useMemo(() => {
    const m = new Map<number, string>()
    for (const p of homePlayersQ.data ?? []) {
      m.set(p.id, p.full_name)
    }
    for (const p of awayPlayersQ.data ?? []) {
      m.set(p.id, p.full_name)
    }
    return m
  }, [homePlayersQ.data, awayPlayersQ.data])

  const playerStats = data?.player_stats ?? NO_PLAYER_STATS
  const battingFirstTeamId = data?.result?.batting_first_team_id ?? null
  const inningsExtrasLine = useMemo(() => {
    if (!data?.result) return null
    const sides = getInningsSides(
      scorecardInnings,
      battingFirstTeamId,
      data.home_team_id,
      data.away_team_id,
    )
    if (!sides) return null
    const side =
      sides.battingTeamId === data.home_team_id ? 'home' : 'away'
    return formatExtrasBreakdown(data.result, side)
  }, [data, scorecardInnings, battingFirstTeamId])

  const title = data
    ? `${homeName} vs ${awayName}`
    : 'Match'
  const matchLite = data as unknown as MatchLite
  const headerWinner = data ? matchWinnerSide(matchLite) : null
  const resultLine = data ? matchResultSummaryLine(matchLite) : null

  const descriptionLine = useMemo(() => {
    if (!data) return ''
    const parts: string[] = []
    if (data.season) {
      parts.push(`${data.season.league.name} · ${data.season.name}`)
    } else if (data.season_id != null) {
      parts.push(`Season id ${data.season_id}`)
    } else {
      parts.push('No season')
    }
    parts.push(formatCategoryLabel(data.category))
    parts.push(`Match ${data.id}`)
    if (resultLine) {
      parts.push(resultLine)
    }
    return parts.join(' · ')
  }, [data, resultLine])

  const whenValue = useMemo(() => {
    if (!data) return '—'
    const dateToken =
      data.match_date?.trim() ??
      (data.start_time != null
        ? String(data.start_time).slice(0, 10)
        : null)
    if (!dateToken) return '—'
    return formatMatchDate(dateToken)
  }, [data])

  const showResultBlock =
    data != null && (data.result != null || playerStats.length > 0)
  const playersLoading = homePlayersQ.isLoading || awayPlayersQ.isLoading

  if (isLoading) {
    return (
      <main className="container">
        <div className="menu-page">
          <Spinner label="Loading match…" />
        </div>
      </main>
    )
  }

  if (isError || !data) {
    return (
      <main className="container">
        <div className="menu-page">
          <ErrorNotice message="Could not load match details." />
          <p className="match-centre-back">
            <Link to={fixturesHrefForMatch(undefined)}>Back to fixtures</Link>
          </p>
        </div>
      </main>
    )
  }

  return (
    <>
      <header className="match-centre-hero" aria-label="Match summary">
        <div className="match-centre-hero__badges">
          <MatchCentreHeroLogo
            logoUrl={home?.logo_url ?? null}
            isWinner={headerWinner === 'home'}
          />
          <span className="match-centre-hero__vs">vs</span>
          <MatchCentreHeroLogo
            logoUrl={away?.logo_url ?? null}
            isWinner={headerWinner === 'away'}
          />
        </div>
        <h1 className="match-centre-hero__title">{title}</h1>
        <p className="match-centre-hero__desc">{descriptionLine}</p>
      </header>

    <main className="container">
        <section className="menu-page match-centre">
          <div className="match-centre-panels">
            <div className="match-centre-panels__col">
              <div className="match-centre-panel">
                <dl className="match-centre-detail">
                  <div className="match-centre-detail__row">
                    <dt>League · season</dt>
                    <dd>
                      {data.season
                        ? `${data.season.league.name} — ${data.season.name}`
                        : '—'}
                    </dd>
                  </div>
                  <div className="match-centre-detail__row">
                    <dt>When</dt>
                    <dd>{whenValue}</dd>
                  </div>
                  <div className="match-centre-detail__row">
                    <dt>Venue</dt>
                    <dd>{data.venue?.trim() ? data.venue : '—'}</dd>
                  </div>
                  {data.title?.trim() ? (
                    <div className="match-centre-detail__row">
                      <dt>Title</dt>
                      <dd>{data.title}</dd>
                    </div>
                  ) : null}
                  {data.toss_info?.trim() ? (
                    <div className="match-centre-detail__row">
                      <dt>Toss</dt>
                      <dd>{data.toss_info}</dd>
                    </div>
                  ) : null}
                  {data.umpires?.trim() ? (
                    <div className="match-centre-detail__row">
                      <dt>Umpires</dt>
                      <dd>{data.umpires}</dd>
                    </div>
                  ) : null}
                  {data.description?.trim() ? (
                    <div className="match-centre-detail__row">
                      <dt>Notes</dt>
                      <dd>{data.description}</dd>
                    </div>
                  ) : null}
                  <div className="match-centre-detail__row">
                    <dt>Category</dt>
                    <dd>{formatCategoryLabel(data.category)}</dd>
                  </div>
                  <div className="match-centre-detail__row">
                    <dt>Home</dt>
                    <dd>
                      <span className="match-centre-team-cell">
                        <TeamLogoWithFallback
                          logoUrl={home?.logo_url ?? null}
                          className="match-centre-team-cell__logo"
                          alt=""
                        />
                        <span>{homeName}</span>
                      </span>
                    </dd>
                  </div>
                  <div className="match-centre-detail__row">
                    <dt>Away</dt>
                    <dd>
                      <span className="match-centre-team-cell">
                        <TeamLogoWithFallback
                          logoUrl={away?.logo_url ?? null}
                          className="match-centre-team-cell__logo"
                          alt=""
                        />
                        <span>{awayName}</span>
                      </span>
                    </dd>
                  </div>
                  <div className="match-centre-detail__row">
                    <dt>Status</dt>
                    <dd>
                      <span
                        className={`match-centre__status-pill ${matchStatusPillClass(
                          data.status,
                        )}`}
                      >
                        {formatStatusLabel(data.status)}
                      </span>
                    </dd>
                  </div>
                </dl>
                </div>
            </div>

            <div className="match-centre-panels__col">
              {showResultBlock ? (
                <section className="match-centre-panel match-centre-panel--result">
                  <h2 className="match-centre-panel__h">Result &amp; player stats</h2>
                  {data.result ? (
                    <div className="match-centre-result">
                      {data.result.score_summary ? (
                        <p>
                          <strong>Score:</strong> {data.result.score_summary}
                        </p>
                      ) : null}
                      {data.result.margin_text ? (
                        <p>
                          <strong>Margin:</strong> {data.result.margin_text}
                        </p>
                      ) : null}
                      {data.result.winning_team_id != null ? (
                        <p>
                          <strong>Winner:</strong>{' '}
                          <span aria-hidden title="Winner">
                            🏆
                          </span>{' '}
                          {data.result.winning_team_id === data.home_team_id
                            ? homeName
                            : data.result.winning_team_id === data.away_team_id
                              ? awayName
                              : `Team #${data.result.winning_team_id}`}
                        </p>
                      ) : null}
                      {data.result.player_of_match_player_id != null ? (
                        <p>
                          <strong>Player of the match:</strong>{' '}
                          {playerById.get(
                            data.result.player_of_match_player_id,
                          ) ?? `#${data.result.player_of_match_player_id}`}
                        </p>
                      ) : null}
                      {data.result.innings_breakdown ? (
                        <p>
                          <strong>Innings:</strong>{' '}
                          {data.result.innings_breakdown}
                        </p>
                      ) : null}
                      {data.result.top_performers ? (
                        <p>
                          <strong>Top performers:</strong>{' '}
                          {data.result.top_performers}
                        </p>
                      ) : null}
                      {data.result.match_report ? (
                        <p>
                          <strong>Report:</strong> {data.result.match_report}
                        </p>
                      ) : null}
                    </div>
              ) : null}
                </section>
              ) : (
                <p className="match-centre-empty-hint">No result or scorecard yet.</p>
              )}
            </div>
          </div>

          <section className="match-centre-scorecard" aria-labelledby="match-scorecard-title">
            <div className="match-centre-scorecard__head">
              <h2 id="match-scorecard-title" className="match-centre-panel__h">
                Scorecard
              </h2>
              <div
                className="match-centre-tabs"
                role="tablist"
                aria-label="Scorecard innings"
              >
                <button
                  type="button"
                  className={scorecardInnings === 1 ? 'is-active' : ''}
                  onClick={() => setScorecardInnings(1)}
                  role="tab"
                  aria-selected={scorecardInnings === 1}
                >
                  1st innings
                </button>
                <button
                  type="button"
                  className={scorecardInnings === 2 ? 'is-active' : ''}
                  onClick={() => setScorecardInnings(2)}
                  role="tab"
                  aria-selected={scorecardInnings === 2}
                >
                  2nd innings
                </button>
              </div>
            </div>
            {playersLoading ? (
              <p className="match-centre-muted">Loading player names…</p>
            ) : null}
            {playerStats.length > 0 ? (
              <InningsScorecardPanels
                innings={scorecardInnings}
                battingFirstTeamId={battingFirstTeamId}
                homeTeamId={data.home_team_id}
                awayTeamId={data.away_team_id}
                homeLabel={homeName}
                awayLabel={awayName}
                stats={playerStats}
                playerName={(id) => playerById.get(id) ?? `#${id}`}
                extrasLine={inningsExtrasLine}
              />
            ) : (
              <p className="match-centre-muted">No per-player rows yet.</p>
            )}
          </section>
      </section>
    </main>
    </>
  )
}
