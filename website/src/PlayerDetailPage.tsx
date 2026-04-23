import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { useMemo } from 'react'
import logoFallbackSrc from './assets/logo.jpeg'
import { ErrorNotice } from './components/ErrorNotice'
import { SectionHeader } from './components/SectionHeader'
import { Spinner } from './components/Spinner'
import { formatCategoryLabel } from './lib/formatters'
import { useTeamsMap } from './lib/hooks'
import { fetchJson, resolveMediaUrl } from './lib/publicApi'

type PlayerDetail = {
  id: number
  full_name: string
  slug: string
  profile_photo_url: string | null
  team_id: number
  category: string
  date_of_birth: string | null
  nationality: string | null
  role: string | null
  batting_style: string | null
  bowling_style: string | null
  jersey_number: number | null
  bio: string | null
  debut_info: string | null
  status: string
  matches_played: number
  runs_scored: number
  batting_average: number | null
  strike_rate: number | null
  highest_score: number | null
  wickets_taken: number
  bowling_average: number | null
  economy_rate: number | null
  best_bowling: string | null
  catches: number
  stumpings: number
  player_of_match_awards: number
}

type PlayerMatchAppearance = {
  stat_id: number
  match_id: number
  match_date: string | null
  venue: string | null
  status: string
  home_team_id: number
  away_team_id: number
  home_team_name: string
  away_team_name: string
  league_name: string | null
  season_name: string | null
  season_id: number | null
  side_team_id: number
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  dismissal: string | null
  overs: number | null
  maidens: number
  runs_conceded: number
  wickets: number
  catches: number
  stumpings: number
  run_outs: number
  notes: string | null
}

function fmtRate(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toFixed(2)
}

function oversToBalls(overs: string | number | null | undefined): number {
  if (overs == null) return 0
  const raw = String(overs).trim()
  if (!raw) return 0
  if (!raw.includes('.')) {
    const whole = Number(raw)
    return Number.isFinite(whole) ? whole * 6 : 0
  }
  const [wholePart, fracPart = '0'] = raw.split('.')
  const whole = Number(wholePart)
  const balls = Number(fracPart.slice(0, 1))
  if (!Number.isFinite(whole) || !Number.isFinite(balls)) return 0
  return whole * 6 + Math.max(0, Math.min(5, balls))
}

function playerPhotoSrc(url: string | null | undefined): string {
  return resolveMediaUrl(url) ?? logoFallbackSrc
}

function statusClass(status: string): string {
  const s = status.toLowerCase()
  if (s === 'active') return 'player-public-status player-public-status--active'
  if (s === 'injured') return 'player-public-status player-public-status--injured'
  return 'player-public-status player-public-status--inactive'
}

