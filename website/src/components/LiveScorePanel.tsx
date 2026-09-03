import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAllPaginatedList, fetchJson, resolveMediaUrl } from '../lib/publicApi'
import type { MatchLite } from '../lib/hooks'
import { formatCategoryLabel, formatMatchDate } from '../lib/formatters'
import { GalleryCard } from './GalleryCard'
import { GalleryLightbox, type GalleryLightboxItem } from './GalleryLightbox'
import { MatchStreamPanel } from './MatchStreamPanel'

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
  commentary?: string | null
  commentary_updated_at?: string | null
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
  match_overs?: string | number | null
  revised_target_runs?: number | null
  dls_par_score?: number | null
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
  matches_played?: number
  runs_scored?: number
  batting_average?: number | null
  strike_rate?: number | null
  wickets_taken?: number
  bowling_average?: number | null
  economy_rate?: number | null
  role?: string | null
}

type PublicTeam = {
  id: number
  name: string
  slug: string
  short_name?: string | null
  logo_url?: string | null
}

type PublicMatchDetail = MatchLite & {
  season_id: number | null
  match_overs?: string | number | null
  revised_target_runs?: number | null
  stream_label?: string | null
  stream_available?: boolean
  umpires?: string | null
  description?: string | null
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

type MatchSquadPlayer = {
  id: number
  team_id: number
  player_id: number
  role: 'playing_xi' | 'substitute' | 'concussion_substitute'
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
  dots: number
  wides: number
  noBalls: number
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
  overNote: string | null
  scoreText: string
  battersText: string
  bowlerText: string
  deliveries: CommentaryDelivery[]
}

type PartnershipBatterStat = {
  playerId: number
  runs: number
  balls: number
}

type PartnershipStat = {
  key: string
  runs: number
  balls: number
  batterOne: PartnershipBatterStat
  batterTwo: PartnershipBatterStat | null
  isCurrent: boolean
}

type WinProbabilityPoint = {
  sequence: number
  innings: number
  firstTeamProbability: number
  isWicket: boolean
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
  partnerships: PartnershipStat[]
}

type LiveTab =
  | 'live'
  | 'stream'
  | 'scorecard'
  | 'commentary'
  | 'stats'
  | 'overs'
  | 'photos'
  | 'squads'
  | 'info'

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

function LiveScoreTeamCrest({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null)
  const resolvedLogoUrl = resolveMediaUrl(logoUrl)
  const imageFailed = Boolean(resolvedLogoUrl && failedLogoUrl === resolvedLogoUrl)

  if (!resolvedLogoUrl || imageFailed) {
    return (
      <span className="live-score-panel__team-logo-fallback" aria-hidden>
        {shortTeamName(name).slice(0, 2)}
      </span>
    )
  }

  return (
    <img
      src={resolvedLogoUrl}
      alt=""
      className="live-score-panel__team-logo"
      loading="lazy"
      decoding="async"
      onError={() => setFailedLogoUrl(resolvedLogoUrl)}
    />
  )
}

function playerName(playerById: Map<number, PublicPlayer>, playerId: number | null | undefined): string {
  if (!playerId) return '—'
  return playerById.get(playerId)?.full_name ?? `#${playerId}`
}

function playerBattingStyle(playerById: Map<number, PublicPlayer>, playerId: number): string {
  return playerById.get(playerId)?.batting_style?.trim() ?? ''
}

function playerBowlingStyle(playerById: Map<number, PublicPlayer>, playerId: number): string {
  return playerById.get(playerId)?.bowling_style?.trim() ?? ''
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

function inningsExtrasSummary(events: LiveBallEvent[]): {
  total: number
  breakdown: string
} {
  let wides = 0
  let noBalls = 0
  let byes = 0
  let legByes = 0
  let penalties = 0

  for (const event of events) {
    if (event.extras_type === 'wide') wides += event.runs_extras ?? 0
    if (event.extras_type?.startsWith('no_ball')) noBalls += 1
    if (event.extras_type === 'bye') byes += event.runs_extras ?? 0
    if (event.extras_type === 'no_ball_bye') {
      byes += Math.max(0, (event.runs_extras ?? 0) - 1)
    }
    if (event.extras_type === 'leg_bye') legByes += event.runs_extras ?? 0
    if (event.extras_type === 'no_ball_leg_bye') {
      legByes += Math.max(0, (event.runs_extras ?? 0) - 1)
    }
    penalties += event.penalty_runs_batting ?? 0
  }

  const total = wides + noBalls + byes + legByes + penalties
  return {
    total,
    breakdown: `b ${byes}, lb ${legByes}, w ${wides}, nb ${noBalls}, p ${penalties}`,
  }
}

function inningsFallOfWickets(events: LiveBallEvent[]): Array<{
  wicket: number
  score: number
  over: string
  playerId: number | null
}> {
  let score = 0
  let wicket = 0
  const rows: Array<{ wicket: number; score: number; over: string; playerId: number | null }> = []
  for (const event of events) {
    score += eventTotalRuns(event)
    if (!wicketCounts(event)) continue
    wicket += 1
    rows.push({
      wicket,
      score,
      over: `${event.over_number}.${event.ball_number}`,
      playerId: event.wicket_player_id,
    })
  }
  return rows
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

function wormOverFromBalls(totalBalls: number): number {
  return totalBalls / 6
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

  const extrasType = event.extras_type
  const batterRuns = event.runs_batter ?? 0
  const extrasRuns = event.runs_extras ?? 0

  if (event.wicket_type) {
    if (extrasType === 'wide') return extrasRuns === 1 ? 'OUT + wide' : `OUT + ${extrasRuns} wides`
    if (extrasType === 'no_ball') {
      return batterRuns > 0
        ? `OUT + no ball + ${batterRuns} batter run${batterRuns === 1 ? '' : 's'}`
        : 'OUT + no ball'
    }
    if (extrasType === 'no_ball_bye') {
      const byes = Math.max(0, extrasRuns - 1)
      return `OUT + no ball + ${byes} bye${byes === 1 ? '' : 's'}`
    }
    if (extrasType === 'no_ball_leg_bye') {
      const legByes = Math.max(0, extrasRuns - 1)
      return `OUT + no ball + ${legByes} leg bye${legByes === 1 ? '' : 's'}`
    }
    return 'OUT'
  }

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
  const extrasType = event.extras_type
  const batterRuns = event.runs_batter ?? 0
  const extrasRuns = event.runs_extras ?? 0

  if (event.wicket_type) {
    if (extrasType === 'wide') return extrasRuns === 1 ? 'W+wd' : `W+${extrasRuns}wd`
    if (extrasType === 'no_ball') return batterRuns > 0 ? `W+${batterRuns}nb` : 'W+nb'
    if (extrasType === 'no_ball_bye') return `W+nb+${Math.max(0, extrasRuns - 1)}b`
    if (extrasType === 'no_ball_leg_bye') return `W+nb+${Math.max(0, extrasRuns - 1)}lb`
    return 'W'
  }

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
  if (token.startsWith('W')) return ' is-wicket'
  if (token === '4') return ' is-four'
  if (token === '6') return ' is-six'
  if (token === '•') return ''
  if (token.includes('b') || token.includes('wd') || token.includes('nb') || token.startsWith('P')) {
    return ' is-extra'
  }
  return ''
}

function deliveryDetail(event: LiveBallEvent, playerById: Map<number, PublicPlayer>): string {
  if (event.commentary?.trim()) return event.commentary.trim()

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
  const partnerships: PartnershipStat[] = []
  let inningsRuns = 0
  let inningsWickets = 0
  let legalBalls = 0
  let partnershipRuns = 0
  let partnershipBalls = 0
  let partnershipWickets = 0
  let currentPartnership: PartnershipStat | null = null
  let lastBatText: string | null = null
  let fowText: string | null = null

  const closePartnership = () => {
    if (!currentPartnership) return
    currentPartnership.isCurrent = false
    partnerships.push(currentPartnership)
    currentPartnership = null
  }

  for (const event of events) {
    const overKey = `${event.innings}-${event.over_number}`
    const group = groups.get(overKey) ?? {
      key: overKey,
      innings: event.innings,
      overNumber: event.over_number,
      runs: 0,
      wickets: 0,
      overNote: null,
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
      batterStats.set(event.non_striker_player_id, emptyBatter(event.non_striker_player_id, event.sequence_number + 0.1))
    }

    if (event.replacement_player_id && !batterStats.has(event.replacement_player_id)) {
      batterStats.set(event.replacement_player_id, emptyBatter(event.replacement_player_id, event.sequence_number + 0.2))
    }

    const bowler = bowlerStats.get(event.bowler_player_id) ?? {
      playerId: event.bowler_player_id,
      runs: 0,
      balls: 0,
      wickets: 0,
      maidens: 0,
      dots: 0,
      wides: 0,
      noBalls: 0,
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
      if (eventTotalRuns(event) === 0) bowler.dots += 1
      bowler.overLegalBalls.set(overKey, (bowler.overLegalBalls.get(overKey) ?? 0) + 1)
      if ((bowler.overLegalBalls.get(overKey) ?? 0) === 6 && (bowler.overRuns.get(overKey) ?? 0) === 0) {
        bowler.maidens += 1
      }
    }
    if (event.extras_type === 'wide') bowler.wides += event.runs_extras ?? 0
    if (event.extras_type?.startsWith('no_ball')) bowler.noBalls += 1
    if (event.wicket_type && BOWLER_CREDIT_WICKETS.has(event.wicket_type)) {
      bowler.wickets += 1
    }
    bowlerStats.set(event.bowler_player_id, bowler)

    const runs = eventTotalRuns(event)
    const isLegalBall = event.is_legal_delivery !== false && !event.is_dead_ball

    if (
      currentPartnership &&
      !currentPartnership.batterTwo &&
      event.non_striker_player_id &&
      event.non_striker_player_id !== currentPartnership.batterOne.playerId
    ) {
      currentPartnership.batterTwo = {
        playerId: event.non_striker_player_id,
        runs: 0,
        balls: 0,
      }
    }

    if (currentPartnership) {
      const partnershipPlayerIds = new Set([
        currentPartnership.batterOne.playerId,
        currentPartnership.batterTwo?.playerId,
      ])
      const eventPairMatches =
        partnershipPlayerIds.has(event.striker_player_id) &&
        (!event.non_striker_player_id || partnershipPlayerIds.has(event.non_striker_player_id))
      if (!eventPairMatches) closePartnership()
    }

    if (!currentPartnership) {
      currentPartnership = {
        key: `${event.innings}-${partnerships.length + 1}-${event.sequence_number}`,
        runs: 0,
        balls: 0,
        batterOne: {
          playerId: event.striker_player_id,
          runs: 0,
          balls: 0,
        },
        batterTwo: event.non_striker_player_id
          ? {
              playerId: event.non_striker_player_id,
              runs: 0,
              balls: 0,
            }
          : null,
        isCurrent: true,
      }
    }

    currentPartnership.runs += runs
    if (isLegalBall) currentPartnership.balls += 1
    const strikerContribution =
      currentPartnership.batterOne.playerId === event.striker_player_id
        ? currentPartnership.batterOne
        : currentPartnership.batterTwo?.playerId === event.striker_player_id
          ? currentPartnership.batterTwo
          : null
    if (strikerContribution) {
      strikerContribution.runs += event.runs_batter ?? 0
      if (batterBallCounts(event)) strikerContribution.balls += 1
    }

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
        outStat.dismissal =
          event.dismissal_text?.trim() ||
          dismissalLabel(event.wicket_type)
      }
      lastBatText = `${outName} ${outRuns} (${outBalls}b)`
      fowText = `${inningsRuns}/${inningsWickets} (${oversLabelFromBalls(legalBalls)} ov)`
      partnershipRuns = 0
      partnershipBalls = 0
      partnershipWickets = 0
      closePartnership()
    }

    wormPoints.push({ over: wormOverFromBalls(legalBalls), runs: inningsRuns })

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

  if (currentPartnership) {
    currentPartnership.isCurrent = summary?.innings === state?.current_innings
    partnerships.push(currentPartnership)
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
    partnerships,
  }
}

type OverStatPoint = {
  over: number
  runs: number
  wickets: number
  score: number
  scoreWickets: number
  legalBalls: number
  runRate: number
  group: OverCommentaryGroup
}

function overStatPoints(dashboard: InningsDashboard): OverStatPoint[] {
  let score = 0
  let scoreWickets = 0
  let legalBalls = 0

  return [...dashboard.overGroups]
    .sort((a, b) => a.overNumber - b.overNumber)
    .map((group) => {
      score += group.runs
      scoreWickets += group.wickets
      legalBalls += group.deliveries.filter(
        (delivery) =>
          delivery.event.is_legal_delivery !== false &&
          !delivery.event.is_dead_ball,
      ).length
      return {
        over: group.overNumber + 1,
        runs: group.runs,
        wickets: group.wickets,
        score,
        scoreWickets,
        legalBalls,
        runRate: legalBalls > 0 ? (score * 6) / legalBalls : 0,
        group,
      }
    })
}

function chartLinePath(
  points: Array<{ over: number; value: number }>,
  maxOver: number,
  maxValue: number,
): string {
  if (points.length === 0) return ''
  return points
    .map((point, index) => {
      const x = 38 + (point.over / Math.max(1, maxOver)) * 270
      const y = 132 - (point.value / Math.max(1, maxValue)) * 104
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function powerplayOversForMatch(allottedBalls: number | null): number {
  if (allottedBalls == null) return 6
  const overs = allottedBalls / 6
  if (overs > 20) return 10
  return Math.max(1, Math.min(6, Math.ceil(overs * 0.3)))
}

function liveScoringBreakdown(
  dashboard: InningsDashboard,
  powerplayOvers: number,
) {
  const powerplayBallLimit = powerplayOvers * 6
  let legalBalls = 0
  let powerplayRuns = 0
  let powerplayWickets = 0
  let outsideRuns = 0
  let outsideWickets = 0
  let dots = 0

  for (const event of dashboard.events) {
    const inPowerplay = legalBalls < powerplayBallLimit
    const runs = eventTotalRuns(event)
    if (inPowerplay) {
      powerplayRuns += runs
      if (wicketCounts(event)) powerplayWickets += 1
    } else {
      outsideRuns += runs
      if (wicketCounts(event)) outsideWickets += 1
    }
    if (
      event.is_legal_delivery !== false &&
      !event.is_dead_ball
    ) {
      legalBalls += 1
      if (runs === 0) dots += 1
    }
  }

  const fours = dashboard.batters.reduce((total, batter) => total + batter.fours, 0)
  const sixes = dashboard.batters.reduce((total, batter) => total + batter.sixes, 0)

  return {
    powerplay: `${powerplayRuns}/${powerplayWickets}`,
    outsidePowerplay: `${outsideRuns}/${outsideWickets}`,
    fours,
    sixes,
    boundaryRuns: fours * 4 + sixes * 6,
    dotBallPercentage: legalBalls > 0 ? `${Math.round((dots / legalBalls) * 100)}%` : '0%',
    extras: inningsExtrasSummary(dashboard.events).total,
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

function clampProbability(value: number): number {
  return Math.max(0.01, Math.min(0.99, value))
}

function logistic(value: number): number {
  return 1 / (1 + Math.exp(-value))
}

function batterForm(player: PublicPlayer | undefined): number {
  if (!player) return 0.5
  const average = Math.max(0, player.batting_average ?? 25)
  const strikeRate = Math.max(0, player.strike_rate ?? 85)
  const experience = Math.min(1, Math.max(0, player.matches_played ?? 0) / 20)
  const raw = average / 40 * 0.55 + strikeRate / 120 * 0.45
  return Math.max(0.2, Math.min(1.4, raw * (0.75 + experience * 0.25)))
}

function bowlerForm(player: PublicPlayer | undefined): number {
  if (!player) return 0.5
  const matches = Math.max(1, player.matches_played ?? 0)
  const wicketsPerMatch = Math.max(0, player.wickets_taken ?? 0) / matches
  const economy = Math.max(2.5, player.economy_rate ?? 7)
  const average = Math.max(8, player.bowling_average ?? 32)
  const raw =
    Math.min(1.5, wicketsPerMatch / 1.5) * 0.4 +
    Math.min(1.4, 7 / economy) * 0.35 +
    Math.min(1.4, 30 / average) * 0.25
  return Math.max(0.2, Math.min(1.4, raw))
}

function winProbabilityTimeline(
  state: LiveScoreState | undefined,
  playerById: Map<number, PublicPlayer>,
  allottedBalls: number | null,
  targetRuns: number | null,
): WinProbabilityPoint[] {
  const events = [...(state?.events ?? [])].sort(
    (a, b) => a.sequence_number - b.sequence_number || a.id - b.id,
  )
  if (events.length === 0) {
    return [{ sequence: 0, innings: 1, firstTeamProbability: 0.5, isWicket: false }]
  }

  const firstTeamId =
    events.find((event) => event.innings === 1)?.batting_team_id ??
    events[0]!.batting_team_id
  const matchBalls = Math.max(6, allottedBalls ?? 240)
  const parRuns = Math.max(1, (matchBalls / 6) * 7.5)
  const inningsState = new Map<
    number,
    { runs: number; wickets: number; legalBalls: number }
  >()
  const points: WinProbabilityPoint[] = [
    { sequence: 0, innings: 1, firstTeamProbability: 0.5, isWicket: false },
  ]

  for (const event of events) {
    const current = inningsState.get(event.innings) ?? {
      runs: 0,
      wickets: 0,
      legalBalls: 0,
    }
    current.runs += eventTotalRuns(event)
    if (wicketCounts(event)) current.wickets += 1
    if (event.is_legal_delivery && !event.is_dead_ball) current.legalBalls += 1
    inningsState.set(event.innings, current)

    const striker = playerById.get(event.striker_player_id)
    const nonStriker = event.non_striker_player_id
      ? playerById.get(event.non_striker_player_id)
      : undefined
    const bowler = playerById.get(event.bowler_player_id)
    const battingForm =
      (batterForm(striker) + batterForm(nonStriker ?? striker)) / 2
    const bowlingForm = bowlerForm(bowler)
    const formEdge = battingForm - bowlingForm
    let battingTeamProbability = 0.5

    if (event.innings === 1) {
      const ballsUsed = Math.max(1, current.legalBalls)
      const remainingBalls = Math.max(0, matchBalls - current.legalBalls)
      const currentRate = current.runs / ballsUsed
      const formAdjustedRate = Math.max(
        0.25,
        currentRate * 0.72 + (parRuns / matchBalls) * 0.28 + formEdge * 0.12,
      )
      const wicketResource = Math.max(0.25, (10 - current.wickets) / 10)
      const projected =
        current.runs +
        remainingBalls *
          formAdjustedRate *
          (0.72 + wicketResource * 0.28)
      const situationEdge = (projected - parRuns) / Math.max(18, parRuns * 0.16)
      battingTeamProbability = logistic(situationEdge + formEdge * 0.65)
    } else {
      const effectiveTarget =
        targetRuns ??
        (inningsState.get(1)?.runs != null
          ? inningsState.get(1)!.runs + 1
          : Math.round(parRuns) + 1)
      const runsRequired = Math.max(0, effectiveTarget - current.runs)
      const ballsRemaining = Math.max(0, matchBalls - current.legalBalls)
      const wicketsRemaining = Math.max(0, 10 - current.wickets)

      if (runsRequired === 0) {
        battingTeamProbability = 0.99
      } else if (ballsRemaining === 0 || wicketsRemaining === 0) {
        battingTeamProbability = 0.01
      } else {
        const requiredRate = runsRequired / ballsRemaining
        const observedRate =
          current.legalBalls > 0
            ? current.runs / current.legalBalls
            : parRuns / matchBalls
        const expectedRate = Math.max(
          0.2,
          observedRate * 0.45 +
            (parRuns / matchBalls) * 0.55 +
            formEdge * 0.12,
        )
        const scoringCapacity =
          ballsRemaining *
          expectedRate *
          (0.62 + (wicketsRemaining / 10) * 0.38)
        const capacityEdge =
          (scoringCapacity - runsRequired) /
          Math.max(8, effectiveTarget * 0.08)
        const rateEdge =
          (expectedRate - requiredRate) /
          Math.max(0.2, requiredRate * 0.25)
        battingTeamProbability = logistic(
          capacityEdge * 0.72 + rateEdge * 0.45 + formEdge * 0.55,
        )
      }
    }

    const firstTeamProbability =
      event.batting_team_id === firstTeamId
        ? battingTeamProbability
        : 1 - battingTeamProbability
    points.push({
      sequence: event.sequence_number,
      innings: event.innings,
      firstTeamProbability: clampProbability(firstTeamProbability),
      isWicket: wicketCounts(event),
    })
  }

  return points
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
  const [expandedOver, setExpandedOver] = useState<number | null>(null)
  const [activePhoto, setActivePhoto] = useState<GalleryLightboxItem | null>(null)

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

  const photosQ = useQuery({
    queryKey: ['public-live-match-photos', matchId],
    queryFn: () =>
      fetchAllPaginatedList<GalleryLightboxItem>(
        (page) => `/public/gallery?page=${page}&page_size=100&match_id=${matchId}`,
      ),
    enabled: Number.isFinite(matchId),
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
  const targetRuns =
    liveQ.data?.revised_target_runs ??
    matchQ.data?.revised_target_runs ??
    (firstInningsSummary ? firstInningsSummary.runs + 1 : null)
  const allottedBalls = parseCricketOversToBalls(
    liveQ.data?.match_overs ?? matchQ.data?.match_overs,
  )
  const winProbabilityPoints = useMemo(
    () =>
      winProbabilityTimeline(
        liveQ.data,
        playerById,
        allottedBalls,
        targetRuns,
      ),
    [allottedBalls, liveQ.data, playerById, targetRuns],
  )
  const winProbabilityMaxSequence = Math.max(
    1,
    winProbabilityPoints.at(-1)?.sequence ?? 1,
  )
  const secondInningsStartSequence =
    winProbabilityPoints.find((point) => point.innings === 2)?.sequence ?? null
  const currentFirstTeamProbability =
    winProbabilityPoints.at(-1)?.firstTeamProbability ?? 0.5
  const firstTeamWinPercent = Math.round(currentFirstTeamProbability * 100)
  const secondTeamWinPercent = 100 - firstTeamWinPercent
  const winProbabilityPath = winProbabilityPoints
    .map((point, index) => {
      const x = 12 + (point.sequence / winProbabilityMaxSequence) * 206
      const y = 16 + (1 - point.firstTeamProbability) * 104
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  const chaseRequiredRuns = secondInningsSummary && targetRuns != null
    ? Math.max(targetRuns - secondInningsSummary.runs, 0)
    : null
  const chaseRemainingBalls = secondInningsSummary && allottedBalls != null
    ? Math.max(allottedBalls - secondInningsSummary.legal_balls, 0)
    : null
  const liveMatchStatus = String(
    liveQ.data?.status ?? matchQ.data?.status ?? matchStatus ?? '',
  ).toLowerCase()
  const chaseHasEnded = secondInningsSummary != null && (
    secondInningsSummary.runs >= (targetRuns ?? Number.POSITIVE_INFINITY) ||
    secondInningsSummary.wickets >= 10 ||
    (allottedBalls != null && secondInningsSummary.legal_balls >= allottedBalls) ||
    liveMatchStatus === 'completed'
  )
  const liveResultNote = secondInningsSummary && targetRuns != null && chaseHasEnded
    ? (() => {
        const dlsSuffix = liveQ.data?.revised_target_runs != null || matchQ.data?.revised_target_runs != null
          ? ' (DLS)'
          : ''
        if (secondInningsSummary.runs >= targetRuns) {
          const wicketsRemaining = Math.max(0, 10 - secondInningsSummary.wickets)
          return `MATCH OVER: ${secondDisplayTeam} won by ${plural(wicketsRemaining, 'wicket')}${dlsSuffix}.`
        }

        const tieScore = targetRuns - 1
        if (secondInningsSummary.runs === tieScore) {
          return `MATCH OVER: Match tied${dlsSuffix}.`
        }

        return `MATCH OVER: ${firstDisplayTeam} won by ${plural(tieScore - secondInningsSummary.runs, 'run')}${dlsSuffix}.`
      })()
    : null
  const chaseNote = secondInningsSummary && chaseRequiredRuns != null
    ? liveResultNote ??
      `${secondDisplayTeam} require ${plural(chaseRequiredRuns, 'run')} in ${chaseRemainingBalls != null ? plural(chaseRemainingBalls, 'ball') : 'the remaining balls'}.`
    : null
  const projectedScore =
    activeSummary?.innings === 1 &&
    activeSummary.legal_balls > 0 &&
    allottedBalls != null
      ? Math.max(
          activeSummary.runs,
          Math.round((activeSummary.runs / activeSummary.legal_balls) * allottedBalls),
        )
      : null
  const matchSituationNote =
    projectedScore != null
      ? `${battingTeam} projected score: ${projectedScore}.`
      : chaseNote
  const wormDashboards = inningsDashboards
    .filter((inningsDashboard) => {
      const innings = inningsDashboard.summary?.innings
      return innings != null && innings <= (activeSummary?.innings ?? innings)
    })
    .sort((a, b) => (a.summary?.innings ?? 0) - (b.summary?.innings ?? 0))
    .slice(0, activeSummary?.innings === 1 ? 1 : 2)
  const wormSeries = wormDashboards.map((inningsDashboard, index) => ({
    innings: inningsDashboard.summary?.innings ?? index + 1,
    team: teamName(inningsDashboard.summary?.batting_team_id, teamNames),
    color: index === 0 ? '#7a1f2a' : '#d86c18',
    points: inningsDashboard.wormPoints,
  }))
  const allWormPoints = wormSeries.flatMap((series) => series.points)
  const { maxOver: wormMaxOver, maxRuns: wormMaxRuns } = wormScale(
    allWormPoints.length > 0 ? allWormPoints : dashboard.wormPoints,
  )
  const runTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => Math.round(wormMaxRuns * pct))
  const overTicks = Array.from({ length: Math.min(5, wormMaxOver + 1) }, (_, index) => {
    if (wormMaxOver <= 4) return index
    return Math.round((wormMaxOver / 4) * index)
  })
  const inningsOverSeries = inningsDashboards.slice(0, 2).map((inningsDashboard, index) => ({
    innings: inningsDashboard.summary?.innings ?? index + 1,
    teamId: inningsDashboard.summary?.batting_team_id ?? null,
    team: teamName(inningsDashboard.summary?.batting_team_id, teamNames),
    color: index === 0 ? '#7a1f2a' : '#d86c18',
    points: overStatPoints(inningsDashboard),
    dashboard: inningsDashboard,
  }))
  const maximumComparedOver = Math.max(
    1,
    ...inningsOverSeries.flatMap((series) => series.points.map((point) => point.over)),
  )
  const maximumOverRuns = Math.max(
    6,
    ...inningsOverSeries.flatMap((series) => series.points.map((point) => point.runs)),
  )
  const maximumRunRate = Math.max(
    6,
    ...inningsOverSeries.flatMap((series) => series.points.map((point) => point.runRate)),
  )
  const powerplayOvers = powerplayOversForMatch(allottedBalls)
  const scoringBreakdowns = inningsOverSeries.map((series) => ({
    ...series,
    stats: liveScoringBreakdown(series.dashboard, powerplayOvers),
  }))

  const teamLogo = (teamId: number | null | undefined): string | null => {
    if (!teamId) return null
    const logo = teamById.get(teamId)?.logo_url?.trim()
    return logo || null
  }

  const renderTeamBadge = (teamId: number | null | undefined, name: string) => {
    const logo = teamLogo(teamId)
    return (
      <span className="live-score-panel__team-name">
        <LiveScoreTeamCrest logoUrl={logo} name={name} />
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
                  {playerBattingStyle(playerById, stat.playerId) ? (
                    <small>{playerBattingStyle(playerById, stat.playerId)}</small>
                  ) : null}
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
                  {playerBowlingStyle(playerById, stat.playerId) ? (
                    <small>{playerBowlingStyle(playerById, stat.playerId)}</small>
                  ) : null}
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
                  {ordinal(group.overNumber + 1)}
                  <strong>{group.overNote ?? `${group.runs} RUN${group.runs === 1 ? '' : 'S'}`}</strong>
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  const renderPartnerships = () => {
    const partnershipInnings = wormDashboards.filter(
      (inningsDashboard) => inningsDashboard.summary && inningsDashboard.partnerships.length > 0,
    )
    if (partnershipInnings.length === 0) return null

    return (
      <section className="live-score-panel__partnerships" aria-label="Partnerships">
        <h3>Partnerships</h3>
        {partnershipInnings.map((inningsDashboard, inningsIndex) => {
          const summary = inningsDashboard.summary
          if (!summary) return null
          const inningsTeam = teamName(summary.batting_team_id, teamNames)
          const maxPartnershipRuns = Math.max(
            ...inningsDashboard.partnerships.map((partnership) => partnership.runs),
            1,
          )

          return (
            <div
              key={summary.innings}
              className={`live-score-panel__partnership-innings${inningsIndex > 0 ? ' is-secondary' : ''}`}
            >
              <h4>{renderTeamBadge(summary.batting_team_id, inningsTeam)}</h4>
              <div className="live-score-panel__partnership-list">
                {inningsDashboard.partnerships.map((partnership) => {
                  const batterTwo = partnership.batterTwo
                  const contributionTotal =
                    partnership.batterOne.runs + (batterTwo?.runs ?? 0)
                  const contributionBalls =
                    partnership.batterOne.balls + (batterTwo?.balls ?? 0)
                  const firstContribution =
                    contributionTotal > 0
                      ? partnership.batterOne.runs
                      : partnership.batterOne.balls
                  const secondContribution =
                    contributionTotal > 0
                      ? batterTwo?.runs ?? 0
                      : batterTwo?.balls ?? 0
                  const contributionDenominator = Math.max(
                    firstContribution + secondContribution,
                    contributionBalls > 0 ? contributionBalls : 1,
                  )
                  const firstShare = (firstContribution / contributionDenominator) * 100
                  const barWidth = Math.max(
                    partnership.runs > 0 ? 12 : 4,
                    (partnership.runs / maxPartnershipRuns) * 100,
                  )

                  return (
                    <div key={partnership.key} className="live-score-panel__partnership-row">
                      <div className="live-score-panel__partnership-batter">
                        <strong>{playerName(playerById, partnership.batterOne.playerId)}</strong>
                        <small>
                          {partnership.batterOne.runs} ({partnership.batterOne.balls})
                        </small>
                      </div>
                      <div className="live-score-panel__partnership-total">
                        <strong>
                          {partnership.runs} ({partnership.balls})
                          {partnership.isCurrent ? <em> Current</em> : null}
                        </strong>
                        <span
                          className="live-score-panel__partnership-bar"
                          style={{ width: `${barWidth}%` }}
                          aria-hidden
                        >
                          <span
                            className="is-first"
                            style={{ width: `${firstShare}%` }}
                          />
                          <span className="is-second" />
                        </span>
                      </div>
                      <div className="live-score-panel__partnership-batter is-right">
                        <strong>
                          {batterTwo ? playerName(playerById, batterTwo.playerId) : '—'}
                        </strong>
                        <small>
                          {batterTwo ? `${batterTwo.runs} (${batterTwo.balls})` : '—'}
                        </small>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </section>
    )
  }

  const renderWormChartPanel = () => (
    <section className="live-score-panel__worm" aria-label="Runs worm">
      <h3>Worm</h3>
      <div className="live-score-panel__worm-legends">
        {wormSeries.map((series) => (
          <span key={series.innings} className="live-score-panel__worm-legend">
            <i style={{ backgroundColor: series.color }} aria-hidden />
            {series.team}
          </span>
        ))}
      </div>
      <svg
        viewBox="0 0 230 160"
        role="img"
        aria-label={`Runs progression for ${wormSeries.map((series) => series.team).join(' and ')}`}
      >
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
        {wormSeries.map((series) => {
          const path = renderWormPath(series.points, wormMaxOver, wormMaxRuns)
          return path ? (
            <path
              key={`path-${series.innings}`}
              d={path}
              fill="none"
              stroke={series.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null
        })}
        {wormSeries.flatMap((series) =>
          series.points.slice(-1).map((point) => {
            const cx = 34 + (point.over / wormMaxOver) * 176
            const cy = 126 - (point.runs / wormMaxRuns) * 102
            return (
              <circle
                key={`${series.innings}-${point.over}-${point.runs}`}
                cx={cx}
                cy={cy}
                r="3.5"
                fill={series.color}
              />
            )
          }),
        )}
        <text x="122" y="156" textAnchor="middle" fill="#4b5563" fontSize="9">OVERS</text>
        <text x="4" y="20" fill="#4b5563" fontSize="9">RUNS</text>
      </svg>
    </section>
  )

  const renderLiveStats = () => {
    if (scoringBreakdowns.length === 0) {
      return <p className="live-score-panel__empty">Live statistics will appear after scoring starts.</p>
    }

    const statRows: Array<{
      label: string
      value: (stats: (typeof scoringBreakdowns)[number]['stats']) => string | number
    }> = [
      { label: `Powerplay (${powerplayOvers} ov)`, value: (stats) => stats.powerplay },
      { label: 'Outside powerplay', value: (stats) => stats.outsidePowerplay },
      { label: 'Sixes', value: (stats) => stats.sixes },
      { label: 'Fours', value: (stats) => stats.fours },
      { label: 'Runs in boundaries', value: (stats) => stats.boundaryRuns },
      { label: 'Dot balls', value: (stats) => stats.dotBallPercentage },
      { label: 'Runs in extras', value: (stats) => stats.extras },
    ]

    return (
      <div className="live-score-panel__stats-tab">
        <section className="live-score-panel__stats-breakdown" aria-labelledby="live-stats-breakdown-title">
          <h2 id="live-stats-breakdown-title">Scoring breakdown</h2>
          <div className="live-score-panel__stats-team-head">
            {scoringBreakdowns.map((series) => (
              <strong key={series.innings}>{renderTeamBadge(series.teamId, series.team)}</strong>
            ))}
          </div>
          {statRows.map((row) => (
            <div className="live-score-panel__stat-row" key={row.label}>
              <b>{scoringBreakdowns[0] ? row.value(scoringBreakdowns[0].stats) : '—'}</b>
              <span>{row.label}</span>
              <b>{scoringBreakdowns[1] ? row.value(scoringBreakdowns[1].stats) : '—'}</b>
            </div>
          ))}
        </section>

        {renderPartnerships()}

        <div className="live-score-panel__stats-chart-stack">
          <section className="live-score-panel__chart-card">
            <h3>Manhattan</h3>
            <div
              className="live-score-panel__manhattan"
              role="img"
              aria-label="Runs scored and wickets lost in each over"
              style={{ gridTemplateColumns: `repeat(${maximumComparedOver}, minmax(2.25rem, 1fr))` }}
            >
              {Array.from({ length: maximumComparedOver }, (_, index) => index + 1).map((over) => (
                <div className="live-score-panel__manhattan-over" key={over}>
                  <div className="live-score-panel__manhattan-bars">
                    {inningsOverSeries.map((series) => {
                      const point = series.points.find((row) => row.over === over)
                      const height = point ? Math.max(4, (point.runs / maximumOverRuns) * 100) : 0
                      return (
                        <span
                          key={`${series.innings}-${over}`}
                          style={{ height: `${height}%`, backgroundColor: series.color }}
                          title={`${series.team}, over ${over}: ${point?.runs ?? 0} runs, ${point?.wickets ?? 0} wickets`}
                        >
                          {point?.wickets ? <i>{'W'.repeat(point.wickets)}</i> : null}
                        </span>
                      )
                    })}
                  </div>
                  <small>{over}</small>
                </div>
              ))}
            </div>
            <p className="live-score-panel__chart-caption">Runs per over · wicket markers shown as W</p>
          </section>

          <section className="live-score-panel__chart-card">
            <h3>Run rate</h3>
            <div className="live-score-panel__chart-legend">
              {inningsOverSeries.map((series) => (
                <span key={series.innings}><i style={{ backgroundColor: series.color }} />{series.team}</span>
              ))}
            </div>
            <svg viewBox="0 0 330 160" role="img" aria-label="Run rate by over">
              {[0, 0.5, 1].map((part) => {
                const y = 132 - part * 104
                return (
                  <g key={part}>
                    <line x1="38" y1={y} x2="308" y2={y} stroke="rgba(15,23,42,0.12)" />
                    <text x="31" y={y + 3} textAnchor="end" fill="#4b5563" fontSize="9">
                      {(maximumRunRate * part).toFixed(1)}
                    </text>
                  </g>
                )
              })}
              {inningsOverSeries.map((series) => (
                <path
                  key={series.innings}
                  d={chartLinePath(
                    series.points.map((point) => ({ over: point.over, value: point.runRate })),
                    maximumComparedOver,
                    maximumRunRate,
                  )}
                  fill="none"
                  stroke={series.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              <text x="173" y="155" textAnchor="middle" fill="#4b5563" fontSize="9">OVERS</text>
              <text x="5" y="18" fill="#4b5563" fontSize="9">RR</text>
            </svg>
          </section>

          {renderWormChartPanel()}
        </div>
      </div>
    )
  }

  const renderOvers = () => {
    if (inningsOverSeries.every((series) => series.points.length === 0)) {
      return <p className="live-score-panel__empty">Over-by-over comparisons will appear after scoring starts.</p>
    }

    return (
      <section
        className="live-score-panel__overs-tab"
        style={{ '--over-columns': inningsOverSeries.length } as CSSProperties}
      >
        <header className="live-score-panel__overs-head">
          <span>Ovs</span>
          {inningsOverSeries.map((series) => (
            <strong key={series.innings}>{renderTeamBadge(series.teamId, series.team)}</strong>
          ))}
        </header>
        {Array.from({ length: maximumComparedOver }, (_, index) => index + 1).map((over) => {
          const expanded = expandedOver === over
          return (
            <button
              type="button"
              className="live-score-panel__over-comparison"
              key={over}
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} over ${over} details`}
              onClick={() => setExpandedOver(expanded ? null : over)}
            >
              <span className="live-score-panel__over-number">
                <b>{over}</b><span aria-hidden>{expanded ? '−' : '+'}</span>
              </span>
              {inningsOverSeries.map((series) => {
                const point = series.points.find((row) => row.over === over)
                if (!point) return <span className="live-score-panel__empty-over" key={series.innings}>—</span>
                const bowlerId = point.group.deliveries[0]?.event.bowler_player_id
                return (
                  <span className="live-score-panel__over-cell" key={series.innings}>
                    <span className="live-score-panel__over-cell-summary">
                      <strong>{point.score}/{point.scoreWickets}</strong>
                      <span>{plural(point.runs, 'run')}, {plural(point.wickets, 'wkt', 'wkts')}</span>
                    </span>
                    {expanded ? (
                      <span className="live-score-panel__over-cell-details">
                        <span><strong>Bowler:</strong> {playerName(playerById, bowlerId)}</span>
                        <span className="live-score-panel__over-deliveries">
                          {[...point.group.deliveries]
                            .sort((a, b) => a.event.sequence_number - b.event.sequence_number)
                            .map((delivery) => (
                              <b key={delivery.event.id} className={`live-score-panel__strip-token${delivery.tokenClass}`}>
                                {delivery.token}
                              </b>
                            ))}
                        </span>
                        <span>RR: <strong>{point.runRate.toFixed(2)}</strong></span>
                      </span>
                    ) : null}
                  </span>
                )
              })}
            </button>
          )
        })}
      </section>
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
                    <strong>{group.overNumber + 1}</strong>
                  </div>
                  <div className="live-score-panel__over-runs">
                    {group.overNote ?? `${group.runs} run${group.runs === 1 ? '' : 's'}`}
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

          <aside className="live-score-panel__insights">
            <section
              className="live-score-panel__win-probability"
              aria-label="Live win probability"
            >
              <div className="live-score-panel__insight-heading">
                <h3>Win probability</h3>
                <span
                  title="Live estimate based on score, target, balls and wickets remaining, plus the available career form of the current batters and bowler."
                  aria-label="About win probability"
                >
                  i
                </span>
              </div>
              <div className="live-score-panel__probability-legends">
                <span>
                  <i style={{ backgroundColor: '#0969c8' }} aria-hidden />
                  {firstDisplayTeam} <strong>{firstTeamWinPercent}%</strong>
                </span>
                <span>
                  <i style={{ backgroundColor: '#f97316' }} aria-hidden />
                  {secondDisplayTeam} <strong>{secondTeamWinPercent}%</strong>
                </span>
              </div>
              <svg
                viewBox="0 0 230 146"
                role="img"
                aria-label={`${firstDisplayTeam} ${firstTeamWinPercent} percent, ${secondDisplayTeam} ${secondTeamWinPercent} percent`}
              >
                <line
                  x1="12"
                  y1="68"
                  x2="218"
                  y2="68"
                  stroke="rgba(15,23,42,0.18)"
                />
                <text x="218" y="13" textAnchor="end" fill="#4b5563" fontSize="8">
                  {firstDisplayTeam} 100%
                </text>
                <text x="218" y="65" textAnchor="end" fill="#4b5563" fontSize="8">
                  50%
                </text>
                <text x="218" y="132" textAnchor="end" fill="#4b5563" fontSize="8">
                  {secondDisplayTeam} 100%
                </text>
                {secondInningsStartSequence != null ? (
                  <line
                    x1={
                      12 +
                      (secondInningsStartSequence /
                        winProbabilityMaxSequence) *
                        206
                    }
                    y1="16"
                    x2={
                      12 +
                      (secondInningsStartSequence /
                        winProbabilityMaxSequence) *
                        206
                    }
                    y2="120"
                    stroke="rgba(15,23,42,0.22)"
                  />
                ) : null}
                <path
                  d={winProbabilityPath}
                  fill="none"
                  stroke="#0969c8"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {winProbabilityPoints
                  .filter((point) => point.isWicket)
                  .map((point) => (
                    <circle
                      key={`probability-wicket-${point.sequence}`}
                      cx={
                        12 +
                        (point.sequence / winProbabilityMaxSequence) * 206
                      }
                      cy={16 + (1 - point.firstTeamProbability) * 104}
                      r="3.5"
                      fill="#ef4444"
                    />
                  ))}
                <text x="16" y="143" fill="#4b5563" fontSize="8">
                  1st innings
                </text>
                {secondInningsStartSequence != null ? (
                  <text x="214" y="143" textAnchor="end" fill="#4b5563" fontSize="8">
                    2nd innings
                  </text>
                ) : null}
              </svg>
            </section>
            <section className="live-score-panel__worm" aria-label="Runs worm">
              <h3>Worm</h3>
              <div className="live-score-panel__worm-legends">
                {wormSeries.map((series) => (
                  <span key={series.innings} className="live-score-panel__worm-legend">
                    <i style={{ backgroundColor: series.color }} aria-hidden />
                    {series.team}
                  </span>
                ))}
              </div>
              <svg
                viewBox="0 0 230 160"
                role="img"
                aria-label={`Runs progression for ${wormSeries.map((series) => series.team).join(' and ')}`}
              >
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
                {wormSeries.map((series) => {
                  const path = renderWormPath(series.points, wormMaxOver, wormMaxRuns)
                  return path ? (
                    <path
                      key={`path-${series.innings}`}
                      d={path}
                      fill="none"
                      stroke={series.color}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null
                })}
                {wormSeries.flatMap((series) =>
                  series.points.slice(-1).map((point) => {
                    const cx = 34 + (point.over / wormMaxOver) * 176
                    const cy = 126 - (point.runs / wormMaxRuns) * 102
                    return (
                      <circle
                        key={`${series.innings}-${point.over}-${point.runs}`}
                        cx={cx}
                        cy={cy}
                        r="3.5"
                        fill={series.color}
                      />
                    )
                  }),
                )}
                <text x="122" y="156" textAnchor="middle" fill="#4b5563" fontSize="9">OVERS</text>
                <text x="4" y="20" fill="#4b5563" fontSize="9">RUNS</text>
              </svg>
            </section>
            {renderPartnerships()}
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
          const recordedBatterIds = new Set(
            inningsDashboard.batters.map((stat) => stat.playerId),
          )
          const didNotBatPlayers = [...(
            squadQ.data?.teams.find((team) => team.team_id === summary.batting_team_id)?.players ??
            []
          )]
            .filter(
              (row) =>
                (row.role === 'playing_xi' || row.role === 'concussion_substitute') &&
                !recordedBatterIds.has(row.player_id),
            )
            .sort(
              (a, b) =>
                a.lineup_order - b.lineup_order ||
                a.player_id - b.player_id,
            )
          const extras = inningsExtrasSummary(inningsDashboard.events)
          const fallOfWickets = inningsFallOfWickets(inningsDashboard.events)
          return (
            <section key={summary.innings} className="live-score-panel__innings-card">
              <div className="live-score-panel__section-head">
                <h3>{renderTeamBadge(summary.batting_team_id, teamName(summary.batting_team_id, teamNames))}</h3>
                <strong>{summary.runs}/{summary.wickets} ({summary.overs_label} ov)</strong>
              </div>
              <div className="live-score-panel__table-wrap">
                <table className="live-score-panel__detail-table live-score-panel__detail-table--batting">
                  <colgroup>
                    <col className="live-score-panel__batter-column" />
                    <col className="live-score-panel__dismissal-column" />
                    <col className="live-score-panel__batting-stat-column" />
                    <col className="live-score-panel__batting-stat-column" />
                    <col className="live-score-panel__batting-stat-column" />
                    <col className="live-score-panel__batting-stat-column" />
                    <col className="live-score-panel__strike-rate-column" />
                  </colgroup>
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
                  <tfoot>
                    <tr className="live-score-panel__extras-row">
                      <th colSpan={2}>Extras</th>
                      <td colSpan={5}>
                        <strong>{extras.total}</strong> ({extras.breakdown})
                      </td>
                    </tr>
                    <tr className="live-score-panel__total-row">
                      <th colSpan={2}>Total</th>
                      <td colSpan={5}>
                        <strong>{summary.runs}/{summary.wickets}</strong>{' '}
                        ({summary.overs_label} overs)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {didNotBatPlayers.length > 0 ? (
                <p className="live-score-panel__scorecard-note">
                  <strong>Yet to bat:</strong>{' '}
                  {didNotBatPlayers
                    .map((row) => playerName(playerById, row.player_id))
                    .join(', ')}
                </p>
              ) : null}
              <p className="live-score-panel__scorecard-note">
                <strong>Fall of wickets:</strong>{' '}
                {fallOfWickets.length > 0
                  ? fallOfWickets
                      .map(
                        (row) =>
                          `${row.wicket}-${row.score} (${playerName(playerById, row.playerId)}, ${row.over})`,
                      )
                      .join(', ')
                  : 'None'}
              </p>
              <div className="live-score-panel__table-wrap live-score-panel__bowling-table-wrap">
                <table className="live-score-panel__detail-table live-score-panel__detail-table--bowling">
                  <colgroup>
                    <col className="live-score-panel__bowler-column" />
                    <col className="live-score-panel__bowling-stat-column" />
                    <col className="live-score-panel__bowling-stat-column" />
                    <col className="live-score-panel__bowling-stat-column" />
                    <col className="live-score-panel__bowling-stat-column" />
                    <col className="live-score-panel__economy-column" />
                    <col className="live-score-panel__bowling-stat-column" />
                    <col className="live-score-panel__bowling-stat-column" />
                    <col className="live-score-panel__bowling-stat-column" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Bowler</th>
                      <th>O</th>
                      <th>M</th>
                      <th>R</th>
                      <th>W</th>
                      <th>Econ</th>
                      <th>0s</th>
                      <th>WD</th>
                      <th>NB</th>
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
                        <td>{stat.dots}</td>
                        <td>{stat.wides}</td>
                        <td>{stat.noBalls}</td>
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

  const renderSquads = () => (
    <div className="live-score-panel__teams-tab">
      {[homeTeamId, awayTeamId].map((teamId) => {
        const name = teamName(teamId, teamNames)
        const teamSquad = squadQ.data?.teams.find((row) => row.team_id === teamId)
        const rows = [...(teamSquad?.players ?? [])].sort(
          (a, b) => a.lineup_order - b.lineup_order || a.player_id - b.player_id,
        )
        const playing = rows.filter((row) => row.role === 'playing_xi')
        const substitutes = rows.filter((row) => row.role !== 'playing_xi')
        return (
          <section key={teamId} className="live-score-panel__squad-card">
            <header className="live-score-panel__squad-head">
              <small>Official match squad</small>
              <h3>{renderTeamBadge(teamId, name)}</h3>
            </header>
            {playing.length === 0 ? (
              <p className="live-score-panel__muted">Playing XI has not been published yet.</p>
            ) : (
              <ol className="live-score-panel__squad-list">
                {playing.map((row) => (
                  <li key={row.player_id}>
                    <span>
                      <strong>{playerName(playerById, row.player_id)}</strong>
                      <small>{playerById.get(row.player_id)?.role?.trim() || 'Player'}</small>
                    </span>
                    <small>{[row.is_captain ? 'C' : '', row.is_wicketkeeper ? 'WK' : ''].filter(Boolean).join(' · ')}</small>
                  </li>
                ))}
              </ol>
            )}
            {substitutes.length > 0 ? (
              <div className="live-score-panel__substitutes">
                <h4>Substitutes</h4>
                <p>{substitutes.map((row) => playerName(playerById, row.player_id)).join(', ')}</p>
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )

  const renderPhotos = () => (
    <section className="live-score-panel__photos-tab" aria-labelledby="match-photos-title">
      <header>
        <small>Official match photographs</small>
        <h2 id="match-photos-title">Photos</h2>
      </header>
      {photosQ.isLoading ? (
        <p className="live-score-panel__empty">Loading match photos…</p>
      ) : photosQ.isError ? (
        <p className="live-score-panel__empty">Match photos could not be loaded.</p>
      ) : (photosQ.data ?? []).length === 0 ? (
        <p className="live-score-panel__empty">Official match photographs will appear here when they are published.</p>
      ) : (
        <div className="live-score-panel__photo-grid">
          {(photosQ.data ?? []).map((item) => (
            <GalleryCard key={item.id} item={item} onOpen={setActivePhoto} />
          ))}
        </div>
      )}
    </section>
  )

  const renderMatchInfo = () => {
    const match = matchQ.data
    if (!match) return <p className="live-score-panel__empty">Loading match information…</p>

    const competition = match.season?.league?.name ?? 'National Premier League'
    const season = match.season?.name ?? '—'
    const date = match.start_time
      ? new Intl.DateTimeFormat('en-ZW', {
          dateStyle: 'long',
          timeStyle: 'short',
        }).format(new Date(match.start_time))
      : match.match_date
        ? formatMatchDate(match.match_date)
        : 'To be confirmed'
    const scheduledOvers = Number(match.match_overs)
    const matchFormat = Number.isFinite(scheduledOvers) && scheduledOvers > 0
      ? scheduledOvers === 20
        ? 'Twenty20'
        : scheduledOvers === 50
          ? 'One Day (50 overs)'
          : `${scheduledOvers} overs per innings`
      : 'To be confirmed'
    const details = [
      ['Competition', competition],
      ['Season', season],
      ['Format', matchFormat],
      ['Category', formatCategoryLabel(match.category ?? 'cricket')],
      ['Date', date],
      ['Venue', match.venue?.trim() || 'To be confirmed'],
      ['Toss', match.toss_info?.trim() || 'Pending'],
    ]

    return (
      <section className="live-score-panel__info-tab" aria-labelledby="match-info-title">
        <header>
          <small>Official details</small>
          <h2 id="match-info-title">Match information</h2>
        </header>
        <dl>
          {details.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
        <div className="live-score-panel__info-panels">
          <article>
            <h3>Match officials</h3>
            <p>{match.umpires?.trim() || 'Officials will appear once appointments are published.'}</p>
          </article>
          <article>
            <h3>Playing conditions</h3>
            <p>{match.match_overs ? `${match.match_overs} overs per innings` : 'Overs per innings to be confirmed.'}</p>
            {match.description?.trim() ? <p>{match.description}</p> : null}
          </article>
        </div>
      </section>
    )
  }

  const streamAvailable = Boolean(matchQ.data?.stream_available)
  const tabs: Array<{ id: LiveTab; label: string }> = [
    { id: 'live', label: 'Live' },
    ...(streamAvailable ? [{ id: 'stream' as const, label: 'Watch Live' }] : []),
    { id: 'scorecard', label: 'Scorecard' },
    { id: 'commentary', label: 'Commentary' },
    { id: 'stats', label: 'Live Stats' },
    { id: 'overs', label: 'Overs' },
    { id: 'photos', label: 'Photos' },
    { id: 'squads', label: 'Playing XI' },
    { id: 'info', label: 'Match Info' },
  ]

  return (
    <section className="live-score-panel live-score-panel--cricinfo" aria-label="Live score">
      <style>{`
        .live-score-panel--cricinfo {
          --live-ink: #111827;
          --live-muted: #57607a;
          --live-line: rgba(56, 11, 17, 0.12);
          --live-soft: #f7f2ec;
          --live-band: #eee4da;
          --live-blue: var(--color-rust-orange, #b64d28);
          --live-over: #fff0e5;
          --live-over-2: #f6dfcf;
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
        .live-score-panel__dls {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.35rem 1rem;
          margin: 0.85rem 0 0;
          padding: 0.65rem 0.8rem;
          border: 1px solid #bfdbfe;
          border-radius: 0.8rem;
          background: #eff6ff;
          color: #1e3a8a;
          font-size: 0.88rem;
          font-weight: 800;
        }
        .live-score-panel__dls strong {
          font-size: 1rem;
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
          gap: 0;
          overflow-x: auto;
          padding: 0.8rem 1rem;
          background: #fff;
          border-bottom: 1px solid var(--live-line);
          scrollbar-width: thin;
        }
        .live-score-panel__over-strip-group {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.4rem 0.8rem;
          border-right: 1px solid var(--live-line);
          flex: 0 0 auto;
        }
        .live-score-panel__over-strip-group:first-child { padding-left: 0; }
        .live-score-panel__over-strip-group:last-child { border-right: 0; }
        .live-score-panel__strip-over {
          color: #5d657e;
          font-size: 0.72rem;
          font-weight: 900;
          text-align: center;
          min-width: 3.3rem;
          line-height: 1.05;
        }
        .live-score-panel__strip-over strong {
          display: block;
          color: var(--live-ink);
          font-size: 0.72rem;
          margin-top: 0.2rem;
          white-space: nowrap;
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
        .live-score-panel__ball-token { min-width: 2.5rem; width: auto; height: 2.5rem; padding: 0 0.35rem; font-size: 0.93rem; }
        .live-score-panel__strip-token {
          min-width: 2.5rem;
          height: 2.5rem;
          padding: 0 0.45rem;
          border-radius: 0.28rem;
          font-size: 0.95rem;
          flex: 0 0 auto;
        }
        .live-score-panel__ball-token.is-four, .live-score-panel__strip-token.is-four { background: #dcfce7; color: #166534; }
        .live-score-panel__ball-token.is-six, .live-score-panel__strip-token.is-six { background: #ede9fe; color: #5b21b6; }
        .live-score-panel__ball-token.is-wicket, .live-score-panel__strip-token.is-wicket { background: #fee2e2; color: #991b1b; text-transform: uppercase; }
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
        .live-score-panel__ball-row { display: grid; grid-template-columns: 3rem minmax(2.8rem, max-content) minmax(0, 1fr); gap: 0.85rem; padding: 1.05rem 1rem; border-top: 1px solid var(--live-line); }
        .live-score-panel__ball-number { color: #4f5871; font-weight: 850; padding-top: 0.55rem; text-align: right; }
        .live-score-panel__ball-title { margin: 0 0 0.25rem; color: #4f5871; font-size: 0.78rem; font-weight: 950; letter-spacing: 0.09em; text-transform: uppercase; }
        .live-score-panel__ball-detail { margin: 0; color: var(--live-ink); font-size: 1rem; line-height: 1.55; }
        .live-score-panel__insights { min-width: 0; background: #fff; }
        .live-score-panel__win-probability { padding: 1rem; border-bottom: 1px solid var(--live-line); }
        .live-score-panel__insight-heading { display: flex; align-items: center; gap: 0.45rem; }
        .live-score-panel__insight-heading h3 { margin: 0; font-size: 1.1rem; font-weight: 900; }
        .live-score-panel__insight-heading > span { display: inline-grid; place-items: center; width: 1.15rem; height: 1.15rem; border: 1.5px solid #64748b; border-radius: 999px; color: #64748b; cursor: help; font-size: 0.7rem; font-weight: 900; }
        .live-score-panel__probability-legends { display: flex; flex-wrap: wrap; gap: 0.45rem 0.8rem; margin: 0.65rem 0 0.35rem; }
        .live-score-panel__probability-legends span { display: inline-flex; align-items: center; gap: 0.35rem; min-width: 0; color: var(--live-ink); font-size: 0.75rem; font-weight: 700; }
        .live-score-panel__probability-legends i { width: 0.55rem; height: 0.55rem; border-radius: 999px; flex: 0 0 auto; }
        .live-score-panel__probability-legends strong { font-weight: 950; }
        .live-score-panel__win-probability svg { display: block; width: 100%; height: auto; }
        .live-score-panel__worm { padding: 1rem; border-bottom: 1px solid var(--live-line); }
        .live-score-panel__worm h3 { margin: 0 0 0.8rem; font-size: 1.1rem; font-weight: 900; }
        .live-score-panel__worm-legends { display: flex; flex-wrap: wrap; gap: 0.55rem 0.9rem; margin-bottom: 0.6rem; }
        .live-score-panel__worm-legend { display: inline-flex; align-items: center; gap: 0.4rem; color: var(--live-ink); font-size: 0.85rem; font-weight: 700; }
        .live-score-panel__worm-legend i { width: 0.62rem; height: 0.62rem; border-radius: 999px; flex: 0 0 auto; }
        .live-score-panel__worm svg { display: block; width: 100%; height: auto; }
        .live-score-panel__partnerships { padding: 1rem; }
        .live-score-panel__partnerships > h3 { margin: 0 0 1rem; font-size: 1.1rem; font-weight: 900; }
        .live-score-panel__partnership-innings + .live-score-panel__partnership-innings { margin-top: 1.35rem; padding-top: 1.1rem; border-top: 1px solid var(--live-line); }
        .live-score-panel__partnership-innings h4 { margin: 0 0 0.9rem; color: #4c556f; font-size: 0.88rem; letter-spacing: 0.04em; }
        .live-score-panel__partnership-list { display: grid; gap: 1rem; }
        .live-score-panel__partnership-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(6.5rem, 0.8fr) minmax(0, 1fr); gap: 0.55rem; align-items: center; }
        .live-score-panel__partnership-batter { min-width: 0; }
        .live-score-panel__partnership-batter strong,
        .live-score-panel__partnership-batter small { display: block; overflow: hidden; text-overflow: ellipsis; }
        .live-score-panel__partnership-batter strong { color: var(--live-ink); font-size: 0.78rem; white-space: nowrap; }
        .live-score-panel__partnership-batter small { margin-top: 0.22rem; color: var(--live-muted); font-size: 0.72rem; font-weight: 700; }
        .live-score-panel__partnership-batter.is-right { text-align: right; }
        .live-score-panel__partnership-total { display: grid; justify-items: center; min-width: 0; }
        .live-score-panel__partnership-total > strong { color: var(--live-ink); font-size: 0.8rem; white-space: nowrap; }
        .live-score-panel__partnership-total em { color: #64748b; font-size: 0.62rem; font-style: normal; font-weight: 800; text-transform: uppercase; }
        .live-score-panel__partnership-bar { display: flex; height: 0.45rem; min-width: 0.22rem; max-width: 100%; margin-top: 0.38rem; overflow: hidden; border-radius: 999px; background: #f0d8db; }
        .live-score-panel__partnership-bar span { display: block; height: 100%; }
        .live-score-panel__partnership-bar .is-first { flex: 0 0 auto; background: #7a1f2a; }
        .live-score-panel__partnership-bar .is-second { flex: 1 1 auto; background: #c98f97; }
        .live-score-panel__partnership-innings.is-secondary .live-score-panel__partnership-bar { background: #ffedd5; }
        .live-score-panel__partnership-innings.is-secondary .live-score-panel__partnership-bar .is-first { background: #f97316; }
        .live-score-panel__partnership-innings.is-secondary .live-score-panel__partnership-bar .is-second { background: #fdba74; }
        .live-score-panel__empty, .live-score-panel__muted { margin: 0; color: var(--live-muted); }
        .live-score-panel__empty { padding: 1rem; }
        .live-score-panel__full-scorecard, .live-score-panel__teams-tab, .live-score-panel__stream-panel { padding: 1rem; }
        .live-score-panel__innings-card, .live-score-panel__squad-card { border: 1px solid var(--live-line); border-radius: 0.85rem; overflow: hidden; margin-bottom: 1rem; background: #fff; }
        .live-score-panel__section-head { padding: 0.85rem 1rem; background: #f8fafc; border-bottom: 1px solid var(--live-line); }
        .live-score-panel__section-head h3 { margin: 0; font-size: 1rem; font-weight: 950; }
        .live-score-panel__innings-card > .live-score-panel__section-head {
          background: linear-gradient(135deg, var(--color-deep-maroon, #380b11), #571821);
          color: #fff;
        }
        .live-score-panel__innings-card > .live-score-panel__section-head h3,
        .live-score-panel__innings-card > .live-score-panel__section-head strong { color: #fff; }
        .live-score-panel__table-wrap { overflow-x: auto; }
        .live-score-panel__detail-table th:nth-child(n + 2), .live-score-panel__detail-table td:nth-child(n + 2) { text-align: center; }
        .live-score-panel__detail-table--batting { min-width: 48rem; }
        .live-score-panel__detail-table--batting .live-score-panel__batter-column { width: 28%; }
        .live-score-panel__detail-table--batting .live-score-panel__dismissal-column { width: 38%; }
        .live-score-panel__detail-table--batting .live-score-panel__batting-stat-column { width: 6%; }
        .live-score-panel__detail-table--batting .live-score-panel__strike-rate-column { width: 10%; }
        .live-score-panel__detail-table--batting th:nth-child(2),
        .live-score-panel__detail-table--batting td:nth-child(2) { text-align: left; }
        .live-score-panel__detail-table--batting th:nth-child(n + 3),
        .live-score-panel__detail-table--batting td:nth-child(n + 3) {
          padding-left: 0.35rem;
          padding-right: 0.35rem;
          white-space: nowrap;
        }
        .live-score-panel__detail-table--bowling { min-width: 48rem; }
        .live-score-panel__bowling-table-wrap { margin-top: 1rem; }
        .live-score-panel__detail-table--bowling .live-score-panel__bowler-column { width: 44%; }
        .live-score-panel__detail-table--bowling .live-score-panel__bowling-stat-column { width: 6%; }
        .live-score-panel__detail-table--bowling .live-score-panel__economy-column { width: 10%; }
        .live-score-panel__detail-table--bowling th:nth-child(n + 2),
        .live-score-panel__detail-table--bowling td:nth-child(n + 2) {
          padding-left: 0.4rem;
          padding-right: 0.4rem;
          white-space: nowrap;
        }
        .live-score-panel__detail-table tfoot th,
        .live-score-panel__detail-table tfoot td {
          border-top: 1px solid var(--live-line);
          background: #fffaf5;
          color: #5a3e43;
          text-align: left !important;
        }
        .live-score-panel__detail-table tfoot .live-score-panel__total-row th,
        .live-score-panel__detail-table tfoot .live-score-panel__total-row td {
          background: #f6e7db;
          color: var(--color-deep-maroon, #380b11);
          font-size: 0.88rem;
        }
        .live-score-panel__scorecard-note {
          margin: 0;
          padding: 0.65rem 1rem;
          border-top: 1px solid var(--live-line);
          color: #6f5a5e;
          font-size: 0.8rem;
          line-height: 1.5;
        }
        .live-score-panel__detail-table--batting th:first-child,
        .live-score-panel__detail-table--batting td:first-child,
        .live-score-panel__detail-table--batting th:nth-child(2),
        .live-score-panel__detail-table--batting td:nth-child(2),
        .live-score-panel__detail-table--bowling th:first-child,
        .live-score-panel__detail-table--bowling td:first-child {
          overflow-wrap: normal;
          word-break: normal;
        }
        .live-score-panel__teams-tab { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
        .live-score-panel__squad-head { padding: 0.85rem 1rem; background: #f8fafc; border-bottom: 1px solid var(--live-line); }
        .live-score-panel__squad-head > small, .live-score-panel__photos-tab > header small, .live-score-panel__info-tab > header small { display: block; color: #7c2d12; font-size: 0.72rem; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
        .live-score-panel__squad-head h3 { margin: 0.3rem 0 0; }
        .live-score-panel__squad-list { list-style: decimal; margin: 0; padding: 0.5rem 1rem 0.75rem 2.4rem; }
        .live-score-panel__squad-list li { padding: 0.45rem 0; border-bottom: 1px solid rgba(15,23,42,0.05); }
        .live-score-panel__squad-list li:last-child { border-bottom: 0; }
        .live-score-panel__squad-list li > span > small { display: block; margin-top: 0.12rem; color: var(--live-muted); font-weight: 650; }
        .live-score-panel__squad-list li > small { color: #7c2d12; font-weight: 950; }
        .live-score-panel__substitutes { padding: 0.75rem 1rem 1rem; border-top: 1px solid var(--live-line); }
        .live-score-panel__substitutes h4 { margin: 0 0 0.35rem; font-size: 0.85rem; }
        .live-score-panel__substitutes p { margin: 0; color: var(--live-muted); line-height: 1.55; }
        .live-score-panel__stats-tab { display: grid; gap: 1rem; padding: 1rem; background: #fbfaf8; }
        .live-score-panel__stats-breakdown, .live-score-panel__chart-card, .live-score-panel__stats-tab > .live-score-panel__partnerships { overflow: hidden; border: 1px solid var(--live-line); border-radius: 0.85rem; background: #fff; }
        .live-score-panel__stats-breakdown > h2, .live-score-panel__chart-card > h3 { margin: 0; padding: 0.9rem 1rem; font-size: 1.08rem; }
        .live-score-panel__stats-team-head { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; padding: 0.7rem 1rem; background: var(--live-band); }
        .live-score-panel__stats-team-head strong:last-child { display: flex; justify-content: flex-end; }
        .live-score-panel__stat-row { display: grid; grid-template-columns: minmax(4rem, 1fr) minmax(9rem, 1.7fr) minmax(4rem, 1fr); align-items: center; gap: 0.75rem; min-height: 2.85rem; padding: 0.45rem 1rem; border-top: 1px solid var(--live-line); text-align: center; }
        .live-score-panel__stat-row b:first-child { text-align: left; }
        .live-score-panel__stat-row b:last-child { text-align: right; }
        .live-score-panel__stat-row span { color: var(--live-muted); font-weight: 750; }
        .live-score-panel__stats-chart-stack { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
        .live-score-panel__stats-chart-stack > .live-score-panel__worm { border: 1px solid var(--live-line); border-radius: 0.85rem; }
        .live-score-panel__manhattan { display: grid; align-items: end; gap: 0.4rem; min-width: 28rem; height: 13rem; padding: 1rem 1rem 0.6rem; border-top: 1px solid var(--live-line); overflow-x: auto; }
        .live-score-panel__manhattan-over { display: grid; grid-template-rows: 9.5rem auto; gap: 0.35rem; align-items: end; text-align: center; }
        .live-score-panel__manhattan-bars { display: flex; align-items: flex-end; justify-content: center; gap: 0.18rem; height: 100%; border-bottom: 1px solid #64748b; }
        .live-score-panel__manhattan-bars > span { position: relative; display: block; width: min(0.85rem, 42%); min-height: 0; border-radius: 0.25rem 0.25rem 0 0; }
        .live-score-panel__manhattan-bars i { position: absolute; left: 50%; top: -1rem; transform: translateX(-50%); color: #991b1b; font-size: 0.65rem; font-style: normal; font-weight: 950; }
        .live-score-panel__manhattan-over small { color: var(--live-muted); font-weight: 800; }
        .live-score-panel__chart-card { overflow-x: auto; }
        .live-score-panel__chart-card svg { display: block; width: 100%; min-width: 24rem; height: auto; padding: 0 0.5rem 0.6rem; }
        .live-score-panel__chart-caption { margin: 0; padding: 0 1rem 0.9rem; color: var(--live-muted); font-size: 0.78rem; }
        .live-score-panel__chart-legend { display: flex; flex-wrap: wrap; gap: 0.55rem 1rem; padding: 0 1rem 0.4rem; }
        .live-score-panel__chart-legend span { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--live-muted); font-size: 0.8rem; font-weight: 750; }
        .live-score-panel__chart-legend i { width: 0.65rem; height: 0.65rem; border-radius: 999px; }
        .live-score-panel__overs-tab { overflow-x: auto; }
        .live-score-panel__overs-head, .live-score-panel__over-comparison { display: grid; grid-template-columns: 4rem repeat(var(--over-columns), minmax(12rem, 1fr)); min-width: calc(4rem + var(--over-columns) * 12rem); }
        .live-score-panel__overs-head { align-items: center; background: var(--live-band); color: var(--live-ink); }
        .live-score-panel__overs-head > * { padding: 0.8rem 1rem; }
        .live-score-panel__overs-head > strong { border-left: 1px solid var(--live-line); }
        .live-score-panel__over-comparison { appearance: none; width: 100%; padding: 0; border: 0; border-top: 1px solid var(--live-line); background: #fff; color: var(--live-ink); font: inherit; text-align: left; cursor: pointer; }
        .live-score-panel__over-comparison:hover { background: #fffaf5; }
        .live-score-panel__over-comparison:focus-visible, .live-score-panel__tab:focus-visible { outline: 3px solid #f59e0b; outline-offset: -3px; }
        .live-score-panel__over-number { display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 0.75rem 0.85rem 1rem; color: #7c2d12; }
        .live-score-panel__over-number b { font-size: 1.1rem; }
        .live-score-panel__over-number > span { font-size: 1.25rem; }
        .live-score-panel__over-cell, .live-score-panel__empty-over { padding: 0.85rem 1rem; border-left: 1px solid var(--live-line); }
        .live-score-panel__over-cell-summary { display: flex; align-items: baseline; justify-content: space-between; gap: 0.6rem; }
        .live-score-panel__over-cell-summary > strong { font-size: 1.05rem; }
        .live-score-panel__over-cell-summary > span { color: var(--live-muted); font-size: 0.8rem; font-weight: 700; }
        .live-score-panel__over-cell-details { display: grid; gap: 0.65rem; margin-top: 0.8rem; padding-top: 0.75rem; border-top: 1px solid var(--live-line); color: var(--live-muted); font-size: 0.82rem; }
        .live-score-panel__over-deliveries { display: flex; flex-wrap: wrap; gap: 0.35rem; }
        .live-score-panel__over-deliveries .live-score-panel__strip-token { min-width: 2rem; width: auto; height: 2rem; padding: 0 0.35rem; }
        .live-score-panel__photos-tab, .live-score-panel__info-tab { padding: 1rem; }
        .live-score-panel__photos-tab > header, .live-score-panel__info-tab > header { margin-bottom: 1rem; }
        .live-score-panel__photos-tab h2, .live-score-panel__info-tab h2 { margin: 0.25rem 0 0; }
        .live-score-panel__photo-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
        .live-score-panel__info-tab dl { margin: 0; border: 1px solid var(--live-line); border-radius: 0.85rem; overflow: hidden; }
        .live-score-panel__info-tab dl > div { display: grid; grid-template-columns: minmax(8rem, 0.45fr) minmax(0, 1fr); gap: 1rem; padding: 0.8rem 1rem; border-top: 1px solid var(--live-line); }
        .live-score-panel__info-tab dl > div:first-child { border-top: 0; }
        .live-score-panel__info-tab dt { color: var(--live-muted); font-weight: 800; }
        .live-score-panel__info-tab dd { margin: 0; color: var(--live-ink); font-weight: 750; }
        .live-score-panel__info-panels { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-top: 1rem; }
        .live-score-panel__info-panels article { padding: 1rem; border: 1px solid var(--live-line); border-radius: 0.85rem; background: #fffaf5; }
        .live-score-panel__info-panels h3 { margin: 0 0 0.55rem; }
        .live-score-panel__info-panels p { margin: 0; color: var(--live-muted); line-height: 1.55; }
        .live-score-panel__info-panels p + p { margin-top: 0.45rem; }
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
          .live-score-panel__insights { border-top: 1px solid var(--live-line); }
          .live-score-panel__worm { padding: 0.85rem; }
          .live-score-panel__partnerships { padding: 0.85rem; }
          .live-score-panel__match-centre-title { padding-left: 0.85rem; padding-right: 0.85rem; }
          .live-score-panel__over-head { grid-template-columns: 4.4rem minmax(0, 1fr) auto; padding: 0.72rem 0.85rem; }
          .live-score-panel__over-score { font-size: 1.18rem; }
          .live-score-panel__over-meta { padding: 0.5rem 0.85rem; font-size: 0.8rem; }
          .live-score-panel__ball-row { grid-template-columns: 2.5rem minmax(2.5rem, max-content) minmax(0, 1fr); gap: 0.65rem; padding: 0.95rem 0.85rem; }
          .live-score-panel__ball-number { text-align: left; }
          .live-score-panel__ball-detail { font-size: 0.98rem; }
          .live-score-panel__teams-tab, .live-score-panel__photo-grid, .live-score-panel__stats-chart-stack, .live-score-panel__info-panels { grid-template-columns: 1fr; }
          .live-score-panel__teams-tab, .live-score-panel__full-scorecard, .live-score-panel__photos-tab, .live-score-panel__info-tab, .live-score-panel__stats-tab { padding: 0.85rem; }
          .live-score-panel__stat-row { grid-template-columns: minmax(3rem, 0.7fr) minmax(8rem, 1.5fr) minmax(3rem, 0.7fr); padding-inline: 0.75rem; }
          .live-score-panel__info-tab dl > div { grid-template-columns: 1fr; gap: 0.2rem; }
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

        {secondInningsSummary && targetRuns != null && liveQ.data?.revised_target_runs != null ? (
          <div className="live-score-panel__dls" aria-live="polite">
            <span>ICC DLS Standard revised target: {targetRuns}</span>
            <strong>
              Duckworth-Lewis-Stern (DLS) par score: {liveQ.data.dls_par_score ?? '—'}
            </strong>
          </div>
        ) : null}

        {activeSummary ? (
          <>
            <p className={`live-score-panel__match-note${matchSituationNote ? ' is-chase' : ''}`}>
              {matchSituationNote ?? `${bowlingTeam} fielding.`}
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

      <div className="live-score-panel__tabs" role="tablist" aria-label="Live match tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            id={`live-match-tab-${tab.id}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`live-match-panel-${tab.id}`}
            className={`live-score-panel__tab${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id={`live-match-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`live-match-tab-${activeTab}`}
        tabIndex={0}
      >
        {activeTab === 'live' ? (
          <>
            {renderMiniScorecard()}
            {renderCommentary()}
          </>
        ) : null}
        {activeTab === 'stream' && streamAvailable ? (
          <div className="live-score-panel__stream-panel">
            <MatchStreamPanel
              matchId={matchId}
              streamLabel={matchQ.data?.stream_label}
              homeName={homeName}
              awayName={awayName}
              isLive={isLive}
            />
          </div>
        ) : null}
        {activeTab === 'scorecard' ? renderFullScorecard() : null}
        {activeTab === 'commentary' ? renderCommentary() : null}
        {activeTab === 'stats' ? renderLiveStats() : null}
        {activeTab === 'overs' ? renderOvers() : null}
        {activeTab === 'photos' ? renderPhotos() : null}
        {activeTab === 'squads' ? renderSquads() : null}
        {activeTab === 'info' ? renderMatchInfo() : null}
      </div>
      <GalleryLightbox active={activePhoto} onClose={() => setActivePhoto(null)} />
    </section>
  )
}
