import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAllPaginatedList, fetchJson } from '../lib/publicApi'

export type LiveBallEvent = {
  id: number
  match_id: number
  innings: number
  over_number: number
  ball_number: number
  batting_team_id: number
  bowling_team_id: number
  striker_player_id: number
  non_striker_player_id: number | null
  bowler_player_id: number
  runs_batter: number
  runs_extras: number
  extras_type: string | null
  is_legal_delivery: boolean
  completed_runs?: number
  boundary_runs?: number
  boundary_type?: string | null
  penalty_runs_batting?: number
  penalty_runs_fielding?: number
  short_runs?: number
  is_dead_ball?: boolean
  wicket_type: string | null
  wicket_player_id: number | null
  fielder_player_id?: number | null
  wicket_end?: 'striker' | 'non_striker' | null
  batters_crossed?: boolean
  dismissal_text: string | null
  notes: string | null
  sequence_number: number
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

export type LiveInningsSummary = {
  innings: number
  batting_team_id: number
  bowling_team_id: number
  runs: number
  wickets: number
  legal_balls: number
  overs_label: string
  last_six: string[]
  last_event: LiveBallEvent | null
}

export type LiveScoreState = {
  match_id: number
  status: string
  current_innings: number | null
  summaries: LiveInningsSummary[]
  events: LiveBallEvent[]
}

type PublicPlayer = {
  id: number
  full_name: string
  team_id: number
}

type TeamNameMap = Record<number, string | undefined>

type CommentaryDelivery = {
  event: LiveBallEvent
  ballLabel: string
  token: string
  header: string
  detail: string
}

type OverCommentaryGroup = {
  key: string
  overNumber: number
  summaryLabel: string
  runsText: string
  scoreText: string
  battersText: string
  bowlerText: string
  deliveries: CommentaryDelivery[]
}

type BatterMiniStat = {
  runs: number
  balls: number
  fours: number
  sixes: number
}

type BowlerMiniStat = {
  runs: number
  balls: number
  wickets: number
  maidens: number
  currentOverRuns: Map<string, number>
}

const BOWLER_CREDIT_WICKETS = new Set([
  'bowled',
  'caught',
  'caught_and_bowled',
  'lbw',
  'stumped',
  'hit_wicket',
])

function inningsLabel(innings: number): string {
  if (innings === 1) return '1st innings'
  if (innings === 2) return '2nd innings'
  if (innings === 3) return '3rd innings'
  return `${innings}th innings`
}

function scoreLine(summary: LiveInningsSummary | null): string {
  if (!summary) return '0/0 (0.0)'
  return `${summary.runs}/${summary.wickets} (${summary.overs_label})`
}

function teamName(teamId: number | null | undefined, teamNames: TeamNameMap): string {
  if (teamId == null) return 'Team'
  return teamNames[teamId] ?? `Team ${teamId}`
}

function playerName(playerById: Map<number, PublicPlayer>, playerId: number | null | undefined): string {
  if (!playerId) return '—'
  return playerById.get(playerId)?.full_name ?? `#${playerId}`
}

function dismissalLabel(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function eventTotalRuns(event: LiveBallEvent): number {
  return (
    (event.runs_batter ?? 0) +
    (event.runs_extras ?? 0) +
    (event.penalty_runs_batting ?? 0)
  )
}

function batterBallCounts(event: LiveBallEvent): boolean {
  if (event.is_dead_ball) return false
  if (event.is_legal_delivery === false) return false
  return event.extras_type !== 'wide'
}

function bowlerRunsConceded(event: LiveBallEvent): number {
  const extrasType = event.extras_type
  if (event.is_dead_ball) return 0
  if (extrasType === 'bye' || extrasType === 'leg_bye') return 0
  if (extrasType === 'no_ball_bye' || extrasType === 'no_ball_leg_bye') return 1
  if (extrasType === 'wide') return event.runs_extras ?? 0
  return (event.runs_batter ?? 0) + (event.runs_extras ?? 0)
}

function oversLabelFromBalls(totalBalls: number): string {
  return `${Math.floor(totalBalls / 6)}.${totalBalls % 6}`
}

function deliveryResultText(event: LiveBallEvent): string {
  if (event.is_dead_ball) {
    if (event.penalty_runs_batting) return `${event.penalty_runs_batting} penalty runs`
    if (event.penalty_runs_fielding) return `${event.penalty_runs_fielding} penalty runs to fielding side`
    return 'dead ball'
  }

  if (event.wicket_type) return 'OUT'

  const extrasType = event.extras_type
  const batterRuns = event.runs_batter ?? 0
  const extrasRuns = event.runs_extras ?? 0

  if (extrasType === 'wide') return extrasRuns === 1 ? 'wide' : `${extrasRuns} wides`
  if (extrasType === 'no_ball') return batterRuns > 0 ? `${batterRuns} run${batterRuns === 1 ? '' : 's'} + no ball` : 'no ball'
  if (extrasType === 'bye') return extrasRuns === 1 ? 'bye' : `${extrasRuns} byes`
  if (extrasType === 'leg_bye') return extrasRuns === 1 ? 'leg bye' : `${extrasRuns} leg byes`
  if (extrasType === 'no_ball_bye') return `no ball + ${Math.max(0, extrasRuns - 1)} bye${extrasRuns - 1 === 1 ? '' : 's'}`
  if (extrasType === 'no_ball_leg_bye') return `no ball + ${Math.max(0, extrasRuns - 1)} leg bye${extrasRuns - 1 === 1 ? '' : 's'}`
  if (extrasType === 'penalty') return `${event.penalty_runs_batting || event.penalty_runs_fielding || 0} penalty runs`

  if (batterRuns === 0) return 'no run'
  if (batterRuns === 1) return '1 run'
  return `${batterRuns} runs`
}

function deliveryToken(event: LiveBallEvent): string {
  if (event.is_dead_ball) {
    if (event.penalty_runs_batting) return `+${event.penalty_runs_batting}`
    if (event.penalty_runs_fielding) return `P${event.penalty_runs_fielding}`
    return '•'
  }
  if (event.wicket_type) return 'W'

  const extrasType = event.extras_type
  const batterRuns = event.runs_batter ?? 0
  const extrasRuns = event.runs_extras ?? 0

  if (extrasType === 'wide') return extrasRuns === 1 ? 'wd' : `${extrasRuns}wd`
  if (extrasType === 'no_ball') return batterRuns > 0 ? `${batterRuns}+nb` : 'nb'
  if (extrasType === 'bye') return `${extrasRuns}b`
  if (extrasType === 'leg_bye') return `${extrasRuns}lb`
  if (extrasType === 'no_ball_bye') return `nb+${Math.max(0, extrasRuns - 1)}b`
  if (extrasType === 'no_ball_leg_bye') return `nb+${Math.max(0, extrasRuns - 1)}lb`
  if (extrasType === 'penalty') return `P${event.penalty_runs_batting || event.penalty_runs_fielding || 0}`
  if (batterRuns === 0) return '•'
  return String(batterRuns)
}

function deliveryDetail(event: LiveBallEvent, playerById: Map<number, PublicPlayer>): string {
  const note = event.notes?.trim()
  if (note) return note

  if (event.wicket_type) {
    const outName = playerName(playerById, event.wicket_player_id)
    const fielder = event.fielder_player_id ? playerName(playerById, event.fielder_player_id) : ''
    const dismissal = dismissalLabel(event.wicket_type)
    const fielderText = fielder ? `, fielder: ${fielder}` : ''
    const endText = event.wicket_end ? `, ${event.wicket_end.replace('_', '-')} end` : ''
    const crossedText = event.batters_crossed ? ', batters crossed' : ''
    return event.dismissal_text?.trim() || `${outName} is out ${dismissal}${fielderText}${endText}${crossedText}.`
  }

  const result = deliveryResultText(event)
  const boundaryText = event.boundary_type ? ` Boundary ${event.boundary_runs || event.runs_batter}.` : ''
  const shortText = event.short_runs ? ` ${event.short_runs} short run${event.short_runs === 1 ? '' : 's'} called.` : ''
  return `${result.charAt(0).toUpperCase()}${result.slice(1)}.${boundaryText}${shortText}`
}

function formatBatterMini(name: string, stat: BatterMiniStat | undefined): string {
  const row = stat ?? { runs: 0, balls: 0, fours: 0, sixes: 0 }
  const boundaries = [row.fours ? `${row.fours}x4` : '', row.sixes ? `${row.sixes}x6` : ''].filter(Boolean).join(' ')
  return `${name} ${row.runs} (${row.balls}b${boundaries ? ` ${boundaries}` : ''})`
}

function formatBowlerMini(name: string, stat: BowlerMiniStat | undefined): string {
  if (!stat) return name
  return `${name} ${oversLabelFromBalls(stat.balls)}-${stat.maidens}-${stat.runs}-${stat.wickets}`
}

function buildOverCommentaryGroups(
  events: LiveBallEvent[],
  playerById: Map<number, PublicPlayer>,
): OverCommentaryGroup[] {
  const ordered = [...events].sort(
    (a, b) =>
      a.innings - b.innings ||
      a.sequence_number - b.sequence_number ||
      a.id - b.id,
  )

  const batterStats = new Map<number, BatterMiniStat>()
  const bowlerStats = new Map<number, BowlerMiniStat>()
  const groups = new Map<string, OverCommentaryGroup>()
  const inningsScore = new Map<number, { runs: number; wickets: number }>()

  for (const event of ordered) {
    const innings = inningsScore.get(event.innings) ?? { runs: 0, wickets: 0 }
    const overKey = `${event.innings}-${event.over_number}`
    const group = groups.get(overKey) ?? {
      key: overKey,
      overNumber: event.over_number,
      summaryLabel: `Over ${event.over_number}`,
      runsText: '0 runs',
      scoreText: '0/0',
      battersText: '—',
      bowlerText: '—',
      deliveries: [],
    }

    const batter = batterStats.get(event.striker_player_id) ?? { runs: 0, balls: 0, fours: 0, sixes: 0 }
    batter.runs += event.runs_batter ?? 0
    if (batterBallCounts(event)) batter.balls += 1
    if ((event.boundary_runs ?? 0) === 4 || (event.runs_batter ?? 0) === 4) batter.fours += 1
    if ((event.boundary_runs ?? 0) === 6 || (event.runs_batter ?? 0) === 6) batter.sixes += 1
    batterStats.set(event.striker_player_id, batter)

    const bowler = bowlerStats.get(event.bowler_player_id) ?? {
      runs: 0,
      balls: 0,
      wickets: 0,
      maidens: 0,
      currentOverRuns: new Map<string, number>(),
    }
    const bowlerRuns = bowlerRunsConceded(event)
    bowler.runs += bowlerRuns
    bowler.currentOverRuns.set(overKey, (bowler.currentOverRuns.get(overKey) ?? 0) + bowlerRuns)
    if (event.is_legal_delivery !== false && !event.is_dead_ball) {
      bowler.balls += 1
      const overBallCount = group.deliveries.filter((d) => d.event.is_legal_delivery !== false && !d.event.is_dead_ball).length + 1
      if (overBallCount === 6 && (bowler.currentOverRuns.get(overKey) ?? 0) === 0) {
        bowler.maidens += 1
      }
    }
    if (event.wicket_type && BOWLER_CREDIT_WICKETS.has(event.wicket_type)) {
      bowler.wickets += 1
    }
    bowlerStats.set(event.bowler_player_id, bowler)

    innings.runs += eventTotalRuns(event)
    if (event.wicket_type && event.wicket_type !== 'retired_hurt' && event.wicket_type !== 'retired_not_out') {
      innings.wickets += 1
    }
    inningsScore.set(event.innings, innings)

    const striker = playerName(playerById, event.striker_player_id)
    const bowlerName = playerName(playerById, event.bowler_player_id)
    group.deliveries.push({
      event,
      ballLabel: `${event.over_number}.${event.ball_number}`,
      token: deliveryToken(event),
      header: `${bowlerName} to ${striker}, ${deliveryResultText(event)}`,
      detail: deliveryDetail(event, playerById),
    })
    const overRuns = group.deliveries.reduce((sum, row) => sum + eventTotalRuns(row.event), 0)
    group.runsText = `${overRuns} run${overRuns === 1 ? '' : 's'}`
    group.scoreText = `${innings.runs}/${innings.wickets}`
    group.battersText = [
      formatBatterMini(playerName(playerById, event.striker_player_id), batterStats.get(event.striker_player_id)),
      event.non_striker_player_id
        ? formatBatterMini(playerName(playerById, event.non_striker_player_id), batterStats.get(event.non_striker_player_id))
        : '',
    ]
      .filter(Boolean)
      .join(' · ')
    group.bowlerText = formatBowlerMini(bowlerName, bowlerStats.get(event.bowler_player_id))
    groups.set(overKey, group)
  }

  return [...groups.values()]
    .sort((a, b) => b.overNumber - a.overNumber)
    .map((group) => ({
      ...group,
      deliveries: [...group.deliveries].sort((a, b) => b.event.sequence_number - a.event.sequence_number || b.event.id - a.event.id),
    }))
}

function latestSummary(state: LiveScoreState | undefined): LiveInningsSummary | null {
  const summaries = state?.summaries ?? []
  if (summaries.length === 0) return null

  const current = state?.current_innings
  return summaries.find((summary) => summary.innings === current) ?? summaries[summaries.length - 1] ?? null
}

export function LiveScorePanel({
  matchId,
  matchStatus,
  homeTeamId,
  awayTeamId,
  homeName,
  awayName,
  showEvents = true,
}: {
  matchId: number
  matchStatus?: string | null
  homeTeamId: number
  awayTeamId: number
  homeName: string
  awayName: string
  showEvents?: boolean
}) {
  const isLive = String(matchStatus ?? '').toLowerCase() === 'live'

  const liveQ = useQuery({
    queryKey: ['public-live-score', matchId],
    queryFn: () => fetchJson<LiveScoreState>(`/public/matches/${matchId}/live`),
    enabled: Number.isFinite(matchId),
    refetchInterval: isLive ? 15_000 : false,
    retry: 1,
  })

  const playersQ = useQuery({
    queryKey: ['public-live-score-players', matchId, homeTeamId, awayTeamId],
    queryFn: async () => {
      const [homePlayers, awayPlayers] = await Promise.all([
        fetchAllPaginatedList<PublicPlayer>(
          (page) => `/public/players?team_id=${homeTeamId}&include_inactive=true&page=${page}&page_size=100`,
        ),
        fetchAllPaginatedList<PublicPlayer>(
          (page) => `/public/players?team_id=${awayTeamId}&include_inactive=true&page=${page}&page_size=100`,
        ),
      ])
      return [...homePlayers, ...awayPlayers]
    },
    enabled: Number.isFinite(matchId),
    retry: 1,
  })

  const teamNames = useMemo(
    () => ({
      [homeTeamId]: homeName,
      [awayTeamId]: awayName,
    }),
    [awayName, awayTeamId, homeName, homeTeamId],
  )

  const playerById = useMemo(
    () => new Map((playersQ.data ?? []).map((player) => [player.id, player] as const)),
    [playersQ.data],
  )

  const activeSummary = latestSummary(liveQ.data)
  const recentEvents = useMemo(
    () => [...(liveQ.data?.events ?? [])].slice(-30),
    [liveQ.data?.events],
  )
  const commentaryGroups = useMemo(
    () => buildOverCommentaryGroups(recentEvents, playerById),
    [playerById, recentEvents],
  )

  const lastEvent = activeSummary?.last_event ?? recentEvents[recentEvents.length - 1] ?? null

  return (
    <section className="live-score-panel" aria-label="Live score">
      <style>{`
        .live-score-panel__commentary {
          display: grid;
          gap: 1rem;
          margin-top: 1.1rem;
        }
        .live-score-panel__over-card {
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 1.1rem;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.82);
        }
        .live-score-panel__over-head {
          display: grid;
          grid-template-columns: minmax(4rem, 0.45fr) minmax(7rem, 1fr) auto;
          gap: 0.8rem;
          align-items: center;
          padding: 0.9rem 1rem;
          background: linear-gradient(90deg, rgba(219, 234, 254, 0.88), rgba(239, 246, 255, 0.78));
        }
        .live-score-panel__over-label {
          border-right: 1px solid rgba(15, 23, 42, 0.09);
          min-height: 2.6rem;
          display: grid;
          align-content: center;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #475569;
          font-size: 0.76rem;
          font-weight: 800;
        }
        .live-score-panel__over-label strong {
          display: block;
          color: #0f172a;
          font-size: 1.25rem;
          letter-spacing: 0;
        }
        .live-score-panel__over-runs {
          color: #0f172a;
          font-weight: 900;
          font-size: 1.25rem;
        }
        .live-score-panel__over-score {
          color: #0f172a;
          font-weight: 900;
          text-align: right;
          font-size: 1.15rem;
        }
        .live-score-panel__over-meta {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 0.5rem 1rem;
          padding: 0.7rem 1rem;
          background: rgba(226, 242, 252, 0.72);
          color: #334155;
          font-size: 0.9rem;
        }
        .live-score-panel__ball-list {
          display: grid;
        }
        .live-score-panel__ball-row {
          display: grid;
          grid-template-columns: 3.2rem 3rem minmax(0, 1fr);
          gap: 0.8rem;
          padding: 1rem;
          border-top: 1px solid rgba(15, 23, 42, 0.08);
        }
        .live-score-panel__ball-number {
          color: #475569;
          font-weight: 800;
          padding-top: 0.1rem;
        }
        .live-score-panel__ball-token {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 0.55rem;
          display: grid;
          place-items: center;
          background: #f1f5f9;
          color: #0f172a;
          font-weight: 900;
          text-transform: uppercase;
        }
        .live-score-panel__ball-token.is-wicket {
          background: #fee2e2;
          color: #991b1b;
        }
        .live-score-panel__ball-title {
          margin: 0 0 0.25rem;
          color: #475569;
          font-size: 0.78rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .live-score-panel__ball-detail {
          margin: 0;
          color: #0f172a;
          line-height: 1.55;
        }
        @media (max-width: 640px) {
          .live-score-panel__over-head {
            grid-template-columns: 4rem 1fr;
          }
          .live-score-panel__over-score {
            grid-column: 1 / -1;
            text-align: left;
          }
          .live-score-panel__ball-row {
            grid-template-columns: 2.8rem 2.6rem minmax(0, 1fr);
            gap: 0.65rem;
            padding: 0.9rem 0.75rem;
          }
        }
      `}</style>
      <div className="live-score-panel__head">
        <div>
          <p className="live-score-panel__eyebrow">Live score</p>
          <h2>
            {activeSummary
              ? `${teamName(activeSummary.batting_team_id, teamNames)} ${scoreLine(activeSummary)}`
              : isLive
                ? 'Scorer warming up'
                : 'Live score'}
          </h2>
        </div>
        <span className={`live-score-panel__status${isLive ? ' is-live' : ''}`}>
          {isLive ? 'LIVE' : String(matchStatus ?? liveQ.data?.status ?? 'Scheduled').toUpperCase()}
        </span>
      </div>

      {liveQ.isLoading ? (
        <p className="live-score-panel__muted">Loading live score…</p>
      ) : null}

      {liveQ.isError ? (
        <p className="live-score-panel__muted">Live scoring is not available yet.</p>
      ) : null}

      {!liveQ.isLoading && !liveQ.isError ? (
        <>
          {activeSummary ? (
            <div className="live-score-panel__summary-grid">
              <article>
                <span>Batting</span>
                <strong>{teamName(activeSummary.batting_team_id, teamNames)}</strong>
                <p>{scoreLine(activeSummary)}</p>
              </article>
              <article>
                <span>Bowling</span>
                <strong>{teamName(activeSummary.bowling_team_id, teamNames)}</strong>
                <p>{inningsLabel(activeSummary.innings)}</p>
              </article>
              <article>
                <span>Last ball</span>
                <strong>{lastEvent ? deliveryResultText(lastEvent) : '—'}</strong>
                <p>{lastEvent ? `Ball ${lastEvent.over_number}.${lastEvent.ball_number}` : 'No deliveries yet'}</p>
              </article>
            </div>
          ) : (
            <p className="live-score-panel__muted">
              {isLive
                ? 'The match is marked live. Ball-by-ball updates will appear as soon as the scorer records the first delivery.'
                : 'No live scoring events have been recorded for this match yet.'}
            </p>
          )}

          {activeSummary?.last_six?.length ? (
            <div className="live-score-panel__last-six" aria-label="Recent balls">
              <span>Last balls</span>
              <div>
                {activeSummary.last_six.map((ball, index) => (
                  <strong key={`${ball}-${index}`}>{ball}</strong>
                ))}
              </div>
            </div>
          ) : null}

          {showEvents && commentaryGroups.length > 0 ? (
            <div className="live-score-panel__commentary">
              {commentaryGroups.map((group) => (
                <article key={group.key} className="live-score-panel__over-card">
                  <div className="live-score-panel__over-head">
                    <div className="live-score-panel__over-label">
                      Over
                      <strong>{group.overNumber}</strong>
                    </div>
                    <div className="live-score-panel__over-runs">{group.runsText}</div>
                    <div className="live-score-panel__over-score">{group.scoreText}</div>
                  </div>
                  <div className="live-score-panel__over-meta">
                    <span>{group.battersText}</span>
                    <span>{group.bowlerText}</span>
                  </div>
                  <div className="live-score-panel__ball-list">
                    {group.deliveries.map((row) => (
                      <div key={row.event.id} className="live-score-panel__ball-row">
                        <div className="live-score-panel__ball-number">{row.ballLabel}</div>
                        <div className={`live-score-panel__ball-token${row.token === 'W' ? ' is-wicket' : ''}`}>
                          {row.token}
                        </div>
                        <div>
                          <p className="live-score-panel__ball-title">{row.header}</p>
                          <p className="live-score-panel__ball-detail">{row.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