export default function PlayerDetailPage() {
  const { slug } = useParams({ from: '/players/$slug' })
  const { map: teamsMap } = useTeamsMap()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['player-detail', slug],
    queryFn: () => fetchJson<PlayerDetail>(`/public/players/${slug}`),
    retry: 1,
  })

  const appearancesQ = useQuery({
    queryKey: ['player-appearances', slug],
    queryFn: () =>
      fetchJson<PlayerMatchAppearance[]>(
        `/public/players/${slug}/match-appearances`,
      ),
    enabled: Boolean(slug),
    retry: 1,
  })

  const team = data ? teamsMap[data.team_id] : null
  const appearances = useMemo(
    () => appearancesQ.data ?? [],
    [appearancesQ.data],
  )
  const scorecardCount = appearances.length

  const careerByLeague = useMemo(() => {
    type LeagueStats = {
      league: string
      matchIds: Set<number>
      runs: number
      ballsFaced: number
      outs: number
      highestScore: number
      wickets: number
      runsConceded: number
      bowlingBalls: number
      catches: number
      stumpings: number
      potm: number
      bestWickets: number
      bestRunsConceded: number | null
    }

    const byLeague = new Map<string, LeagueStats>()
    for (const row of appearances) {
      const leagueLabel = row.league_name ?? 'Unknown league'
      const next =
        byLeague.get(leagueLabel) ??
        ({
          league: leagueLabel,
          matchIds: new Set<number>(),
          runs: 0,
          ballsFaced: 0,
          outs: 0,
          highestScore: 0,
          wickets: 0,
          runsConceded: 0,
          bowlingBalls: 0,
          catches: 0,
          stumpings: 0,
          potm: 0,
          bestWickets: 0,
          bestRunsConceded: null,
        } satisfies LeagueStats)

      next.matchIds.add(row.match_id)
      next.runs += row.runs ?? 0
      next.ballsFaced += row.balls_faced ?? 0
      next.highestScore = Math.max(next.highestScore, row.runs ?? 0)
      next.wickets += row.wickets ?? 0
      next.runsConceded += row.runs_conceded ?? 0
      next.bowlingBalls += oversToBalls(row.overs)
      next.catches += row.catches ?? 0
      next.stumpings += row.stumpings ?? 0

      const dismissal = (row.dismissal ?? '').trim().toLowerCase()
      if (dismissal && dismissal !== 'not out' && dismissal !== 'retired hurt') {
        next.outs += 1
      }

      const wkts = row.wickets ?? 0
      const conceded = row.runs_conceded ?? 0
      const isBetterBest =
        wkts > next.bestWickets ||
        (wkts === next.bestWickets &&
          wkts > 0 &&
          (next.bestRunsConceded == null || conceded < next.bestRunsConceded))
      if (isBetterBest) {
        next.bestWickets = wkts
        next.bestRunsConceded = conceded
      }

      byLeague.set(leagueLabel, next)
    }

    return [...byLeague.values()]
      .sort((a, b) => a.league.localeCompare(b.league))
      .map((s) => {
        const matches = s.matchIds.size
        const battingAverage = s.outs > 0 ? s.runs / s.outs : null
        const strikeRate = s.ballsFaced > 0 ? (s.runs / s.ballsFaced) * 100 : null
        const bowlingAverage = s.wickets > 0 ? s.runsConceded / s.wickets : null
        const economy =
          s.bowlingBalls > 0 ? (s.runsConceded * 6) / s.bowlingBalls : null
        const best =
          s.bestWickets > 0 && s.bestRunsConceded != null
            ? `${s.bestWickets}/${s.bestRunsConceded}`
            : '—'

        return {
          league: s.league,
          matches,
          runs: s.runs,
          battingAverage,
          strikeRate,
          highestScore: s.highestScore,
          wickets: s.wickets,
          bowlingAverage,
          economy,
          best,
          catches: s.catches,
          stumpings: s.stumpings,
          potm: s.potm,
        }
      })
  }, [appearances])

  const heroSrc = data ? playerPhotoSrc(data.profile_photo_url) : logoFallbackSrc
  const teamLogoSrc = team?.logo_url ? resolveMediaUrl(team.logo_url) : null

  return (
    <main className="container">
      <section className="menu-page player-public-page">
        <div className="player-public-toolbar">
          {team ? (
            <Link
              to="/teams/$slug"
              params={{ slug: team.slug }}
              className="player-public-back"
            >
              ← {team.name}
            </Link>
          ) : (
            <Link to="/" className="player-public-back">
              ← Home
            </Link>
          )}
        </div>

        {isLoading ? <Spinner label="Loading player..." /> : null}
        {isError ? <ErrorNotice message="Could not load player profile." /> : null}
        {appearancesQ.isError ? (
          <ErrorNotice message="Could not load match history." />
        ) : null}

        {data ? (
          <>
            <article
              className="player-public-hero"
              aria-label={`${data.full_name} profile summary`}
            >
              <div className="player-public-hero__media">
                <img
                  src={heroSrc}
                  alt=""
                  loading="eager"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.src = logoFallbackSrc
                  }}
                />
              </div>
              <div className="player-public-hero__body">
                <h1 className="player-public-hero__name">{data.full_name}</h1>
                <p className="player-public-hero__subtitle">
                  {formatCategoryLabel(data.category)}
                  {data.role ? ` · ${data.role}` : ''}
                  {data.jersey_number != null ? ` · #${data.jersey_number}` : ''}
                </p>
                <div className="player-public-row">
                  <span className="player-public-row__label">Team</span>
                  <span className="player-public-row__value">
                    {team ? (
                      <Link
                        to="/teams/$slug"
                        params={{ slug: team.slug }}
                        className="player-public-team-link"
                      >
                        {teamLogoSrc ? (
                          <img
                            className="player-public-team-badge"
                            src={teamLogoSrc}
                            alt=""
                          />
                        ) : null}
                        <span>{team.name}</span>
                      </Link>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
                <div className="player-public-row">
                  <span className="player-public-row__label">Category</span>
                  <span className="player-public-row__value">
                    {formatCategoryLabel(data.category)}
                  </span>
                </div>
                <div className="player-public-row">
                  <span className="player-public-row__label">Role</span>
                  <span className="player-public-row__value">
                    {data.role ?? '—'}
                  </span>
                </div>
                <div className="player-public-row">
                  <span className="player-public-row__label">Jersey</span>
                  <span className="player-public-row__value">
                    {data.jersey_number != null ? String(data.jersey_number) : '—'}
                  </span>
                </div>
                {data.date_of_birth ? (
                  <div className="player-public-row">
                    <span className="player-public-row__label">Date of birth</span>
                    <span className="player-public-row__value">
                      {data.date_of_birth.slice(0, 10)}
                    </span>
                  </div>
                ) : null}
                {data.nationality ? (
                  <div className="player-public-row">
                    <span className="player-public-row__label">Nationality</span>
                    <span className="player-public-row__value">{data.nationality}</span>
                  </div>
                ) : null}
                {data.batting_style ? (
                  <div className="player-public-row">
                    <span className="player-public-row__label">Batting</span>
                    <span className="player-public-row__value">{data.batting_style}</span>
                  </div>
                ) : null}
                {data.bowling_style ? (
                  <div className="player-public-row">
                    <span className="player-public-row__label">Bowling</span>
                    <span className="player-public-row__value">{data.bowling_style}</span>
                  </div>
                ) : null}
                <div className="player-public-row">
                  <span className="player-public-row__label">Status</span>
                  <span className="player-public-row__value">
                    <span className={statusClass(data.status)}>{data.status}</span>
                  </span>
                </div>
              </div>
            </article>

            <section className="player-public-section" aria-label="Biography">
              <SectionHeader title="Profile" />
              <div className="player-public-prose">
                <p>
                  {data.bio ??
                    data.debut_info ??
                    'Career profile and biography coming soon.'}
                </p>
              </div>
            </section>

            <section className="player-public-section" aria-label="Career totals from profile">
              <SectionHeader title="Career totals (record)" />
              <p className="player-public-hint muted">
                Summary figures stored on the player record (may differ from
                scorecard-derived tables until synced).
              </p>
              <div className="player-public-stat-grid">
                <div className="player-public-stat-card">
                  <span className="player-public-stat-card__label">Matches</span>
                  <span className="player-public-stat-card__value">
                    {data.matches_played}
                  </span>
                </div>
                <div className="player-public-stat-card">
                  <span className="player-public-stat-card__label">Runs</span>
                  <span className="player-public-stat-card__value">
                    {data.runs_scored}
                  </span>
                </div>
                <div className="player-public-stat-card">
                  <span className="player-public-stat-card__label">Average</span>
                  <span className="player-public-stat-card__value">
                    {fmtRate(data.batting_average)}
                  </span>
                </div>
                <div className="player-public-stat-card">
                  <span className="player-public-stat-card__label">Strike rate</span>
                  <span className="player-public-stat-card__value">
                    {fmtRate(data.strike_rate)}
                  </span>
                </div>
                <div className="player-public-stat-card">
                  <span className="player-public-stat-card__label">High score</span>
                  <span className="player-public-stat-card__value">
                    {data.highest_score ?? '—'}
                  </span>
                </div>
                <div className="player-public-stat-card">
                  <span className="player-public-stat-card__label">Wickets</span>
                  <span className="player-public-stat-card__value">
                    {data.wickets_taken}
                  </span>
                </div>
                <div className="player-public-stat-card">
                  <span className="player-public-stat-card__label">Bowl avg</span>
                  <span className="player-public-stat-card__value">
                    {fmtRate(data.bowling_average)}
                  </span>
                </div>
                <div className="player-public-stat-card">
                  <span className="player-public-stat-card__label">Economy</span>
                  <span className="player-public-stat-card__value">
                    {fmtRate(data.economy_rate)}
                  </span>
                </div>
                <div className="player-public-stat-card">
                  <span className="player-public-stat-card__label">Best bowling</span>
                  <span className="player-public-stat-card__value">
                    {data.best_bowling ?? '—'}
                  </span>
                </div>
                <div className="player-public-stat-card">
                  <span className="player-public-stat-card__label">Catches</span>
                  <span className="player-public-stat-card__value">{data.catches}</span>
                </div>
                <div className="player-public-stat-card">
                  <span className="player-public-stat-card__label">Stumpings</span>
                  <span className="player-public-stat-card__value">{data.stumpings}</span>
                </div>
                <div className="player-public-stat-card">
                  <span className="player-public-stat-card__label">Player of match</span>
                  <span className="player-public-stat-card__value">
                    {data.player_of_match_awards}
                  </span>
                </div>
              </div>
            </section>

            <section className="player-public-section" aria-label="Career by league">
              <SectionHeader title="Career record (by league)" />
              <p className="player-public-hint muted">
                Derived from scorecard rows in the match log, grouped by league.
              </p>
              {appearancesQ.isLoading ? (
                <Spinner label="Loading scorecard data…" />
              ) : (
                <div className="player-public-table-wrap">
                  <table className="player-public-table">
                    <thead>
                      <tr>
                        <th>League</th>
                        <th>Matches</th>
                        <th>Runs</th>
                        <th>Avg</th>
                        <th>SR</th>
                        <th>HS</th>
                        <th>Wkts</th>
                        <th>Bowl avg</th>
                        <th>Econ</th>
                        <th>Best</th>
                        <th>Ct</th>
                        <th>St</th>
                        <th>POTM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {careerByLeague.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="muted">
                            No scorecard rows yet.
                          </td>
                        </tr>
                      ) : (
                        careerByLeague.map((row) => (
                          <tr key={row.league}>
                            <td>{row.league}</td>
                            <td>{row.matches}</td>
                            <td>{row.runs}</td>
                            <td>{fmtRate(row.battingAverage)}</td>
                            <td>{fmtRate(row.strikeRate)}</td>
                            <td>{row.highestScore}</td>
                            <td>{row.wickets}</td>
                            <td>{fmtRate(row.bowlingAverage)}</td>
                            <td>{fmtRate(row.economy)}</td>
                            <td>{row.best}</td>
                            <td>{row.catches}</td>
                            <td>{row.stumpings}</td>
                            <td>{row.potm}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="player-public-section" aria-label="Match log">
              <SectionHeader title={`Match log (${scorecardCount})`} />
              <p className="player-public-hint muted">
                One row per fixture where this player appears on the submitted
                scorecard. Open a match for full detail.
              </p>
              {appearances.length === 0 && !appearancesQ.isLoading ? (
                <p className="muted">No scorecard rows yet.</p>
              ) : appearances.length > 0 ? (
                <div className="player-public-table-wrap player-public-table-wrap--wide">
                  <table className="player-public-table player-public-table--compact">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Competition</th>
                        <th>Fixture</th>
                        <th>Side</th>
                        <th>R</th>
                        <th>BF</th>
                        <th>4s</th>
                        <th>6s</th>
                        <th>Out</th>
                        <th>Ov</th>
                        <th>M</th>
                        <th>Conc</th>
                        <th>W</th>
                        <th>Ct</th>
                        <th>St</th>
                        <th>RO</th>
                        <th>Notes</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {appearances.map((row) => {
                        const home = row.side_team_id === row.home_team_id
                        const opp = home ? row.away_team_name : row.home_team_name
                        const comp =
                          row.league_name && row.season_name
                            ? `${row.league_name} · ${row.season_name}`
                            : row.season_name ?? row.league_name ?? '—'
                        const when = row.match_date?.slice(0, 10) ?? '—'
                        return (
                          <tr key={row.stat_id}>
                            <td>{when}</td>
                            <td>{comp}</td>
                            <td>
                              <span className="player-public-fixture-mini">
                                {row.home_team_name} vs {row.away_team_name}
                              </span>
                            </td>
                            <td>
                              {home ? 'Home' : 'Away'} ({opp})
                            </td>
                            <td>{row.runs}</td>
                            <td>{row.balls_faced}</td>
                            <td>{row.fours}</td>
                            <td>{row.sixes}</td>
                            <td>{row.dismissal ?? '—'}</td>
                            <td>{row.overs != null ? String(row.overs) : '—'}</td>
                            <td>{row.maidens}</td>
                            <td>{row.runs_conceded}</td>
                            <td>{row.wickets}</td>
                            <td>{row.catches}</td>
                            <td>{row.stumpings}</td>
                            <td>{row.run_outs}</td>
                            <td>{row.notes ?? '—'}</td>
                            <td>
                              <Link
                                to="/matches/$matchId"
                                params={{ matchId: String(row.match_id) }}
                                className="player-public-match-link"
                              >
                                Match
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </section>
    </main>
  )
}
