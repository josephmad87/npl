import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAllPaginatedList, fetchJson } from '../lib/publicApi'
import {
  computeSeasonStandings,
  formatStandingsNrr,
  sortStandingsDesc,
} from '../lib/leagueSeasonAggregates'
import type { MatchLite } from '../lib/hooks'

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
  replacement_player_id?: number | null
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

type PublicTeam = {
  id: number
  name: string
  short_name?: string | null
  logo_url?: string | null
}

type PublicMatchDetail = MatchLite & {
  season_id: number | null
  match_overs?: string | number | null
  season?: {
    id: number
    name: string
    slug: string
    league?: {
      id: number
      name: string
      slug: string
    } | null
  } | null
}

type SeasonDetail = {
  id: number
  team_ids: number[]
}

type MatchSquadPlayer = {
  id: number
  team_id: number
  player_id: number
  role: 'playing_xi' | 'substitute'
  lineup_order: number
  is_captain: boolean
  is_wicketkeeper: boolean
}

type MatchSquad = {
  match_id: number
  teams: Array<{
    team_id: number
    players: MatchSquadPlayer[]
  }>
}

type TeamNameMap = Record<number, string | undefined>

type BatterMiniStat = {
  playerId: number
  runs: number
  balls: number
  fours: number
  sixes: number
  firstSequence: number
  lastSequence: number
  isOut: boolean
  dismissal: string | null
}

