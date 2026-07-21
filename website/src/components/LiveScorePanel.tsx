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
  batting_style?: string | null
  bowling_style?: string | null
}

type TeamNameMap = Record<number, string | undefined>

type BatterMiniStat = {
  playerId: number
  runs: number
  balls: number
  fours: number
  sixes: number
  lastSequence: number
}

type BowlerMiniStat = {
  playerId: number
  runs: number
  balls: number
  wickets: number
  maidens: number
  lastSequence: number
  overRuns: Map<string, number>
  overLegalBalls: Map<string, number>
}

type CommentaryDelivery = {
  event: LiveBallEvent
  ballLabel: string
  token: string
  tokenClass: string
  header: string
  detail: string
}

type OverCommentaryGroup = {
  key: string
  innings: number
  overNumber: number
  runs: number
  wickets: number
  scoreText: string
  battersText: string
  bowlerText: string
  deliveries: CommentaryDelivery[]
}

type InningsDashboard = {
  summary: LiveInningsSummary | null
  events: LiveBallEvent[]
  batters: BatterMiniStat[]
  bowlers: BowlerMiniStat[]
  currentBatters: BatterMiniStat[]
  currentBowlers: BowlerMiniStat[]
  partnershipRuns: number
  partnershipBalls: number
  partnershipWickets: number
  lastBatText: string | null
  fowText: string | null
  lastFiveText: string | null
  currentRate: string
  overGroups: OverCommentaryGroup[]
  overStripGroups: OverCommentaryGroup[]
  wormPoints: Array<{ over: number; runs: number }>
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

function teamName(teamId: number | null | undefined, teamNames: TeamNameMap): string {
  if (teamId == null) return 'Team'
  return teamNames[teamId] ?? `Team ${teamId}`
}

function shortTeamName(name: string): string {
  const cleaned = name.trim()
  if (!cleaned) return 'Team'
  const words = cleaned.split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0]!
  return words.map((word) => word[0]).join('').toUpperCase()
}

function playerName(playerById: Map<number, PublicPlayer>, playerId: number | null | undefined): string {
  if (!playerId) return '—'
  return playerById.get(playerId)?.full_name ?? `#${playerId}`
}

function playerStyle(playerById: Map<number, PublicPlayer>, playerId: number): string {
  const player = playerById.get(playerId)
  const style = player?.batting_style || player?.bowling_style || ''
  return style ? style.split(',')[0]!.trim() : ''
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

function wicketCounts(event: LiveBallEvent): boolean {
  return Boolean(
    event.wicket_type &&
      event.wicket_type !== 'retired_hurt' &&
      event.wicket_type !== 'retired_not_out',
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

function cricketOverDecimal(totalBalls: number): number {
  return Number(`${Math.floor(totalBalls / 6)}.${totalBalls % 6}`)
}

function rateLabel(runs: number, balls: number): string {
  if (balls <= 0) return '0.00'
  return (runs / (balls / 6)).toFixed(2)
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
  if (batterRuns === 4) return 'four runs'
  if (batterRuns === 6) return 'six runs'
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
  if (extrasType === 'no_ball') return batterRuns > 0 ? `${batterRuns}nb` : 'nb'
  if (extrasType === 'bye') return `${extrasRuns}b`
  if (extrasType === 'leg_bye') return `${extrasRuns}lb`
  if (extrasType === 'no_ball_bye') return `nb+${Math.max(0, extrasRuns - 1)}b`
  if (extrasType === 'no_ball_leg_bye') return `nb+${Math.max(0, extrasRuns - 1)}lb`
  if (extrasType === 'penalty') return `P${event.penalty_runs_batting || event.penalty_runs_fielding || 0}`
  if (batterRuns === 0) return '•'
  return String(batterRuns)
}

function tokenClass(token: string): string {
  if (token === 'W') return ' is-wicket'
  if (token === '4') return ' is-four'
  if (token === '6') return ' is-six'
  if (token === '•') return ''
  if (token.includes('b') || token.includes('wd') || token.includes('nb') || token.startsWith('P')) {
    return ' is-extra'
  }
  return ''
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

function batterStrikeRate(stat: BatterMiniStat): string {
  if (stat.balls <= 0) return '0.00'
  return ((stat.runs / stat.balls) * 100).toFixed(2)
}

function bowlerEconomy(stat: BowlerMiniStat): string {
  if (stat.balls <= 0) return '0.00'
  return ((stat.runs * 6) / stat.balls).toFixed(2)
}

function formatBatterLine(
  name: string,
  stat: BatterMiniStat | undefined,
  isStrike = false,
): string {
  const row = stat ?? { playerId: 0, runs: 0, balls: 0, fours: 0, sixes: 0, lastSequence: 0 }
  const boundaries = [row.fours ? `${row.fours}x4` : '', row.sixes ? `${row.sixes}x6` : ''].filter(Boolean).join(' ')
  return `${name}${isStrike ? '*' : ''} ${row.runs} (${row.balls}b${boundaries ? ` ${boundaries}` : ''})`
}

function formatBowlerLine(name: string, stat: BowlerMiniStat | undefined): string {
  if (!stat) return name
  return `${name} ${oversLabelFromBalls(stat.balls)}-${stat.maidens}-${stat.runs}-${stat.wickets}`
}

function computeMiniDashboard(
  state: LiveScoreState | undefined,
  playerById: Map<number, PublicPlayer>,
): InningsDashboard {
  const summaries = state?.summaries ?? []
  const currentInnings = state?.current_innings ?? summaries[summaries.length - 1]?.innings ?? null
  const summary = summaries.find((row) => row.innings === currentInnings) ?? summaries[summaries.length - 1] ?? null
  const events = [...(state?.events ?? [])]
    .filter((event) => (summary ? event.innings === summary.innings : true))
    .sort((a, b) => a.sequence_number - b.sequence_number || a.id - b.id)

  const batterStats = new Map<number, BatterMiniStat>()
  const bowlerStats = new Map<number, BowlerMiniStat>()
  const groups = new Map<string, OverCommentaryGroup>()
  const wormPoints: Array<{ over: number; runs: number }> = [{ over: 0, runs: 0 }]
  let inningsRuns = 0
  let inningsWickets = 0
  let legalBalls = 0
  let partnershipRuns = 0
  let partnershipBalls = 0
  let partnershipWickets = 0
  let lastBatText: string | null = null
  let fowText: string | null = null

  for (const event of events) {
    const overKey = `${event.innings}-${event.over_number}`
    const group = groups.get(overKey) ?? {
      key: overKey,
      innings: event.innings,
      overNumber: event.over_number,
      runs: 0,
      wickets: 0,
      scoreText: '0/0',
      battersText: '—',
      bowlerText: '—',
      deliveries: [],
    }

    const batter = batterStats.get(event.striker_player_id) ?? {
      playerId: event.striker_player_id,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      lastSequence: event.sequence_number,
    }
    batter.runs += event.runs_batter ?? 0
    if (batterBallCounts(event)) batter.balls += 1
    if ((event.boundary_runs ?? 0) === 4 || (event.runs_batter ?? 0) === 4) batter.fours += 1
    if ((event.boundary_runs ?? 0) === 6 || (event.runs_batter ?? 0) === 6) batter.sixes += 1
    batter.lastSequence = event.sequence_number
    batterStats.set(event.striker_player_id, batter)

    if (event.non_striker_player_id && !batterStats.has(event.non_striker_player_id)) {
      batterStats.set(event.non_striker_player_id, {
        playerId: event.non_striker_player_id,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        lastSequence: event.sequence_number,
      })
    }

    const bowler = bowlerStats.get(event.bowler_player_id) ?? {
      playerId: event.bowler_player_id,
      runs: 0,
      balls: 0,
      wickets: 0,
      maidens: 0,
      lastSequence: event.sequence_number,
      overRuns: new Map<string, number>(),
      overLegalBalls: new Map<string, number>(),
    }
    const conceded = bowlerRunsConceded(event)
    bowler.runs += conceded
    bowler.lastSequence = event.sequence_number
    bowler.overRuns.set(overKey, (bowler.overRuns.get(overKey) ?? 0) + conceded)
    if (event.is_legal_delivery !== false && !event.is_dead_ball) {
      bowler.balls += 1
      bowler.overLegalBalls.set(overKey, (bowler.overLegalBalls.get(overKey) ?? 0) + 1)
      if ((bowler.overLegalBalls.get(overKey) ?? 0) === 6 && (bowler.overRuns.get(overKey) ?? 0) === 0) {
        bowler.maidens += 1
      }
    }
    if (event.wicket_type && BOWLER_CREDIT_WICKETS.has(event.wicket_type)) {
      bowler.wickets += 1
    }
    bowlerStats.set(event.bowler_player_id, bowler)

    const runs = eventTotalRuns(event)
    const isLegalBall = event.is_legal_delivery !== false && !event.is_dead_ball
    inningsRuns += runs
    group.runs += runs
    partnershipRuns += runs
    if (isLegalBall) {
      legalBalls += 1
      partnershipBalls += 1
    }

    if (wicketCounts(event)) {
      inningsWickets += 1
      group.wickets += 1
      partnershipWickets += 1
      const outName = playerName(playerById, event.wicket_player_id)
      const outRuns = event.wicket_player_id ? batterStats.get(event.wicket_player_id)?.runs ?? 0 : 0
      const outBalls = event.wicket_player_id ? batterStats.get(event.wicket_player_id)?.balls ?? 0 : 0
      lastBatText = `${outName} ${outRuns} (${outBalls}b)`
      fowText = `${inningsRuns}/${inningsWickets} (${oversLabelFromBalls(legalBalls)} ov)`
      partnershipRuns = 0
      partnershipBalls = 0
      partnershipWickets = 0
    }

    if (isLegalBall || wormPoints.length === 1) {
      wormPoints.push({ over: cricketOverDecimal(legalBalls), runs: inningsRuns })
    }

    const striker = playerName(playerById, event.striker_player_id)
    const nonStriker = event.non_striker_player_id ? playerName(playerById, event.non_striker_player_id) : ''
    const bowlerName = playerName(playerById, event.bowler_player_id)
    const token = deliveryToken(event)
    group.deliveries.push({
      event,
      ballLabel: `${event.over_number}.${event.ball_number}`,
      token,
      tokenClass: tokenClass(token),
      header: `${bowlerName} to ${striker}, ${deliveryResultText(event)}`,
      detail: deliveryDetail(event, playerById),
    })
    group.scoreText = `${inningsRuns}/${inningsWickets}`
    group.battersText = [
      formatBatterLine(striker, batterStats.get(event.striker_player_id), true),
      event.non_striker_player_id
        ? formatBatterLine(nonStriker, batterStats.get(event.non_striker_player_id))
        : '',
    ]
      .filter(Boolean)
      .join('   ')
    group.bowlerText = formatBowlerLine(bowlerName, bowlerStats.get(event.bowler_player_id))
    groups.set(overKey, group)
  }

  const batters = [...batterStats.values()].sort((a, b) => b.lastSequence - a.lastSequence)
  const bowlers = [...bowlerStats.values()].sort((a, b) => b.lastSequence - a.lastSequence)
  const lastEvent = events[events.length - 1]
  const activeBatterIds = [lastEvent?.striker_player_id, lastEvent?.non_striker_player_id].filter(
    (id): id is number => typeof id === 'number' && id > 0,
  )
  const currentBatters = activeBatterIds
    .map((id) => batterStats.get(id))
    .filter((row): row is BatterMiniStat => Boolean(row))
  const currentBowlers = bowlers.slice(0, 2)

  const recentLegalCutoff = Math.max(0, legalBalls - 30)
  let countedLegal = 0
  let lastFiveRuns = 0
  let lastFiveWickets = 0
  for (const event of events) {
    const isLegalBall = event.is_legal_delivery !== false && !event.is_dead_ball
    if (isLegalBall) countedLegal += 1
    if (countedLegal > recentLegalCutoff) {
      lastFiveRuns += eventTotalRuns(event)
      if (wicketCounts(event)) lastFiveWickets += 1
    }
  }
  const lastFiveBalls = Math.min(30, legalBalls)
  const lastFiveText = legalBalls > 0
    ? `${lastFiveRuns}/${lastFiveWickets} (${rateLabel(lastFiveRuns, lastFiveBalls)})`
    : null

  const overGroups = [...groups.values()]
    .sort((a, b) => b.innings - a.innings || b.overNumber - a.overNumber)
    .map((group) => ({
      ...group,
      deliveries: [...group.deliveries].sort(
        (a, b) => b.event.sequence_number - a.event.sequence_number || b.event.id - a.event.id,
      ),
    }))

  const overStripGroups = overGroups.slice(0, 5).map((group) => ({
    ...group,
    deliveries: [...group.deliveries].sort(
      (a, b) => a.event.sequence_number - b.event.sequence_number || a.event.id - b.event.id,
    ),
  }))

  return {
    summary,
    events,
    batters,
    bowlers,
    currentBatters,
    currentBowlers,
    partnershipRuns,
    partnershipBalls,
    partnershipWickets,
    lastBatText,
    fowText,
    lastFiveText,
    currentRate: rateLabel(summary?.runs ?? inningsRuns, summary?.legal_balls ?? legalBalls),
    overGroups,
    overStripGroups,
    wormPoints,
  }
}

function renderWormPath(points: Array<{ over: number; runs: number }>): string {
  if (points.length <= 1) return ''
  const maxOver = Math.max(1, ...points.map((point) => point.over))
  const maxRuns = Math.max(1, ...points.map((point) => point.runs))
  return points
    .map((point, index) => {
      const x = 12 + (point.over / maxOver) * 176
      const y = 112 - (point.runs / maxRuns) * 92
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
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
    refetchInterval: isLive ? 3_000 : false,
    refetchIntervalInBackground: false,
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

  const dashboard = useMemo(
    () => computeMiniDashboard(liveQ.data, playerById),
    [liveQ.data, playerById],
  )

  const activeSummary = dashboard.summary
  const battingTeam = teamName(activeSummary?.batting_team_id, teamNames)
  const bowlingTeam = teamName(activeSummary?.bowling_team_id, teamNames)
  const activeOvers = activeSummary?.overs_label ?? '0.0'
  const activeScore = activeSummary ? `${activeSummary.runs}/${activeSummary.wickets}` : '0/0'
  const inactiveTeamId = activeSummary?.batting_team_id === homeTeamId ? awayTeamId : homeTeamId
  const inactiveTeam = teamName(inactiveTeamId, teamNames)
  const wormPath = renderWormPath(dashboard.wormPoints)

  return (
    <section className="live-score-panel live-score-panel--cricinfo" aria-label="Live score">
      <style>{`
        .live-score-panel--cricinfo {
          --live-ink: #111827;
          --live-muted: #57607a;
          --live-line: rgba(15, 23, 42, 0.1);
          --live-soft: #f5f6f8;
          --live-band: #e8e8e8;
          --live-blue: #0969c8;
          --live-over: #dff3ff;
          --live-over-2: #ccefff;
          background: #fff;
          color: var(--live-ink);
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 1rem;
          overflow: hidden;
        }
        .live-score-panel--cricinfo .live-score-panel__top {
          padding: 1rem;
          border-bottom: 1px solid var(--live-line);
        }
        .live-score-panel__live-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          color: var(--live-muted);
          font-size: 0.82rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .live-score-panel__live-dot {
          width: 0.55rem;
          height: 0.55rem;
          border-radius: 999px;
          background: #ef4444;
          display: inline-block;
          margin-right: 0.35rem;
          vertical-align: 0.03rem;
        }
        .live-score-panel__teams {
          display: grid;
          gap: 0.25rem;
          margin-top: 0.95rem;
        }
        .live-score-panel__team-line {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 1rem;
          align-items: baseline;
          font-size: 1.55rem;
          font-weight: 900;
        }
        .live-score-panel__team-line.is-muted {
          color: #656b80;
          font-weight: 800;
        }
        .live-score-panel__score-block {
          text-align: right;
          color: var(--live-ink);
        }
        .live-score-panel__score-block small {
          color: #4b5563;
          font-size: 0.82rem;
          font-weight: 800;
        }
        .live-score-panel__match-note {
          margin: 1rem 0 0;
          color: var(--live-ink);
          font-weight: 750;
        }
        .live-score-panel__subnote {
          margin: 0.35rem 0 0;
          color: var(--live-muted);
          font-weight: 650;
        }
        .live-score-panel__tabs {
          display: flex;
          gap: 1.6rem;
          overflow-x: auto;
          border-bottom: 1px solid var(--live-line);
          padding: 0 1rem;
          scrollbar-width: none;
        }
        .live-score-panel__tabs::-webkit-scrollbar { display: none; }
        .live-score-panel__tab {
          appearance: none;
          border: 0;
          background: transparent;
          padding: 1rem 0 0.85rem;
          color: var(--live-muted);
          font-weight: 800;
          font-size: 0.95rem;
          white-space: nowrap;
          position: relative;
        }
        .live-score-panel__tab.is-active {
          color: var(--live-blue);
        }
        .live-score-panel__tab.is-active::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 3px;
          border-radius: 999px 999px 0 0;
          background: currentColor;
        }
        .live-score-panel__scorecard {
          border-bottom: 1px solid var(--live-line);
        }
        .live-score-panel__mini-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.88rem;
        }
        .live-score-panel__mini-table th {
          background: var(--live-band);
          color: #5d657e;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          font-size: 0.76rem;
          text-align: right;
          padding: 0.58rem 0.65rem;
          font-weight: 900;
        }
        .live-score-panel__mini-table th:first-child,
        .live-score-panel__mini-table td:first-child {
          text-align: left;
        }
        .live-score-panel__mini-table td {
          padding: 0.6rem 0.65rem;
          text-align: right;
          border-bottom: 1px solid rgba(15, 23, 42, 0.05);
          color: #4c556f;
          font-weight: 650;
        }
        .live-score-panel__mini-table td:first-child {
          color: var(--live-ink);
          font-weight: 850;
        }
        .live-score-panel__mini-table small {
          color: #68708a;
          font-weight: 750;
          margin-left: 0.15rem;
        }
        .live-score-panel__scorecard-foot {
          padding: 0.65rem 1rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem 0.7rem;
          color: var(--live-muted);
          font-weight: 700;
          border-bottom: 1px solid var(--live-line);
        }
        .live-score-panel__scorecard-foot strong {
          color: var(--live-ink);
        }
        .live-score-panel__over-strip {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          overflow-x: auto;
          padding: 0.7rem 1rem;
          border-bottom: 1px solid var(--live-line);
          scrollbar-width: thin;
        }
        .live-score-panel__over-strip-group {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding-right: 0.55rem;
          border-right: 1px solid var(--live-line);
        }
        .live-score-panel__over-strip-group:last-child {
          border-right: 0;
        }
        .live-score-panel__strip-over {
          color: #5d657e;
          font-size: 0.78rem;
          font-weight: 900;
          text-align: center;
          min-width: 2.4rem;
        }
        .live-score-panel__strip-over strong {
          display: block;
          color: var(--live-ink);
        }
        .live-score-panel__ball-token,
        .live-score-panel__strip-token {
          display: grid;
          place-items: center;
          border-radius: 0.35rem;
          background: #f0f1f3;
          color: var(--live-ink);
          font-weight: 900;
          text-transform: lowercase;
        }
        .live-score-panel__ball-token {
          width: 2.5rem;
          height: 2.5rem;
          font-size: 0.93rem;
        }
        .live-score-panel__strip-token {
          min-width: 2rem;
          height: 2rem;
          padding: 0 0.45rem;
          font-size: 0.86rem;
        }
        .live-score-panel__ball-token.is-four,
        .live-score-panel__strip-token.is-four {
          background: #22c55e;
          color: #fff;
        }
        .live-score-panel__ball-token.is-six,
        .live-score-panel__strip-token.is-six {
          background: #8b5cf6;
          color: #fff;
        }
        .live-score-panel__ball-token.is-wicket,
        .live-score-panel__strip-token.is-wicket {
          background: #dc2626;
          color: #fff;
          text-transform: uppercase;
        }
        .live-score-panel__ball-token.is-extra,
        .live-score-panel__strip-token.is-extra {
          color: #111827;
        }
        .live-score-panel__match-centre-title {
          padding: 1rem 1rem 0.25rem;
          margin: 0;
          font-size: 1.35rem;
          font-weight: 900;
        }
        .live-score-panel__centre {
          display: grid;
          grid-template-columns: minmax(0, 1.75fr) minmax(16rem, 0.9fr);
          border-top: 1px solid var(--live-line);
        }
        .live-score-panel__commentary-column {
          border-right: 1px solid var(--live-line);
          min-width: 0;
        }
        .live-score-panel__over-head {
          display: grid;
          grid-template-columns: 4.7rem minmax(0, 1fr) auto;
          gap: 0.9rem;
          align-items: center;
          padding: 0.75rem 1rem;
          background: linear-gradient(90deg, var(--live-over), var(--live-over-2));
        }
        .live-score-panel__over-label {
          min-height: 3.3rem;
          display: grid;
          align-content: center;
          border-right: 1px solid rgba(15, 23, 42, 0.1);
          color: #59617a;
          font-size: 0.76rem;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .live-score-panel__over-label strong {
          color: var(--live-ink);
          font-size: 1.45rem;
          letter-spacing: 0;
        }
        .live-score-panel__over-runs {
          font-size: 1.15rem;
          font-weight: 900;
        }
        .live-score-panel__over-score {
          text-align: right;
          font-size: 1.3rem;
          font-weight: 950;
        }
        .live-score-panel__over-score small {
          display: block;
          color: #334155;
          font-size: 0.85rem;
          font-weight: 850;
        }
        .live-score-panel__over-meta {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.35rem 0.9rem;
          padding: 0.55rem 1rem;
          background: rgba(224, 242, 254, 0.72);
          color: #475569;
          font-size: 0.83rem;
          font-weight: 700;
        }
        .live-score-panel__ball-row {
          display: grid;
          grid-template-columns: 3rem 2.8rem minmax(0, 1fr);
          gap: 0.85rem;
          padding: 1.05rem 1rem;
          border-top: 1px solid var(--live-line);
        }
        .live-score-panel__ball-number {
          color: #4f5871;
          font-weight: 850;
          padding-top: 0.55rem;
          text-align: right;
        }
        .live-score-panel__ball-title {
          margin: 0 0 0.25rem;
          color: #4f5871;
          font-size: 0.78rem;
          font-weight: 950;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }
        .live-score-panel__ball-detail {
          margin: 0;
          color: var(--live-ink);
          font-size: 1rem;
          line-height: 1.55;
        }
        .live-score-panel__worm {
          padding: 1rem;
        }
        .live-score-panel__worm h3 {
          margin: 0 0 0.8rem;
          font-size: 1.1rem;
          font-weight: 900;
        }
        .live-score-panel__worm-legend {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          margin-bottom: 0.6rem;
          color: var(--live-ink);
          font-size: 0.85rem;
          font-weight: 700;
        }
        .live-score-panel__worm-legend::before {
          content: '';
          width: 0.62rem;
          height: 0.62rem;
          border-radius: 999px;
          background: var(--live-blue);
        }
        .live-score-panel__worm svg {
          display: block;
          width: 100%;
          height: auto;
        }
        .live-score-panel__empty,
        .live-score-panel__muted {
          margin: 0;
          color: var(--live-muted);
        }
        .live-score-panel__empty {
          padding: 1rem;
        }
        @media (max-width: 760px) {
          .live-score-panel--cricinfo {
            border-radius: 0.85rem;
          }
          .live-score-panel--cricinfo .live-score-panel__top {
            padding: 0.9rem 0.85rem;
          }
          .live-score-panel__team-line {
            font-size: 1.35rem;
          }
          .live-score-panel__tabs {
            gap: 1.35rem;
            padding: 0 0.85rem;
          }
          .live-score-panel__mini-table th,
          .live-score-panel__mini-table td {
            padding: 0.55rem 0.45rem;
            font-size: 0.88rem;
          }
          .live-score-panel__mini-table th {
            font-size: 0.72rem;
          }
          .live-score-panel__scorecard-foot {
            display: block;
            padding: 0.65rem 0.85rem;
            line-height: 1.65;
          }
          .live-score-panel__scorecard-foot span {
            display: block;
          }
          .live-score-panel__centre {
            display: block;
          }
          .live-score-panel__commentary-column {
            border-right: 0;
          }
          .live-score-panel__worm {
            display: none;
          }
          .live-score-panel__match-centre-title {
            padding-left: 0.85rem;
            padding-right: 0.85rem;
          }
          .live-score-panel__over-head {
            grid-template-columns: 4.4rem minmax(0, 1fr) auto;
            padding: 0.72rem 0.85rem;
          }
          .live-score-panel__over-score {
            font-size: 1.18rem;
          }
          .live-score-panel__over-meta {
            padding: 0.5rem 0.85rem;
            font-size: 0.8rem;
          }
          .live-score-panel__ball-row {
            grid-template-columns: 2.5rem 2.5rem minmax(0, 1fr);
            gap: 0.65rem;
            padding: 0.95rem 0.85rem;
          }
          .live-score-panel__ball-number {
            text-align: left;
          }
          .live-score-panel__ball-detail {
            font-size: 0.98rem;
          }
        }
      `}</style>

      <div className="live-score-panel__top">
        <div className="live-score-panel__live-row">
          <span>
            {isLive ? <span className="live-score-panel__live-dot" aria-hidden /> : null}
            {isLive ? 'Live' : String(matchStatus ?? liveQ.data?.status ?? 'Scheduled')}
          </span>
          <span>{activeSummary ? inningsLabel(activeSummary.innings) : 'Live score'}</span>
        </div>

        <div className="live-score-panel__teams">
          <div className="live-score-panel__team-line">
            <span>{battingTeam}</span>
            <span className="live-score-panel__score-block">
              <small>({activeOvers} ov)</small> {activeScore}
            </span>
          </div>
          <div className="live-score-panel__team-line is-muted">
            <span>{inactiveTeam}</span>
            <span />
          </div>
        </div>

        {activeSummary ? (
          <>
            <p className="live-score-panel__match-note">{bowlingTeam} fielding.</p>
            <p className="live-score-panel__subnote">
              Current RR: {dashboard.currentRate}
              {dashboard.lastFiveText ? ` · Last 5 ov (RR): ${dashboard.lastFiveText}` : ''}
            </p>
          </>
        ) : (
          <p className="live-score-panel__subnote">
            {liveQ.isLoading
              ? 'Loading live score…'
              : liveQ.isError
                ? 'Live scoring is not available yet.'
                : 'Ball-by-ball updates will appear once the scorer records the first delivery.'}
          </p>
        )}
      </div>

      <div className="live-score-panel__tabs" aria-label="Live match tabs">
        {['Live', 'Scorecard', 'Commentary', 'Live Stats', 'Overs'].map((tab) => (
          <button key={tab} type="button" className={`live-score-panel__tab${tab === 'Live' ? ' is-active' : ''}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeSummary ? (
        <div className="live-score-panel__scorecard">
          <table className="live-score-panel__mini-table">
            <thead>
              <tr>
                <th>Batters</th>
                <th>R</th>
                <th>B</th>
                <th>4s</th>
                <th>6s</th>
                <th>SR</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard.currentBatters.length ? dashboard.currentBatters : dashboard.batters.slice(0, 2)).map((stat, index) => (
                <tr key={stat.playerId}>
                  <td>
                    {playerName(playerById, stat.playerId)}{index === 0 ? '*' : ''}
                    {playerStyle(playerById, stat.playerId) ? <small>{playerStyle(playerById, stat.playerId)}</small> : null}
                  </td>
                  <td>{stat.runs}</td>
                  <td>{stat.balls}</td>
                  <td>{stat.fours}</td>
                  <td>{stat.sixes}</td>
                  <td>{batterStrikeRate(stat)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="live-score-panel__mini-table">
            <thead>
              <tr>
                <th>Bowlers</th>
                <th>O</th>
                <th>M</th>
                <th>R</th>
                <th>W</th>
                <th>Econ</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard.currentBowlers.length ? dashboard.currentBowlers : dashboard.bowlers.slice(0, 2)).map((stat) => (
                <tr key={stat.playerId}>
                  <td>
                    {playerName(playerById, stat.playerId)}
                    {playerStyle(playerById, stat.playerId) ? <small>{playerStyle(playerById, stat.playerId)}</small> : null}
                  </td>
                  <td>{oversLabelFromBalls(stat.balls)}</td>
                  <td>{stat.maidens}</td>
                  <td>{stat.runs}</td>
                  <td>{stat.wickets}</td>
                  <td>{bowlerEconomy(stat)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="live-score-panel__scorecard-foot">
            <span>P'SHIP: <strong>{dashboard.partnershipRuns} Runs, {dashboard.partnershipBalls} B</strong>{dashboard.partnershipBalls > 0 ? ` (RR: ${rateLabel(dashboard.partnershipRuns, dashboard.partnershipBalls)})` : ''}</span>
            {dashboard.lastBatText ? <span>L'BAT: <strong>{dashboard.lastBatText}</strong></span> : null}
            {dashboard.fowText ? <span>FOW: <strong>{dashboard.fowText}</strong></span> : null}
          </div>

          {dashboard.overStripGroups.length > 0 ? (
            <div className="live-score-panel__over-strip" aria-label="Recent overs">
              {dashboard.overStripGroups.map((group) => (
                <div key={group.key} className="live-score-panel__over-strip-group">
                  {group.deliveries.map((row) => (
                    <span key={row.event.id} className={`live-score-panel__strip-token${row.tokenClass}`}>
                      {row.token}
                    </span>
                  ))}
                  <span className="live-score-panel__strip-over">
                    {group.overNumber}th
                    <strong>{group.runs} RUN{group.runs === 1 ? '' : 'S'}</strong>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {showEvents && dashboard.overGroups.length > 0 ? (
        <>
          <h2 className="live-score-panel__match-centre-title">Match Centre</h2>
          <div className="live-score-panel__centre">
            <div className="live-score-panel__commentary-column">
              {dashboard.overGroups.map((group) => (
                <article key={group.key} className="live-score-panel__over-card">
                  <div className="live-score-panel__over-head">
                    <div className="live-score-panel__over-label">
                      Over
                      <strong>{group.overNumber}</strong>
                    </div>
                    <div className="live-score-panel__over-runs">
                      {group.runs} run{group.runs === 1 ? '' : 's'}
                    </div>
                    <div className="live-score-panel__over-score">
                      {shortTeamName(battingTeam)} {group.scoreText}
                      <small>CRR: {dashboard.currentRate}</small>
                    </div>
                  </div>
                  <div className="live-score-panel__over-meta">
                    <span>{group.battersText}</span>
                    <span>{group.bowlerText}</span>
                  </div>
                  <div>
                    {group.deliveries.map((row) => (
                      <div key={row.event.id} className="live-score-panel__ball-row">
                        <div className="live-score-panel__ball-number">{row.ballLabel}</div>
                        <div className={`live-score-panel__ball-token${row.tokenClass}`}>{row.token}</div>
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

            <aside className="live-score-panel__worm" aria-label="Runs worm">
              <h3>Worm</h3>
              <span className="live-score-panel__worm-legend">{battingTeam}</span>
              <svg viewBox="0 0 200 130" role="img" aria-label={`Runs progression for ${battingTeam}`}>
                <line x1="12" y1="112" x2="188" y2="112" stroke="rgba(15,23,42,0.22)" />
                <line x1="12" y1="20" x2="12" y2="112" stroke="rgba(15,23,42,0.22)" />
                <g stroke="rgba(15,23,42,0.1)">
                  <line x1="12" y1="89" x2="188" y2="89" />
                  <line x1="12" y1="66" x2="188" y2="66" />
                  <line x1="12" y1="43" x2="188" y2="43" />
                </g>
                {wormPath ? <path d={wormPath} fill="none" stroke="#0969c8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
                {dashboard.wormPoints.slice(-1).map((point) => {
                  const maxOver = Math.max(1, ...dashboard.wormPoints.map((p) => p.over))
                  const maxRuns = Math.max(1, ...dashboard.wormPoints.map((p) => p.runs))
                  const cx = 12 + (point.over / maxOver) * 176
                  const cy = 112 - (point.runs / maxRuns) * 92
                  return <circle key={`${point.over}-${point.runs}`} cx={cx} cy={cy} r="3.5" fill="#0969c8" />
                })}
                <text x="100" y="128" textAnchor="middle" fill="#4b5563" fontSize="10">OVERS</text>
                <text x="4" y="16" fill="#4b5563" fontSize="10">RUNS</text>
              </svg>
            </aside>
          </div>
        </>
      ) : activeSummary ? (
        <p className="live-score-panel__empty">Ball-by-ball commentary will appear here.</p>
      ) : null}
    </section>
  )
}