type BowlerMiniStat = {
  playerId: number
  runs: number
  balls: number
  wickets: number
  maidens: number
  firstSequence: number
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

type LiveTab = 'live' | 'scorecard' | 'commentary' | 'teams' | 'standings'

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

function ordinal(value: number): string {
  const n = Math.max(1, value)
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  const mod10 = n % 10
  if (mod10 === 1) return `${n}st`
  if (mod10 === 2) return `${n}nd`
  if (mod10 === 3) return `${n}rd`
  return `${n}th`
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

function parseCricketOversToBalls(value: string | number | null | undefined): number | null {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null

  const [oversRaw, ballsRaw = '0'] = raw.split('.')
  const overs = Number.parseInt(oversRaw, 10)
  const balls = Number.parseInt(ballsRaw || '0', 10)

  if (!Number.isFinite(overs) || !Number.isFinite(balls)) return null
  return Math.max(0, overs * 6 + Math.max(0, balls))
}

function plural(value: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : pluralLabel}`
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
    const replacement = event.replacement_player_id ? ` New batter: ${playerName(playerById, event.replacement_player_id)}.` : ''
    const endText = event.wicket_end ? `, ${event.wicket_end.replace('_', '-')} end` : ''
    const crossedText = event.batters_crossed ? ', batters crossed' : ''
    return event.dismissal_text?.trim() || `${outName} is out ${dismissal}${fielderText}${endText}${crossedText}.${replacement}`
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

function emptyBatter(playerId: number, sequence: number): BatterMiniStat {
  return {
    playerId,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    firstSequence: sequence,
    lastSequence: sequence,
    isOut: false,
    dismissal: null,
  }
}

function formatBatterLine(
  name: string,
  stat: BatterMiniStat | undefined,
  isStrike = false,
): string {
  const row = stat ?? emptyBatter(0, 0)
  const boundaries = [row.fours ? `${row.fours}x4` : '', row.sixes ? `${row.sixes}x6` : ''].filter(Boolean).join(' ')
  return `${name}${isStrike ? '*' : ''} ${row.runs} (${row.balls}b${boundaries ? ` ${boundaries}` : ''})`
}

function formatBowlerLine(name: string, stat: BowlerMiniStat | undefined): string {
  if (!stat) return name
  return `${name} ${oversLabelFromBalls(stat.balls)}-${stat.maidens}-${stat.runs}-${stat.wickets}`
}

function postBallActiveBatterIds(lastEvent: LiveBallEvent | undefined, legalBalls: number): number[] {
  if (!lastEvent) return []

  let striker = lastEvent.striker_player_id || null
  let nonStriker = lastEvent.non_striker_player_id || null
  const replacement = lastEvent.replacement_player_id ?? null

  if (wicketCounts(lastEvent) && lastEvent.wicket_player_id) {
    if (lastEvent.wicket_player_id === striker) {
      striker = replacement
    } else if (lastEvent.wicket_player_id === nonStriker) {
      nonStriker = replacement
    }
  }

  const completedRuns = lastEvent.completed_runs ?? lastEvent.runs_batter ?? 0
  const oddRuns = completedRuns % 2 === 1
  const endOfOver = lastEvent.is_legal_delivery !== false && !lastEvent.is_dead_ball && legalBalls > 0 && legalBalls % 6 === 0

  if (oddRuns !== endOfOver && striker && nonStriker) {
    const oldStriker = striker
    striker = nonStriker
    nonStriker = oldStriker
  }

  return [striker, nonStriker].filter((id): id is number => typeof id === 'number' && id > 0)
}

function computeMiniDashboard(
  state: LiveScoreState | undefined,
  playerById: Map<number, PublicPlayer>,
  targetInnings?: number | null,
): InningsDashboard {
  const summaries = state?.summaries ?? []
  const selectedInnings = targetInnings ?? state?.current_innings ?? summaries[summaries.length - 1]?.innings ?? null
  const summary = summaries.find((row) => row.innings === selectedInnings) ?? summaries[summaries.length - 1] ?? null
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

    const batter = batterStats.get(event.striker_player_id) ?? emptyBatter(event.striker_player_id, event.sequence_number)
    batter.runs += event.runs_batter ?? 0
    if (batterBallCounts(event)) batter.balls += 1
    if ((event.boundary_runs ?? 0) === 4 || (event.runs_batter ?? 0) === 4) batter.fours += 1
    if ((event.boundary_runs ?? 0) === 6 || (event.runs_batter ?? 0) === 6) batter.sixes += 1
    batter.lastSequence = event.sequence_number
    batterStats.set(event.striker_player_id, batter)

    if (event.non_striker_player_id && !batterStats.has(event.non_striker_player_id)) {
      batterStats.set(event.non_striker_player_id, emptyBatter(event.non_striker_player_id, event.sequence_number))
    }

    if (event.replacement_player_id && !batterStats.has(event.replacement_player_id)) {
      batterStats.set(event.replacement_player_id, emptyBatter(event.replacement_player_id, event.sequence_number + 0.1))
    }

    const bowler = bowlerStats.get(event.bowler_player_id) ?? {
      playerId: event.bowler_player_id,
      runs: 0,
      balls: 0,
      wickets: 0,
      maidens: 0,
      firstSequence: event.sequence_number,
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
      const outStat = event.wicket_player_id ? batterStats.get(event.wicket_player_id) : null
      if (outStat) {
        outStat.isOut = true
        outStat.dismissal = event.dismissal_text?.trim() || dismissalLabel(event.wicket_type)
      }
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

  const batters = [...batterStats.values()].sort((a, b) => a.firstSequence - b.firstSequence || a.playerId - b.playerId)
  const bowlers = [...bowlerStats.values()].sort((a, b) => a.firstSequence - b.firstSequence || a.playerId - b.playerId)
  const lastEvent = events[events.length - 1]
  const activeBatterIds = postBallActiveBatterIds(lastEvent, legalBalls)
  const currentBatters = activeBatterIds
    .map((id) => batterStats.get(id))
    .filter((row): row is BatterMiniStat => Boolean(row && !row.isOut))
  const currentBowlers = [...bowlers].sort((a, b) => b.lastSequence - a.lastSequence).slice(0, 2)

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

function wormScale(points: Array<{ over: number; runs: number }>) {
  const maxOver = Math.max(1, Math.ceil(Math.max(...points.map((point) => point.over), 1)))
  const maxRunsRaw = Math.max(...points.map((point) => point.runs), 1)
  const maxRuns = Math.max(10, Math.ceil(maxRunsRaw / 10) * 10)
  return { maxOver, maxRuns }
}

function renderWormPath(points: Array<{ over: number; runs: number }>, maxOver: number, maxRuns: number): string {
  if (points.length <= 1) return ''
  return points
    .map((point, index) => {
      const x = 34 + (point.over / maxOver) * 176
      const y = 126 - (point.runs / maxRuns) * 102
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
  const [activeTab, setActiveTab] = useState<LiveTab>('live')

  const liveQ = useQuery({
    queryKey: ['public-live-score', matchId],
    queryFn: () => fetchJson<LiveScoreState>(`/public/matches/${matchId}/live`),
    enabled: Number.isFinite(matchId),
    refetchInterval: isLive ? 3_000 : false,
    refetchIntervalInBackground: false,
    retry: 1,
  })

  const matchQ = useQuery({
    queryKey: ['public-live-match-detail', matchId],
    queryFn: () => fetchJson<PublicMatchDetail>(`/public/matches/${matchId}`),
    enabled: Number.isFinite(matchId),
    retry: 1,
  })

  const teamsQ = useQuery({
    queryKey: ['public-live-teams-for-panel'],
    queryFn: () => fetchAllPaginatedList<PublicTeam>((page) => `/public/teams?include_inactive=true&page=${page}&page_size=100`),
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

  const squadQ = useQuery({
    queryKey: ['public-live-match-squads', matchId],
    queryFn: () => fetchJson<MatchSquad>(`/public/matches/${matchId}/squads`),
    enabled: Number.isFinite(matchId),
    retry: 1,
  })

  const seasonDetailQ = useQuery({
    queryKey: ['public-live-season-detail', matchQ.data?.season?.league?.slug, matchQ.data?.season?.slug],
    queryFn: () => fetchJson<SeasonDetail>(`/public/leagues/${matchQ.data?.season?.league?.slug}/seasons/${matchQ.data?.season?.slug}`),
    enabled: Boolean(matchQ.data?.season?.league?.slug && matchQ.data?.season?.slug),
    retry: 1,
  })

  const seasonId = matchQ.data?.season_id ?? seasonDetailQ.data?.id ?? null
  const resultsQ = useQuery({
    queryKey: ['public-live-season-results', seasonId],
    queryFn: () => fetchAllPaginatedList<MatchLite>((page) => `/public/results?page=${page}&page_size=100&season_id=${seasonId}`),
    enabled: Boolean(seasonId),
    retry: 1,
  })

  const teamById = useMemo(
    () => new Map((teamsQ.data ?? []).map((team) => [team.id, team] as const)),
    [teamsQ.data],
  )

  const playerById = useMemo(
    () => new Map((playersQ.data ?? []).map((player) => [player.id, player] as const)),
    [playersQ.data],
  )

  const teamNames = useMemo(
    () => ({
      [homeTeamId]: teamById.get(homeTeamId)?.name ?? homeName,
      [awayTeamId]: teamById.get(awayTeamId)?.name ?? awayName,
    }),
    [awayName, awayTeamId, homeName, homeTeamId, teamById],
  )

  const dashboard = useMemo(
    () => computeMiniDashboard(liveQ.data, playerById),
    [liveQ.data, playerById],
  )

  const inningsDashboards = useMemo(
    () => (liveQ.data?.summaries ?? []).map((summary) => computeMiniDashboard(liveQ.data, playerById, summary.innings)),
    [liveQ.data, playerById],
  )

  const standingsRows = useMemo(() => {
    const teamIds = seasonDetailQ.data?.team_ids ?? []
    if (!teamIds.length) return []
    return sortStandingsDesc(computeSeasonStandings(resultsQ.data ?? [], teamIds))
  }, [resultsQ.data, seasonDetailQ.data?.team_ids])

  const activeSummary = dashboard.summary
  const summaries = liveQ.data?.summaries ?? []
  const firstInningsSummary = summaries.find((summary) => summary.innings === 1) ?? null
  const secondInningsSummary = summaries.find((summary) => summary.innings === 2) ?? null
  const battingTeam = teamName(activeSummary?.batting_team_id, teamNames)
  const bowlingTeam = teamName(activeSummary?.bowling_team_id, teamNames)
  const firstDisplayTeamId = firstInningsSummary?.batting_team_id ?? activeSummary?.batting_team_id ?? homeTeamId
  const secondDisplayTeamId = firstInningsSummary?.bowling_team_id ?? (firstDisplayTeamId === homeTeamId ? awayTeamId : homeTeamId)
  const firstDisplayTeam = teamName(firstDisplayTeamId, teamNames)
  const secondDisplayTeam = teamName(secondDisplayTeamId, teamNames)
  const targetRuns = firstInningsSummary ? firstInningsSummary.runs + 1 : null
  const allottedBalls = parseCricketOversToBalls(matchQ.data?.match_overs) ?? firstInningsSummary?.legal_balls ?? null
  const chaseRequiredRuns = secondInningsSummary && targetRuns != null
    ? Math.max(targetRuns - secondInningsSummary.runs, 0)
    : null
  const chaseRemainingBalls = secondInningsSummary && allottedBalls != null
    ? Math.max(allottedBalls - secondInningsSummary.legal_balls, 0)
    : null
  const chaseNote = secondInningsSummary && chaseRequiredRuns != null
    ? chaseRequiredRuns <= 0
      ? `${secondDisplayTeam} have reached the target.`
      : `${secondDisplayTeam} require ${plural(chaseRequiredRuns, 'run')} in ${chaseRemainingBalls != null ? plural(chaseRemainingBalls, 'ball') : 'the remaining balls'}.`
    : firstInningsSummary && targetRuns != null
      ? `${secondDisplayTeam} need ${plural(targetRuns, 'run')} to win.`
      : null
  const { maxOver: wormMaxOver, maxRuns: wormMaxRuns } = wormScale(dashboard.wormPoints)
  const wormPath = renderWormPath(dashboard.wormPoints, wormMaxOver, wormMaxRuns)
  const runTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => Math.round(wormMaxRuns * pct))
  const overTicks = Array.from({ length: Math.min(5, wormMaxOver + 1) }, (_, index) => {
    if (wormMaxOver <= 4) return index
    return Math.round((wormMaxOver / 4) * index)
  })

  const teamLogo = (teamId: number | null | undefined): string | null => {
    if (!teamId) return null
    const logo = teamById.get(teamId)?.logo_url?.trim()
    return logo || null
  }

  const renderTeamBadge = (teamId: number | null | undefined, name: string) => {
    const logo = teamLogo(teamId)
    return (
      <span className="live-score-panel__team-name">
        {logo ? (
          <img src={logo} alt="" className="live-score-panel__team-logo" loading="lazy" />
        ) : (
          <span className="live-score-panel__team-logo-fallback">{shortTeamName(name).slice(0, 2)}</span>
        )}
        <span>{name}</span>
      </span>
    )
  }

  const renderHeaderScore = (summary: LiveInningsSummary | null, fallbackScore = false) => {
    if (summary) {
      return (
        <span className="live-score-panel__score-block">
          <small>({summary.overs_label} ov)</small> {summary.runs}/{summary.wickets}
        </span>
      )
    }

    if (fallbackScore) {
      return (
        <span className="live-score-panel__score-block">
          <small>(0.0 ov)</small> 0/0
        </span>
      )
    }

    return <span className="live-score-panel__yet-to-bat">Yet to bat</span>
  }

  const squadPlayersForTeam = (teamId: number): MatchSquadPlayer[] => {
    const team = squadQ.data?.teams.find((row) => row.team_id === teamId)
    return [...(team?.players ?? [])]
      .filter((row) => row.role === 'playing_xi')
      .sort((a, b) => a.lineup_order - b.lineup_order || a.player_id - b.player_id)
  }

  const renderMiniScorecard = () => {
    if (!activeSummary) return null
    const currentBatters = dashboard.currentBatters.length ? dashboard.currentBatters : dashboard.batters.filter((row) => !row.isOut).slice(-2)
    return (
      <div className="live-score-panel__scorecard">
        <table className="live-score-panel__mini-table">
          <colgroup>
            <col className="live-score-panel__name-col" />
            <col /><col /><col /><col /><col />
          </colgroup>
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
            {currentBatters.map((stat, index) => (
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
          <colgroup>
            <col className="live-score-panel__name-col" />
            <col /><col /><col /><col /><col />
          </colgroup>
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
            {(dashboard.currentBowlers.length ? dashboard.currentBowlers : dashboard.bowlers.slice(-2)).map((stat) => (
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
                  {ordinal(group.overNumber)}
                  <strong>{group.runs} RUN{group.runs === 1 ? '' : 'S'}</strong>
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  const renderCommentary = () => {
    if (!showEvents) return null
    if (dashboard.overGroups.length === 0) {
      return activeSummary ? <p className="live-score-panel__empty">Ball-by-ball commentary will appear here.</p> : null
    }

    return (
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
            <svg viewBox="0 0 230 160" role="img" aria-label={`Runs progression for ${battingTeam}`}>
              <line x1="34" y1="126" x2="210" y2="126" stroke="rgba(15,23,42,0.25)" />
              <line x1="34" y1="24" x2="34" y2="126" stroke="rgba(15,23,42,0.25)" />
              {runTicks.map((tick) => {
                const y = 126 - (tick / wormMaxRuns) * 102
                return (
                  <g key={`run-${tick}`}>
                    <line x1="34" y1={y} x2="210" y2={y} stroke="rgba(15,23,42,0.1)" />
                    <text x="28" y={y + 3} textAnchor="end" fill="#4b5563" fontSize="8">{tick}</text>
                  </g>
                )
              })}
              {overTicks.map((tick) => {
                const x = 34 + (tick / wormMaxOver) * 176
                return (
                  <g key={`over-${tick}`}>
                    <line x1={x} y1="126" x2={x} y2="130" stroke="rgba(15,23,42,0.25)" />
                    <text x={x} y="142" textAnchor="middle" fill="#4b5563" fontSize="8">{tick}</text>
                  </g>
                )
              })}
              {wormPath ? <path d={wormPath} fill="none" stroke="#0969c8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
              {dashboard.wormPoints.slice(-1).map((point) => {
                const cx = 34 + (point.over / wormMaxOver) * 176
                const cy = 126 - (point.runs / wormMaxRuns) * 102
                return <circle key={`${point.over}-${point.runs}`} cx={cx} cy={cy} r="3.5" fill="#0969c8" />
              })}
              <text x="122" y="156" textAnchor="middle" fill="#4b5563" fontSize="9">OVERS</text>
              <text x="4" y="20" fill="#4b5563" fontSize="9">RUNS</text>
            </svg>
          </aside>
        </div>
      </>
    )
  }

  const renderFullScorecard = () => {
    if (inningsDashboards.length === 0) return <p className="live-score-panel__empty">Scorecard will appear once scoring starts.</p>
    return (
      <div className="live-score-panel__full-scorecard">
        {inningsDashboards.map((inningsDashboard) => {
          const summary = inningsDashboard.summary
          if (!summary) return null
          return (
            <section key={summary.innings} className="live-score-panel__innings-card">
              <div className="live-score-panel__section-head">
                <h3>{renderTeamBadge(summary.batting_team_id, teamName(summary.batting_team_id, teamNames))}</h3>
                <strong>{summary.runs}/{summary.wickets} ({summary.overs_label} ov)</strong>
              </div>
              <div className="live-score-panel__table-wrap">
                <table className="live-score-panel__detail-table">
                  <thead>
                    <tr>
                      <th>Batter</th>
                      <th>How out</th>
                      <th>R</th>
                      <th>B</th>
                      <th>4s</th>
                      <th>6s</th>
                      <th>SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inningsDashboard.batters.map((stat) => (
                      <tr key={stat.playerId}>
                        <td>{playerName(playerById, stat.playerId)}</td>
                        <td>{stat.isOut ? stat.dismissal || 'Out' : 'not out'}</td>
                        <td>{stat.runs}</td>
                        <td>{stat.balls}</td>
                        <td>{stat.fours}</td>
                        <td>{stat.sixes}</td>
                        <td>{batterStrikeRate(stat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="live-score-panel__table-wrap">
                <table className="live-score-panel__detail-table">
                  <thead>
                    <tr>
                      <th>Bowler</th>
                      <th>O</th>
                      <th>M</th>
                      <th>R</th>
                      <th>W</th>
                      <th>Econ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inningsDashboard.bowlers.map((stat) => (
                      <tr key={stat.playerId}>
                        <td>{playerName(playerById, stat.playerId)}</td>
                        <td>{oversLabelFromBalls(stat.balls)}</td>
                        <td>{stat.maidens}</td>
                        <td>{stat.runs}</td>
                        <td>{stat.wickets}</td>
                        <td>{bowlerEconomy(stat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>
    )
  }

  const renderTeams = () => (
    <div className="live-score-panel__teams-tab">
      {[homeTeamId, awayTeamId].map((teamId) => {
        const name = teamName(teamId, teamNames)
        const rows = squadPlayersForTeam(teamId)
        return (
          <section key={teamId} className="live-score-panel__squad-card">
            <h3>{renderTeamBadge(teamId, name)}</h3>
            {rows.length === 0 ? (
              <p className="live-score-panel__muted">Playing XI has not been published yet.</p>
            ) : (
              <ol className="live-score-panel__squad-list">
                {rows.map((row) => (
                  <li key={row.player_id}>
                    <span>{playerName(playerById, row.player_id)}</span>
                    <small>{[row.is_captain ? 'C' : '', row.is_wicketkeeper ? 'WK' : ''].filter(Boolean).join(' · ')}</small>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )
      })}
    </div>
  )

  const renderStandings = () => (
    <div className="live-score-panel__standings-tab">
      <div className="live-score-panel__section-head">
        <h3>Current log standings</h3>
        {matchQ.data?.season ? <span>{matchQ.data.season.name}</span> : null}
      </div>
      {resultsQ.isLoading || seasonDetailQ.isLoading ? (
        <p className="live-score-panel__empty">Loading standings…</p>
      ) : standingsRows.length === 0 ? (
        <p className="live-score-panel__empty">Standings will appear once this season has completed results.</p>
      ) : (
        <div className="live-score-panel__table-wrap">
          <table className="live-score-panel__detail-table live-score-panel__standings-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Team</th>
                <th>Mat</th>
                <th>Won</th>
                <th>Lost</th>
                <th>Tied</th>
                <th>NR</th>
                <th>Pts</th>
                <th>NRR</th>
              </tr>
            </thead>
            <tbody>
              {standingsRows.map((row, index) => {
                const name = teamName(row.teamId, teamNames)
                return (
                  <tr key={row.teamId}>
                    <td>{index + 1}</td>
                    <td>{renderTeamBadge(row.teamId, name)}</td>
                    <td>{row.played}</td>
                    <td>{row.won}</td>
                    <td>{row.lost}</td>
                    <td>{row.tied}</td>
                    <td>{row.nr}</td>
                    <td><strong>{row.points}</strong></td>
                    <td>{formatStandingsNrr(row.nrr)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  const tabs: Array<{ id: LiveTab; label: string }> = [
    { id: 'live', label: 'Live' },
    { id: 'scorecard', label: 'Scorecard' },
    { id: 'commentary', label: 'Commentary' },
    { id: 'teams', label: 'Teams' },
    { id: 'standings', label: 'Standings' },
  ]

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
        .live-score-panel__live-row,
        .live-score-panel__team-line,
        .live-score-panel__scorecard-foot,
        .live-score-panel__over-meta,
        .live-score-panel__section-head,
        .live-score-panel__squad-list li {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .live-score-panel__live-row {
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
          gap: 0.3rem;
          margin-top: 0.95rem;
        }
        .live-score-panel__team-line {
          font-size: 1.55rem;
          font-weight: 900;
        }
        .live-score-panel__team-line.is-muted {
          color: #656b80;
          font-weight: 800;
        }
        .live-score-panel__team-name {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 0;
        }
        .live-score-panel__team-name > span:last-child {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .live-score-panel__team-logo,
        .live-score-panel__team-logo-fallback {
          width: 1.7rem;
          height: 1.7rem;
          border-radius: 999px;
          flex: 0 0 auto;
        }
        .live-score-panel__team-logo {
          object-fit: contain;
          background: #fff;
          border: 1px solid rgba(15,23,42,0.1);
        }
        .live-score-panel__team-logo-fallback {
          display: inline-grid;
          place-items: center;
          background: #eef2ff;
          color: #334155;
          font-size: 0.7rem;
          font-weight: 900;
        }
        .live-score-panel__score-block,
        .live-score-panel__yet-to-bat {
          text-align: right;
          color: var(--live-ink);
          white-space: nowrap;
        }
        .live-score-panel__score-block small {
          color: #4b5563;
          font-size: 0.82rem;
          font-weight: 800;
        }
        .live-score-panel__yet-to-bat {
          color: #9a3412;
          background: #ffedd5;
          border-radius: 999px;
          padding: 0.25rem 0.65rem;
          font-size: 0.78rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .live-score-panel__match-note {
          margin: 1rem 0 0;
          color: var(--live-ink);
          font-weight: 750;
        }
        .live-score-panel__match-note.is-chase {
          display: inline-flex;
          align-items: center;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          border-radius: 999px;
          color: #9a3412;
          padding: 0.4rem 0.75rem;
          font-weight: 900;
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
          cursor: pointer;
        }
        .live-score-panel__tab.is-active { color: var(--live-blue); }
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
        .live-score-panel__scorecard { border-bottom: 1px solid var(--live-line); }
        .live-score-panel__mini-table,
        .live-score-panel__detail-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .live-score-panel__name-col { width: 42%; }
        .live-score-panel__mini-table th,
        .live-score-panel__mini-table td,
        .live-score-panel__detail-table th,
        .live-score-panel__detail-table td {
          text-align: right;
          vertical-align: middle;
          border-bottom: 1px solid rgba(15, 23, 42, 0.05);
        }
        .live-score-panel__mini-table th,
        .live-score-panel__detail-table th {
          background: var(--live-band);
          color: #5d657e;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          font-size: 0.76rem;
          padding: 0.58rem 0.65rem;
          font-weight: 900;
        }
        .live-score-panel__mini-table td,
        .live-score-panel__detail-table td {
          padding: 0.6rem 0.65rem;
          color: #4c556f;
          font-weight: 650;
        }
        .live-score-panel__mini-table th:first-child,
        .live-score-panel__mini-table td:first-child,
        .live-score-panel__detail-table th:first-child,
        .live-score-panel__detail-table td:first-child {
          text-align: left;
        }
        .live-score-panel__mini-table td:first-child,
        .live-score-panel__detail-table td:first-child {
          color: var(--live-ink);
          font-weight: 850;
        }
        .live-score-panel__mini-table small {
          display: block;
          color: #68708a;
          font-weight: 750;
          margin-top: 0.1rem;
        }
        .live-score-panel__scorecard-foot {
          padding: 0.65rem 1rem;
          flex-wrap: wrap;
          color: var(--live-muted);
          font-weight: 700;
          border-bottom: 1px solid var(--live-line);
          justify-content: flex-start;
        }
        .live-score-panel__scorecard-foot strong { color: var(--live-ink); }
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
        .live-score-panel__over-strip-group:last-child { border-right: 0; }
        .live-score-panel__strip-over {
          color: #5d657e;
          font-size: 0.78rem;
          font-weight: 900;
          text-align: center;
          min-width: 2.8rem;
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
        .live-score-panel__ball-token { width: 2.5rem; height: 2.5rem; font-size: 0.93rem; }
        .live-score-panel__strip-token { min-width: 2rem; height: 2rem; padding: 0 0.45rem; font-size: 0.86rem; }
        .live-score-panel__ball-token.is-four, .live-score-panel__strip-token.is-four { background: #22c55e; color: #fff; }
        .live-score-panel__ball-token.is-six, .live-score-panel__strip-token.is-six { background: #8b5cf6; color: #fff; }
        .live-score-panel__ball-token.is-wicket, .live-score-panel__strip-token.is-wicket { background: #dc2626; color: #fff; text-transform: uppercase; }
        .live-score-panel__ball-token.is-extra, .live-score-panel__strip-token.is-extra { color: #111827; }
        .live-score-panel__match-centre-title { padding: 1rem 1rem 0.25rem; margin: 0; font-size: 1.35rem; font-weight: 900; }
        .live-score-panel__centre { display: grid; grid-template-columns: minmax(0, 1.75fr) minmax(17rem, 0.9fr); border-top: 1px solid var(--live-line); }
        .live-score-panel__commentary-column { border-right: 1px solid var(--live-line); min-width: 0; }
        .live-score-panel__over-head { display: grid; grid-template-columns: 4.7rem minmax(0, 1fr) auto; gap: 0.9rem; align-items: center; padding: 0.75rem 1rem; background: linear-gradient(90deg, var(--live-over), var(--live-over-2)); }
        .live-score-panel__over-label { min-height: 3.3rem; display: grid; align-content: center; border-right: 1px solid rgba(15, 23, 42, 0.1); color: #59617a; font-size: 0.76rem; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; }
        .live-score-panel__over-label strong { color: var(--live-ink); font-size: 1.45rem; letter-spacing: 0; }
        .live-score-panel__over-runs { font-size: 1.15rem; font-weight: 900; }
        .live-score-panel__over-score { text-align: right; font-size: 1.3rem; font-weight: 950; }
        .live-score-panel__over-score small { display: block; color: #334155; font-size: 0.85rem; font-weight: 850; }
        .live-score-panel__over-meta { flex-wrap: wrap; padding: 0.55rem 1rem; background: rgba(224, 242, 254, 0.72); color: #475569; font-size: 0.83rem; font-weight: 700; }
        .live-score-panel__ball-row { display: grid; grid-template-columns: 3rem 2.8rem minmax(0, 1fr); gap: 0.85rem; padding: 1.05rem 1rem; border-top: 1px solid var(--live-line); }
        .live-score-panel__ball-number { color: #4f5871; font-weight: 850; padding-top: 0.55rem; text-align: right; }
        .live-score-panel__ball-title { margin: 0 0 0.25rem; color: #4f5871; font-size: 0.78rem; font-weight: 950; letter-spacing: 0.09em; text-transform: uppercase; }
        .live-score-panel__ball-detail { margin: 0; color: var(--live-ink); font-size: 1rem; line-height: 1.55; }
        .live-score-panel__worm { padding: 1rem; }
        .live-score-panel__worm h3 { margin: 0 0 0.8rem; font-size: 1.1rem; font-weight: 900; }
        .live-score-panel__worm-legend { display: inline-flex; align-items: center; gap: 0.4rem; margin-bottom: 0.6rem; color: var(--live-ink); font-size: 0.85rem; font-weight: 700; }
        .live-score-panel__worm-legend::before { content: ''; width: 0.62rem; height: 0.62rem; border-radius: 999px; background: var(--live-blue); }
        .live-score-panel__worm svg { display: block; width: 100%; height: auto; }
        .live-score-panel__empty, .live-score-panel__muted { margin: 0; color: var(--live-muted); }
        .live-score-panel__empty { padding: 1rem; }
        .live-score-panel__full-scorecard, .live-score-panel__teams-tab, .live-score-panel__standings-tab { padding: 1rem; }
        .live-score-panel__innings-card, .live-score-panel__squad-card { border: 1px solid var(--live-line); border-radius: 0.85rem; overflow: hidden; margin-bottom: 1rem; background: #fff; }
        .live-score-panel__section-head { padding: 0.85rem 1rem; background: #f8fafc; border-bottom: 1px solid var(--live-line); }
        .live-score-panel__section-head h3 { margin: 0; font-size: 1rem; font-weight: 950; }
        .live-score-panel__table-wrap { overflow-x: auto; }
        .live-score-panel__detail-table th:nth-child(n + 2), .live-score-panel__detail-table td:nth-child(n + 2) { text-align: center; }
        .live-score-panel__detail-table th:first-child, .live-score-panel__detail-table td:first-child { min-width: 12rem; }
        .live-score-panel__detail-table th:nth-child(2), .live-score-panel__detail-table td:nth-child(2) { text-align: left; min-width: 12rem; }
        .live-score-panel__teams-tab { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
        .live-score-panel__squad-card h3 { margin: 0; padding: 0.85rem 1rem; background: #f8fafc; border-bottom: 1px solid var(--live-line); }
        .live-score-panel__squad-list { list-style: decimal; margin: 0; padding: 0.5rem 1rem 0.75rem 2.4rem; }
        .live-score-panel__squad-list li { padding: 0.45rem 0; border-bottom: 1px solid rgba(15,23,42,0.05); }
        .live-score-panel__squad-list li:last-child { border-bottom: 0; }
        .live-score-panel__squad-list small { color: var(--live-muted); font-weight: 900; }
        .live-score-panel__standings-table td:first-child, .live-score-panel__standings-table th:first-child { min-width: 3rem; text-align: center; }
        .live-score-panel__standings-table td:nth-child(2), .live-score-panel__standings-table th:nth-child(2) { min-width: 14rem; text-align: left; }
        @media (max-width: 760px) {
          .live-score-panel--cricinfo { border-radius: 0.85rem; }
          .live-score-panel--cricinfo .live-score-panel__top { padding: 0.9rem 0.85rem; }
          .live-score-panel__team-line { font-size: 1.25rem; align-items: flex-start; }
          .live-score-panel__tabs { gap: 1.35rem; padding: 0 0.85rem; }
          .live-score-panel__mini-table th, .live-score-panel__mini-table td { padding: 0.55rem 0.45rem; font-size: 0.88rem; }
          .live-score-panel__mini-table th { font-size: 0.72rem; }
          .live-score-panel__name-col { width: 38%; }
          .live-score-panel__scorecard-foot { display: block; padding: 0.65rem 0.85rem; line-height: 1.65; }
          .live-score-panel__scorecard-foot span { display: block; }
          .live-score-panel__centre { display: block; }
          .live-score-panel__commentary-column { border-right: 0; }
          .live-score-panel__worm { display: none; }
          .live-score-panel__match-centre-title { padding-left: 0.85rem; padding-right: 0.85rem; }
          .live-score-panel__over-head { grid-template-columns: 4.4rem minmax(0, 1fr) auto; padding: 0.72rem 0.85rem; }
          .live-score-panel__over-score { font-size: 1.18rem; }
          .live-score-panel__over-meta { padding: 0.5rem 0.85rem; font-size: 0.8rem; }
          .live-score-panel__ball-row { grid-template-columns: 2.5rem 2.5rem minmax(0, 1fr); gap: 0.65rem; padding: 0.95rem 0.85rem; }
          .live-score-panel__ball-number { text-align: left; }
          .live-score-panel__ball-detail { font-size: 0.98rem; }
          .live-score-panel__teams-tab { grid-template-columns: 1fr; padding: 0.85rem; }
          .live-score-panel__full-scorecard, .live-score-panel__standings-tab { padding: 0.85rem; }
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
            {renderTeamBadge(firstDisplayTeamId, firstDisplayTeam)}
            {renderHeaderScore(firstInningsSummary, activeSummary?.batting_team_id === firstDisplayTeamId)}
          </div>
          <div className="live-score-panel__team-line is-muted">
            {renderTeamBadge(secondDisplayTeamId, secondDisplayTeam)}
            {renderHeaderScore(secondInningsSummary, activeSummary?.batting_team_id === secondDisplayTeamId && !firstInningsSummary)}
          </div>
        </div>

        {activeSummary ? (
          <>
            <p className={`live-score-panel__match-note${chaseNote ? ' is-chase' : ''}`}>
              {chaseNote ?? `${bowlingTeam} fielding.`}
            </p>
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
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`live-score-panel__tab${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'live' ? (
        <>
          {renderMiniScorecard()}
          {renderCommentary()}
        </>
      ) : null}
      {activeTab === 'scorecard' ? renderFullScorecard() : null}
      {activeTab === 'commentary' ? renderCommentary() : null}
      {activeTab === 'teams' ? renderTeams() : null}
      {activeTab === 'standings' ? renderStandings() : null}
    </section>
  )
}
