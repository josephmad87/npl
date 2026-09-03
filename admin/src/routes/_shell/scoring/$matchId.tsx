import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { CloudUpload, ImagePlus, LockKeyhole, Pencil, RotateCcw, Save, Undo2, Wifi, WifiOff, X } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  LiveBallEventDto,
  LiveBallEventInput,
  LiveMatchConditionsInput,
  LiveScoreStateDto,
  GalleryItemDto,
  MatchDto,
  MatchLiveSetupInput,
  MatchSquadDto,
  MatchSquadRole,
  MatchSquadSaveInput,
  Paginated,
  PlayerDto,
  ScoringSessionDto,
  ScorecardEditRequestDto,
  TeamDto,
} from '@/lib/api-types'
import { adminGet, adminPost, scorerUploadMatchPhoto } from '@/lib/admin-client'
import { ApiError, apiFetch } from '@/lib/api'
import { getSession } from '@/lib/session'
import { oversFieldToBalls } from '@/lib/cricket'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { resolveAdminMediaUrl } from '@/lib/media-url'
import {
  enqueueScoringBall,
  loadScoringOutbox,
  markScoringAttempt,
  removeScoringBall,
  saveScoringOutbox,
  type QueuedBallPayload,
  type ScoringOutboxEntry,
} from '@/lib/scoring-outbox'

export const Route = createFileRoute('/_shell/scoring/$matchId')({
  component: LiveScoringPage,
})

type ScoringTeam = {
  id: number
  name: string
}

type PlayerRoleMap = Record<number, MatchSquadRole | ''>

type BallSubmitPayload = QueuedBallPayload

type BowlerFigures = {
  playerId: number
  legalBalls: number
  maidens: number
  runs: number
  wickets: number
}

type EndOfOverSummary = {
  over: number
  battingTeamId: number
  runs: number
  wickets: number
  overRuns: number
  overWickets: number
  batters: Array<{ playerId: number | null; runs: number; balls: number }>
  bowlers: BowlerFigures[]
}

function newClientEventId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `ball-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`
}

function scoringDeviceId(): string {
  const key = 'npl:scorer:device-id:v1'
  try {
    // sessionStorage survives reloads but is isolated per tab, so two open
    // scoring screens cannot silently share one ownership lease.
    const current = globalThis.sessionStorage.getItem(key)
    if (current) return current
    const created = newClientEventId()
    globalThis.sessionStorage.setItem(key, created)
    return created
  } catch {
    return newClientEventId()
  }
}

function scoringDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Scoring device'
  const platform = navigator.platform || 'Browser'
  return `${platform} · ${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Web'}`
}

type WicketEnd = 'striker' | 'non_striker'
type WicketRunCredit = 'bat' | 'bye' | 'leg_bye'
type WicketDeliveryType = 'legal' | 'wide' | 'no_ball'
type ShortRunDelivery = 'bat' | 'wide' | 'no_ball_bat' | 'bye' | 'leg_bye' | 'no_ball_bye' | 'no_ball_leg_bye'

type EditingBallDraft = {
  eventId: number
  body: LiveBallEventInput
}

type UndoLastBallResult = {
  state: LiveScoreStateDto
  undoneEvent: LiveBallEventDto | null
}

type ScorerPanel =
  | 'score'
  | 'commentary'
  | 'photos'
  | 'setup'
  | 'squads'
  | 'balls'
  | 'corrections'
  | 'review'
  | 'help'

const EXTRAS_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'wide', label: 'Wide' },
  { value: 'no_ball', label: 'No ball' },
  { value: 'bye', label: 'Bye' },
  { value: 'leg_bye', label: 'Leg bye' },
  { value: 'no_ball_bye', label: 'No ball + byes' },
  { value: 'no_ball_leg_bye', label: 'No ball + leg byes' },
  { value: 'penalty', label: 'Penalty' },
] as const

const BOUNDARY_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'four', label: 'Four' },
  { value: 'six', label: 'Six' },
  { value: 'overthrow_boundary', label: 'Overthrow boundary' },
] as const

function eventToLiveBallInput(event: LiveBallEventDto): LiveBallEventInput {
  return {
    innings: event.innings,
    over_number: event.over_number,
    ball_number: event.ball_number,
    batting_team_id: event.batting_team_id,
    bowling_team_id: event.bowling_team_id,
    striker_player_id: event.striker_player_id,
    non_striker_player_id: event.non_striker_player_id,
    bowler_player_id: event.bowler_player_id,
    runs_batter: event.runs_batter,
    runs_extras: event.runs_extras,
    extras_type: event.extras_type,
    is_legal_delivery: event.is_legal_delivery,
    completed_runs: event.completed_runs,
    boundary_runs: event.boundary_runs,
    boundary_type: event.boundary_type,
    penalty_runs_batting: event.penalty_runs_batting,
    penalty_runs_fielding: event.penalty_runs_fielding,
    short_runs: event.short_runs,
    leg_bye_attempted: event.leg_bye_attempted,
    over_complete_override: event.over_complete_override,
    is_dead_ball: event.is_dead_ball,
    wicket_type: event.wicket_type,
    wicket_player_id: event.wicket_player_id,
    fielder_player_id: event.fielder_player_id,
    replacement_player_id: event.replacement_player_id,
    wicket_end: event.wicket_end,
    batters_crossed: event.batters_crossed,
    dismissal_text: event.dismissal_text,
    notes: event.notes,
  }
}

function withOverNote(existingNotes: string | null, overNote: string): string | null {
  const retainedNotes = (existingNotes ?? '')
    .split('\n')
    .filter((line) => !line.startsWith('Over note: '))
    .join('\n')
    .trim()
  const nextOverNote = overNote.trim()

  return [retainedNotes, nextOverNote ? `Over note: ${nextOverNote}` : '']
    .filter(Boolean)
    .join('\n') || null
}

type DismissalOption = {
  value: string
  label: string
  needsFielder: boolean
  fielderLabel?: string
}

const DISMISSAL_OPTIONS: DismissalOption[] = [
  { value: 'bowled', label: 'Bowled', needsFielder: false },
  { value: 'caught', label: 'Caught', needsFielder: true, fielderLabel: 'Catcher' },
  { value: 'caught_and_bowled', label: 'Caught & bowled', needsFielder: false },
  { value: 'lbw', label: 'LBW', needsFielder: false },
  { value: 'run_out', label: 'Run out', needsFielder: true, fielderLabel: 'Run out fielder' },
  { value: 'non_striker_left_early', label: 'Non-striker leaving early', needsFielder: true, fielderLabel: 'Run out fielder' },
  { value: 'stumped', label: 'Stumped', needsFielder: true, fielderLabel: 'Wicketkeeper' },
  { value: 'hit_wicket', label: 'Hit wicket', needsFielder: false },
  { value: 'retired_hurt', label: 'Retired hurt', needsFielder: false },
  { value: 'retired_out', label: 'Retired out', needsFielder: false },
  { value: 'retired_not_out', label: 'Retired not out', needsFielder: false },
  { value: 'hit_ball_twice', label: 'Hit the ball twice', needsFielder: false },
  { value: 'obstructing_field', label: 'Obstructing the field', needsFielder: false },
  { value: 'timed_out', label: 'Timed out', needsFielder: false },
]

const WIDE_DISMISSALS = new Set(['run_out', 'stumped', 'hit_wicket', 'obstructing_field'])
// MCC Law 21.17: after a no-ball, only run out, obstructing the field and
// hit the ball twice remain available. Hit wicket is not a valid dismissal.
const NO_BALL_DISMISSALS = new Set(['run_out', 'hit_ball_twice', 'obstructing_field'])
const COUNTED_WICKET_DISMISSALS = new Set([
  'bowled',
  'caught',
  'caught_and_bowled',
  'lbw',
  'run_out',
  'non_striker_left_early',
  'stumped',
  'hit_wicket',
  'retired_out',
  'hit_ball_twice',
  'obstructing_field',
  'timed_out',
])
const RETIREMENT_DISMISSALS = new Set(['retired_hurt', 'retired_out', 'retired_not_out'])

function dismissalCountsAsWicket(value: string | null | undefined): boolean {
  return Boolean(value && COUNTED_WICKET_DISMISSALS.has(value))
}

function dismissalOptionsForDelivery(delivery: WicketDeliveryType): DismissalOption[] {
  if (delivery === 'wide') {
    return DISMISSAL_OPTIONS.filter((option) => WIDE_DISMISSALS.has(option.value))
  }
  if (delivery === 'no_ball') {
    return DISMISSAL_OPTIONS.filter((option) => NO_BALL_DISMISSALS.has(option.value))
  }
  return DISMISSAL_OPTIONS
}

function adminAccessToken(): string | undefined {
  const session = getSession() as
    | { accessToken?: string; access_token?: string; token?: string }
    | null
    | undefined

  return session?.accessToken ?? session?.access_token ?? session?.token
}

async function adminDeleteJson<T>(path: string, headers?: HeadersInit): Promise<T> {
  return apiFetch<T>(path, {
    method: 'DELETE',
    accessToken: adminAccessToken(),
    headers,
  })
}

async function adminPutJson<T>(path: string, body: unknown, headers?: HeadersInit): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PUT',
    accessToken: adminAccessToken(),
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

async function publicListAll<T>(path: string): Promise<T[]> {
  const items: T[] = []
  let page = 1

  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    const res = await apiFetch<Paginated<T>>(
      `${path}${sep}page=${page}&page_size=100`,
    )

    items.push(...res.items)

    if (page >= res.pages) break
    page += 1
  }

  return items
}

function matchWhen(match: MatchDto): string {
  if (match.match_date) return match.match_date
  if (match.start_time) return String(match.start_time).slice(0, 16).replace('T', ' ')
  return '—'
}

function dateTimeLabel(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function wicketEventLabel(event: LiveBallEventDto, compact = false): string {
  if (!event.wicket_type) return ''

  if (event.extras_type === 'wide') {
    if (compact) return event.runs_extras === 1 ? 'W+Wd' : `W+${event.runs_extras}Wd`
    return event.runs_extras === 1 ? 'W + Wide' : `W + ${event.runs_extras} wides`
  }
  if (event.extras_type === 'no_ball') {
    if (compact) return event.runs_batter > 0 ? `W+${event.runs_batter}Nb` : 'W+Nb'
    return event.runs_batter > 0
      ? `W + No ball + ${event.runs_batter} batter run${event.runs_batter === 1 ? '' : 's'}`
      : 'W + No ball'
  }
  if (event.extras_type === 'no_ball_bye') {
    const byes = Math.max(0, event.runs_extras - 1)
    return compact ? `W+Nb+${byes}b` : `W + No ball + ${byes} bye${byes === 1 ? '' : 's'}`
  }
  if (event.extras_type === 'no_ball_leg_bye') {
    const legByes = Math.max(0, event.runs_extras - 1)
    return compact
      ? `W+Nb+${legByes}lb`
      : `W + No ball + ${legByes} leg bye${legByes === 1 ? '' : 's'}`
  }

  return 'W'
}

function liveEventLabel(event: LiveBallEventDto): string {
  if (event.is_dead_ball) {
    if (event.wicket_type === 'retired_hurt') return 'Retired hurt — no delivery'
    if (event.wicket_type === 'retired_not_out') return 'Retired not out — no delivery'
    if (event.wicket_type === 'retired_out') return 'Retired out — no delivery'
    if (event.penalty_runs_batting) return `Penalty +${event.penalty_runs_batting}`
    if (event.penalty_runs_fielding) return `Penalty fielding +${event.penalty_runs_fielding}`
    return 'Dead ball'
  }

  if (event.wicket_type) return wicketEventLabel(event)

  const extrasType = event.extras_type
  let label = ''

  if (!extrasType) {
    label = String(event.runs_batter)
  } else if (extrasType === 'wide') {
    label = event.runs_extras === 1 ? 'Wide' : `Wide ${event.runs_extras}`
  } else if (extrasType === 'no_ball') {
    label = event.runs_batter > 0
      ? `${event.runs_batter} + no ball`
      : 'No ball'
  } else if (extrasType === 'bye') {
    label = `Bye ${event.runs_extras}`
  } else if (extrasType === 'leg_bye') {
    label = `Leg bye ${event.runs_extras}`
  } else if (extrasType === 'no_ball_bye') {
    label = `No ball + bye ${Math.max(0, event.runs_extras - 1)}`
  } else if (extrasType === 'no_ball_leg_bye') {
    label = `No ball + leg bye ${Math.max(0, event.runs_extras - 1)}`
  } else if (extrasType === 'penalty') {
    label = event.penalty_runs_batting
      ? `Penalty +${event.penalty_runs_batting}`
      : `Penalty fielding +${event.penalty_runs_fielding}`
  } else {
    label = `${event.runs_extras} ${extrasType.split('_').join(' ')}`
  }

  if (event.boundary_type) label += ' · boundary'
  if (event.short_runs) label += ` · ${event.short_runs} short`
  return label
}


function eventRunsTotal(event: LiveBallEventDto): number {
  return (
    event.runs_batter +
    event.runs_extras +
    event.penalty_runs_batting +
    event.penalty_runs_fielding
  )
}

function bowlerRunsConceded(event: LiveBallEventDto): number {
  if (event.extras_type === 'wide') {
    // Every wide run, including completed runs and boundary wides, is charged
    // to the bowler (MCC Law 22.7).
    return event.runs_batter + event.runs_extras
  }
  if (event.extras_type === 'bye' || event.extras_type === 'leg_bye') {
    return event.runs_batter
  }
  if (event.extras_type === 'no_ball_bye' || event.extras_type === 'no_ball_leg_bye') {
    return event.runs_batter + Math.min(1, event.runs_extras)
  }
  return event.runs_batter + event.runs_extras
}

function countsAsBatterBall(event: LiveBallEventDto): boolean {
  if (event.is_dead_ball) return false
  return event.is_legal_delivery || [
    'no_ball',
    'no_ball_bye',
    'no_ball_leg_bye',
  ].includes(event.extras_type ?? '')
}

function creditsBowlerWicket(event: LiveBallEventDto): boolean {
  return Boolean(
    event.wicket_type &&
      ['bowled', 'caught', 'caught_and_bowled', 'lbw', 'stumped', 'hit_wicket'].includes(
        event.wicket_type,
      ),
  )
}

function oversLabel(legalBalls: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`
}

function eventClosesOver(
  event: Pick<LiveBallEventDto, 'is_dead_ball' | 'is_legal_delivery' | 'over_complete_override'>,
  legalBallsInOver: number,
): boolean {
  if (event.is_dead_ball) return false
  if (event.over_complete_override === true) return true
  if (!event.is_legal_delivery || event.over_complete_override === false) return false
  return legalBallsInOver === 6
}

function completedOverEventIds(events: LiveBallEventDto[], innings: number): Set<number> {
  const completedEventIds = new Set<number>()
  let legalBallsInOver = 0

  for (const event of events
    .filter((item) => item.innings === innings)
    .sort((a, b) => a.sequence_number - b.sequence_number || a.id - b.id)) {
    if (event.is_legal_delivery) legalBallsInOver += 1
    if (eventClosesOver(event, legalBallsInOver)) {
      completedEventIds.add(event.id)
      legalBallsInOver = 0
    }
  }

  return completedEventIds
}

function nextDeliveryPosition(events: LiveBallEventDto[], innings: number): { over: number; ball: number } {
  let over = 0
  let balls = 0
  for (const event of [...events]
    .filter((item) => item.innings === innings)
    .sort((a, b) => a.sequence_number - b.sequence_number || a.id - b.id)) {
    if (event.is_legal_delivery) balls += 1
    if (eventClosesOver(event, balls)) {
      over += 1
      balls = 0
    }
  }
  return { over, ball: balls + 1 }
}

function endOfOverSummary(
  allEvents: LiveBallEventDto[],
  completedEvent: LiveBallEventDto,
): EndOfOverSummary {
  const events = allEvents.some((event) => event.id === completedEvent.id)
    ? allEvents
    : [...allEvents, completedEvent]
  const inningsEvents = events.filter(
    (event) =>
      event.innings === completedEvent.innings &&
      event.sequence_number <= completedEvent.sequence_number,
  )
  const completedOverEvents = inningsEvents.filter(
    (event) => event.over_number === completedEvent.over_number,
  )
  const selection = selectionAfterEvent(completedEvent)
  const batterStats = (playerId: number | null) => {
    const playerEvents = playerId
      ? inningsEvents.filter((event) => event.striker_player_id === playerId)
      : []
    return {
      playerId,
      runs: playerEvents.reduce((total, event) => total + event.runs_batter, 0),
      balls: playerEvents.filter(countsAsBatterBall).length,
    }
  }
  const figuresForBowler = (playerId: number): BowlerFigures => {
    const bowlerEvents = inningsEvents.filter((event) => event.bowler_player_id === playerId)
    const overs = new Map<number, { legalBalls: number; runs: number }>()
    for (const event of bowlerEvents) {
      const current = overs.get(event.over_number) ?? { legalBalls: 0, runs: 0 }
      current.legalBalls += event.is_legal_delivery && !event.is_dead_ball ? 1 : 0
      current.runs += bowlerRunsConceded(event)
      overs.set(event.over_number, current)
    }
    return {
      playerId,
      legalBalls: bowlerEvents.filter((event) => event.is_legal_delivery && !event.is_dead_ball)
        .length,
      maidens: [...overs.values()].filter(
        (over) => over.legalBalls === 6 && over.runs === 0,
      ).length,
      runs: bowlerEvents.reduce((total, event) => total + bowlerRunsConceded(event), 0),
      wickets: bowlerEvents.filter(creditsBowlerWicket).length,
    }
  }
  const lastTwoBowlerIds = [...inningsEvents]
    .filter((event) => event.is_legal_delivery && !event.is_dead_ball)
    .sort((a, b) => b.over_number - a.over_number || b.sequence_number - a.sequence_number)
    .reduce<number[]>((ids, event) => (
      ids.includes(event.bowler_player_id) || ids.length >= 2
        ? ids
        : [...ids, event.bowler_player_id]
    ), [])

  return {
    over: completedEvent.over_number + 1,
    battingTeamId: completedEvent.batting_team_id,
    runs: inningsEvents.reduce(
      (total, event) => total + event.runs_batter + event.runs_extras + event.penalty_runs_batting,
      0,
    ),
    wickets: inningsEvents.filter(
      (event) => event.wicket_type && !['retired_hurt', 'retired_not_out'].includes(event.wicket_type),
    ).length,
    overRuns: completedOverEvents.reduce(
      (total, event) => total + event.runs_batter + event.runs_extras + event.penalty_runs_batting,
      0,
    ),
    overWickets: completedOverEvents.filter(
      (event) => event.wicket_type && !['retired_hurt', 'retired_not_out'].includes(event.wicket_type),
    ).length,
    batters: [
      batterStats(selection.strikerPlayerId),
      batterStats(selection.nonStrikerPlayerId),
    ],
    bowlers: lastTwoBowlerIds.map(figuresForBowler),
  }
}

function liveEventChipLabel(event: LiveBallEventDto): string {
  if (event.is_dead_ball) {
    if (event.wicket_type === 'retired_hurt') return 'RH'
    if (event.wicket_type === 'retired_not_out') return 'RNO'
    if (event.wicket_type === 'retired_out') return 'RO'
    if (event.penalty_runs_batting || event.penalty_runs_fielding) return '+5'
    return 'DB'
  }
  if (event.wicket_type) return wicketEventLabel(event, true)
  if (event.extras_type === 'wide') {
    return event.runs_extras === 1 ? 'Wd' : `${event.runs_extras}Wd`
  }
  if (event.extras_type === 'no_ball') {
    return event.runs_batter > 0 ? `${event.runs_batter}Nb` : 'Nb'
  }
  if (event.extras_type === 'bye') return `${event.runs_extras}b`
  if (event.extras_type === 'leg_bye') return `${event.runs_extras}lb`
  if (event.extras_type === 'no_ball_bye') return `Nb+${Math.max(0, event.runs_extras - 1)}b`
  if (event.extras_type === 'no_ball_leg_bye') return `Nb+${Math.max(0, event.runs_extras - 1)}lb`
  return event.runs_batter === 0 ? '•' : String(event.runs_batter)
}

function liveEventChipClass(event: LiveBallEventDto): string {
  const baseClass = 'live-scorer-ball-chip'
  if (event.wicket_type) return `${baseClass} ${baseClass}--wicket`
  if (event.boundary_type === 'six' || event.boundary_runs === 6) {
    return `${baseClass} ${baseClass}--six`
  }
  if (event.boundary_type === 'four' || event.boundary_runs === 4) {
    return `${baseClass} ${baseClass}--four`
  }
  return baseClass
}

function playerName(playerById: Map<number, PlayerDto>, playerId: number | null | undefined): string {
  if (!playerId) return '—'
  return playerById.get(playerId)?.full_name ?? `#${playerId}`
}

function dismissalLabel(value: string | null | undefined): string {
  if (!value) return ''
  return DISMISSAL_OPTIONS.find((item) => item.value === value)?.label ?? value.split('_').join(' ')
}

function selectionAfterEvent(event: LiveBallEventDto) {
  let strikerPlayerId: number | null = event.striker_player_id
  let nonStrikerPlayerId: number | null = event.non_striker_player_id

  if (event.wicket_type && event.replacement_player_id) {
    if (event.wicket_player_id === strikerPlayerId) {
      strikerPlayerId = event.replacement_player_id
    } else if (event.wicket_player_id === nonStrikerPlayerId) {
      nonStrikerPlayerId = event.replacement_player_id
    }
  }

  const changedEnds = (event.completed_runs ?? 0) % 2 === 1
  const overEnded = !event.is_dead_ball && (
    event.over_complete_override === true ||
    (event.is_legal_delivery && event.over_complete_override !== false && event.ball_number === 6)
  )
  if (changedEnds !== overEnded && strikerPlayerId && nonStrikerPlayerId) {
    const previousStriker = strikerPlayerId
    strikerPlayerId = nonStrikerPlayerId
    nonStrikerPlayerId = previousStriker
  }

  return {
    strikerPlayerId,
    nonStrikerPlayerId,
    bowlerPlayerId: event.bowler_player_id,
  }
}

function appendOptimisticBall(
  state: LiveScoreStateDto,
  payload: BallSubmitPayload,
  ordinal: number,
): LiveScoreStateDto {
  const body = payload.body
  const clientEventId = body.client_event_id ?? null
  if (
    clientEventId &&
    state.events.some((event) => event.client_event_id === clientEventId)
  ) {
    return state
  }

  const now = new Date().toISOString()
  const event: LiveBallEventDto = {
    id: -(Date.now() + ordinal + 1),
    match_id: state.match_id,
    innings: body.innings,
    over_number: body.over_number,
    ball_number: body.ball_number,
    batting_team_id: body.batting_team_id,
    bowling_team_id: body.bowling_team_id,
    striker_player_id: body.striker_player_id,
    non_striker_player_id: body.non_striker_player_id ?? null,
    bowler_player_id: body.bowler_player_id,
    runs_batter: body.runs_batter ?? 0,
    runs_extras: body.runs_extras ?? 0,
    extras_type: body.extras_type ?? null,
    is_legal_delivery: body.is_legal_delivery ?? true,
    completed_runs: body.completed_runs ?? body.runs_batter ?? 0,
    boundary_runs: body.boundary_runs ?? 0,
    boundary_type: body.boundary_type ?? null,
    penalty_runs_batting: body.penalty_runs_batting ?? 0,
    penalty_runs_fielding: body.penalty_runs_fielding ?? 0,
    short_runs: body.short_runs ?? 0,
    leg_bye_attempted: body.leg_bye_attempted ?? false,
    over_complete_override: body.over_complete_override ?? null,
    is_dead_ball: body.is_dead_ball ?? false,
    wicket_type: body.wicket_type ?? null,
    wicket_player_id: body.wicket_player_id ?? null,
    fielder_player_id: body.fielder_player_id ?? null,
    replacement_player_id: body.replacement_player_id ?? null,
    wicket_end: body.wicket_end ?? null,
    batters_crossed: body.batters_crossed ?? false,
    dismissal_text: body.dismissal_text ?? null,
    notes: body.notes ?? null,
    client_event_id: clientEventId,
    sequence_number:
      Math.max(0, ...state.events.map((candidate) => candidate.sequence_number)) + 1,
    created_by_user_id: null,
    created_at: now,
    updated_at: now,
    score_version: null,
  }
  const events = [...state.events, event]
  const existingSummary = state.summaries.find(
    (summary) => summary.innings === event.innings,
  )
  const legalBalls =
    (existingSummary?.legal_balls ?? 0) + (event.is_legal_delivery ? 1 : 0)
  const runs =
    (existingSummary?.runs ?? 0) +
    event.runs_batter +
    event.runs_extras +
    event.penalty_runs_batting
  const wickets =
    (existingSummary?.wickets ?? 0) +
    (dismissalCountsAsWicket(event.wicket_type) ? 1 : 0)
  const next = nextDeliveryPosition(events, event.innings)
  const summary = {
    innings: event.innings,
    batting_team_id: event.batting_team_id,
    bowling_team_id: event.bowling_team_id,
    runs,
    wickets,
    legal_balls: legalBalls,
    overs_label: next.ball === 1 ? `${next.over}.0` : `${next.over}.${next.ball - 1}`,
    last_six: [...(existingSummary?.last_six ?? []), liveEventLabel(event)].slice(-6),
    last_event: event,
  }
  const summaries = existingSummary
    ? state.summaries.map((candidate) =>
        candidate.innings === event.innings ? summary : candidate,
      )
    : [...state.summaries, summary].sort((a, b) => a.innings - b.innings)

  return {
    ...state,
    status: state.status === 'completed' ? state.status : 'live',
    current_innings: event.innings,
    events,
    summaries,
  }
}

function suggestedDismissal(
  wicketType: string,
  bowlerName: string,
  fielderName: string,
): string {
  if (wicketType === 'bowled') return `b ${bowlerName}`
  if (wicketType === 'caught') return `c ${fielderName || 'fielder'} b ${bowlerName}`
  if (wicketType === 'caught_and_bowled') return `c & b ${bowlerName}`
  if (wicketType === 'lbw') return `lbw b ${bowlerName}`
  if (wicketType === 'run_out') return fielderName ? `run out (${fielderName})` : 'run out'
  if (wicketType === 'non_striker_left_early') {
    return fielderName
      ? `run out (${fielderName}), non-striker left early`
      : 'run out, non-striker left early'
  }
  if (wicketType === 'stumped') return `st ${fielderName || 'wicketkeeper'} b ${bowlerName}`
  if (wicketType === 'hit_wicket') return `hit wicket b ${bowlerName}`
  if (wicketType === 'retired_hurt') return 'retired hurt'
  if (wicketType === 'retired_not_out') return 'retired not out'
  if (wicketType === 'retired_out') return 'retired out'
  if (wicketType === 'hit_ball_twice') return 'hit the ball twice'
  if (wicketType === 'obstructing_field') return 'obstructing the field'
  if (wicketType === 'timed_out') return 'timed out'
  return dismissalLabel(wicketType)
}

function selectedRoleCount(players: PlayerDto[], roles: PlayerRoleMap, role: MatchSquadRole): number {
  return players.filter((player) => roles[player.id] === role).length
}

type LiveBatterScorecardRow = {
  playerId: number
  runs: number
  balls: number
  fours: number
  sixes: number
  dismissal: string
}

type LiveBowlerScorecardRow = {
  playerId: number
  legalBalls: number
  runs: number
  wickets: number
  dots: number
  wides: number
  noBalls: number
}

function liveInningsScorecard(events: LiveBallEventDto[]) {
  const batterRows = new Map<number, LiveBatterScorecardRow>()
  const bowlerRows = new Map<number, LiveBowlerScorecardRow>()
  const bowlerWickets = new Set([
    'bowled',
    'caught',
    'caught_and_bowled',
    'lbw',
    'stumped',
    'hit_wicket',
  ])

  for (const event of events) {
    const batter = batterRows.get(event.striker_player_id) ?? {
      playerId: event.striker_player_id,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      dismissal: 'not out',
    }
    batter.runs += event.runs_batter
    if (event.is_legal_delivery && event.extras_type !== 'wide') batter.balls += 1
    if (event.boundary_type === 'four' || event.runs_batter === 4) batter.fours += 1
    if (event.boundary_type === 'six' || event.runs_batter === 6) batter.sixes += 1
    batterRows.set(batter.playerId, batter)

    if (event.non_striker_player_id && !batterRows.has(event.non_striker_player_id)) {
      batterRows.set(event.non_striker_player_id, {
        playerId: event.non_striker_player_id,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        dismissal: 'not out',
      })
    }

    if (event.wicket_player_id) {
      const dismissed = batterRows.get(event.wicket_player_id) ?? {
        playerId: event.wicket_player_id,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        dismissal: 'not out',
      }
      dismissed.dismissal = event.dismissal_text?.trim() || dismissalLabel(event.wicket_type)
      batterRows.set(dismissed.playerId, dismissed)
    }

    const bowler = bowlerRows.get(event.bowler_player_id) ?? {
      playerId: event.bowler_player_id,
      legalBalls: 0,
      runs: 0,
      wickets: 0,
      dots: 0,
      wides: 0,
      noBalls: 0,
    }
    if (event.is_legal_delivery) bowler.legalBalls += 1
    const isBye = event.extras_type === 'bye' || event.extras_type === 'leg_bye'
    bowler.runs += event.runs_batter + (isBye ? 0 : event.runs_extras)
    if (event.is_legal_delivery && event.runs_batter + event.runs_extras === 0) bowler.dots += 1
    if (event.extras_type === 'wide') bowler.wides += event.runs_extras
    if (event.extras_type?.startsWith('no_ball')) bowler.noBalls += 1
    if (event.wicket_type && bowlerWickets.has(event.wicket_type)) bowler.wickets += 1
    bowlerRows.set(bowler.playerId, bowler)
  }

  return {
    batters: Array.from(batterRows.values()),
    bowlers: Array.from(bowlerRows.values()),
  }
}

function liveExtrasBreakdown(events: LiveBallEventDto[]) {
  return events.reduce(
    (totals, event) => {
      if (event.extras_type === 'wide') totals.wides += event.runs_extras
      if (event.extras_type?.startsWith('no_ball')) {
        totals.noBalls += 1
      }
      if (event.extras_type === 'bye') totals.byes += event.runs_extras
      if (event.extras_type === 'no_ball_bye') {
        totals.byes += Math.max(0, event.runs_extras - 1)
      }
      if (event.extras_type === 'leg_bye') totals.legByes += event.runs_extras
      if (event.extras_type === 'no_ball_leg_bye') {
        totals.legByes += Math.max(0, event.runs_extras - 1)
      }
      totals.penalties += event.penalty_runs_batting + event.penalty_runs_fielding
      totals.total += event.runs_extras + event.penalty_runs_batting + event.penalty_runs_fielding
      return totals
    },
    { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
  )
}

function livePartnership(events: LiveBallEventDto[]) {
  const lastWicketIndex = events.reduce(
    (index, event, eventIndex) =>
      dismissalCountsAsWicket(event.wicket_type) ? eventIndex : index,
    -1,
  )
  const partnershipEvents = events.slice(lastWicketIndex + 1)
  return {
    runs: partnershipEvents.reduce(
      (total, event) => total + eventRunsTotal(event),
      0,
    ),
    balls: partnershipEvents.filter(
      (event) => event.is_legal_delivery && !event.is_dead_ball,
    ).length,
    fours: partnershipEvents.filter(
      (event) => event.boundary_type === 'four' || event.runs_batter === 4,
    ).length,
    sixes: partnershipEvents.filter(
      (event) => event.boundary_type === 'six' || event.runs_batter === 6,
    ).length,
  }
}

function liveBowlerMaidens(events: LiveBallEventDto[], playerId: number | ''): number {
  if (!playerId) return 0
  const overs = new Map<number, { legalBalls: number; runs: number }>()
  for (const event of events.filter((item) => item.bowler_player_id === playerId)) {
    const over = overs.get(event.over_number) ?? { legalBalls: 0, runs: 0 }
    if (event.is_legal_delivery && !event.is_dead_ball) over.legalBalls += 1
    over.runs += bowlerRunsConceded(event)
    overs.set(event.over_number, over)
  }
  return [...overs.values()].filter((over) => over.legalBalls === 6 && over.runs === 0).length
}

function liveFallOfWickets(events: LiveBallEventDto[]): Array<{
  wicket: number
  runs: number
  over: string
  playerId: number | null
}> {
  let runs = 0
  let wicket = 0
  const rows: Array<{ wicket: number; runs: number; over: string; playerId: number | null }> = []

  for (const event of events) {
    runs += event.runs_batter + event.runs_extras + event.penalty_runs_batting
    if (!dismissalCountsAsWicket(event.wicket_type)) continue
    wicket += 1
    rows.push({
      wicket,
      runs,
      over: `${event.over_number}.${event.ball_number}`,
      playerId: event.wicket_player_id,
    })
  }

  return rows
}

function LiveScoringPage() {
  const { matchId } = Route.useParams()
  const mid = Number(matchId)
  const queryClient = useQueryClient()
  const currentSession = getSession() as { role?: string } | null | undefined
  const canResetTestMatch = currentSession?.role === 'super_admin'
  const isScorer = currentSession?.role === 'scorer'
  const isCommentator = currentSession?.role === 'commentator'
  const deviceId = useMemo(() => scoringDeviceId(), [])
  const deviceLabel = useMemo(() => scoringDeviceLabel(), [])
  const [deliveryOutbox, setDeliveryOutbox] = useState<ScoringOutboxEntry[]>(
    () => loadScoringOutbox(mid),
  )
  const outboxRef = useRef(deliveryOutbox)

  useEffect(() => {
    const next = loadScoringOutbox(mid)
    outboxRef.current = next
    setDeliveryOutbox(next)
  }, [mid])

  useEffect(() => {
    outboxRef.current = deliveryOutbox
    saveScoringOutbox(mid, deliveryOutbox)
  }, [deliveryOutbox, mid])

  const matchesQ = useQuery({
    queryKey: ['admin', 'scorer', 'matches'],
    queryFn: () => adminGet<MatchDto[]>('/admin/scorer/matches'),
    refetchInterval: 15000,
    retry: 1,
  })

  const match = useMemo(
    () => (matchesQ.data ?? []).find((row) => row.id === mid) ?? null,
    [matchesQ.data, mid],
  )
  const currentMatchId = match?.id
  const currentHomeTeamId = match?.home_team_id
  const currentAwayTeamId = match?.away_team_id

  const liveQ = useQuery({
    queryKey: ['admin', 'matches', mid, 'live'],
    queryFn: () => adminGet<LiveScoreStateDto>(`/admin/matches/${mid}/live`),
    enabled: Number.isFinite(mid),
    refetchInterval: () => (outboxRef.current.length > 0 ? false : 10000),
    retry: 1,
  })

  const scoringSessionQ = useQuery({
    queryKey: ['admin', 'matches', mid, 'scoring-session', deviceId],
    queryFn: () =>
      adminPost<ScoringSessionDto>(`/admin/matches/${mid}/live/session`, {
        device_id: deviceId,
        device_label: deviceLabel,
      }),
    enabled: Number.isFinite(mid) && !isCommentator,
    refetchInterval: 30000,
    retry: false,
  })

  const squadQ = useQuery({
    queryKey: ['admin', 'matches', mid, 'squads'],
    queryFn: () => adminGet<MatchSquadDto>(`/admin/matches/${mid}/squads`),
    enabled: Number.isFinite(mid) && Boolean(match),
    retry: 1,
  })

  const matchPhotosQ = useQuery({
    queryKey: ['public', 'gallery', 'match', mid],
    queryFn: () =>
      adminGet<Paginated<GalleryItemDto>>(
        `/public/gallery?page=1&page_size=100&match_id=${mid}`,
      ),
    enabled: Number.isFinite(mid) && Boolean(match),
    retry: 1,
  })

  const teamsQ = useQuery({
    queryKey: ['public', 'teams', 'all-for-live-scoring'],
    queryFn: () => publicListAll<TeamDto>('/public/teams?include_inactive=true'),
    retry: 1,
  })

  const playersQ = useQuery({
    queryKey: ['public', 'players', 'match-scoring', match?.home_team_id, match?.away_team_id],
    queryFn: async () => {
      if (!match) return []
      const homePlayers = await publicListAll<PlayerDto>(
        `/public/players?team_id=${match.home_team_id}&include_inactive=true`,
      )
      const awayPlayers = await publicListAll<PlayerDto>(
        `/public/players?team_id=${match.away_team_id}&include_inactive=true`,
      )
      return [...homePlayers, ...awayPlayers]
    },
    enabled: Boolean(match),
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

  const [innings, setInnings] = useState(1)
  const [battingTeamId, setBattingTeamId] = useState<number | ''>('')
  const [bowlingTeamId, setBowlingTeamId] = useState<number | ''>('')
  const [strikerPlayerId, setStrikerPlayerId] = useState<number | ''>('')
  const [nonStrikerPlayerId, setNonStrikerPlayerId] = useState<number | ''>('')
  const [bowlerPlayerId, setBowlerPlayerId] = useState<number | ''>('')
  const [notes, setNotes] = useState('')
  const [overNote, setOverNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [playerRoles, setPlayerRoles] = useState<PlayerRoleMap>({})
  const [squadDirty, setSquadDirty] = useState(false)
  const [wicketOpen, setWicketOpen] = useState(false)
  const [wicketDeliveryType, setWicketDeliveryType] = useState<WicketDeliveryType>('legal')
  const [wicketType, setWicketType] = useState('caught')
  const [wicketPlayerId, setWicketPlayerId] = useState<number | ''>('')
  const [fielderPlayerId, setFielderPlayerId] = useState<number | ''>('')
  const [newBatterPlayerId, setNewBatterPlayerId] = useState<number | ''>('')
  const [wicketEnd, setWicketEnd] = useState<WicketEnd>('striker')
  const [wicketRunsCompleted, setWicketRunsCompleted] = useState(0)
  const [wicketRunCredit, setWicketRunCredit] = useState<WicketRunCredit>('bat')
  const [battersCrossed, setBattersCrossed] = useState(false)
  const [dismissalText, setDismissalText] = useState('')
  const [dismissalTextTouched, setDismissalTextTouched] = useState(false)
  const [tossWinnerTeamId, setTossWinnerTeamId] = useState<number | ''>('')
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl'>('bat')
  const [battingFirstTeamId, setBattingFirstTeamId] = useState<number | ''>('')
  const [umpire1, setUmpire1] = useState('')
  const [umpire2, setUmpire2] = useState('')
  const [reserveUmpire, setReserveUmpire] = useState('')
  const [matchOvers, setMatchOvers] = useState('40.0')
  const [revisedMatchOvers, setRevisedMatchOvers] = useState('40.0')
  const [conditionsDirty, setConditionsDirty] = useState(false)
  const [conditionsOpen, setConditionsOpen] = useState(false)
  const [editingBall, setEditingBall] = useState<EditingBallDraft | null>(null)
  const [editBallError, setEditBallError] = useState<string | null>(null)
  const [activeScorerPanel, setActiveScorerPanel] = useState<ScorerPanel>(() =>
    isCommentator ? 'commentary' : 'score',
  )
  const [commentaryEventId, setCommentaryEventId] = useState<number | null>(null)
  const [commentaryDraft, setCommentaryDraft] = useState('')
  const [photoTitle, setPhotoTitle] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [correctionSearch, setCorrectionSearch] = useState('')
  const [extrasOpen, setExtrasOpen] = useState(false)
  const [shortRunCompleted, setShortRunCompleted] = useState(2)
  const [shortRunScored, setShortRunScored] = useState(1)
  const [shortRunDelivery, setShortRunDelivery] = useState<ShortRunDelivery>('bat')
  const [umpireEndOverAfterNextBall, setUmpireEndOverAfterNextBall] = useState(false)
  const [umpireContinueOverAfterNextBall, setUmpireContinueOverAfterNextBall] = useState(false)
  const [umpireReplacementInOver, setUmpireReplacementInOver] = useState(false)
  const [overControlsOpen, setOverControlsOpen] = useState(true)
  const [playerControlsOpen, setPlayerControlsOpen] = useState(false)
  const [finalReviewConfirmed, setFinalReviewConfirmed] = useState(false)
  const [bowlerChangeOpen, setBowlerChangeOpen] = useState(false)
  const [completedOverSummary, setCompletedOverSummary] = useState<EndOfOverSummary | null>(null)
  const [previousBowlerPlayerId, setPreviousBowlerPlayerId] = useState<number | null>(null)
  const [nextBowlerPlayerId, setNextBowlerPlayerId] = useState<number | ''>('')
  const [matchOverOpen, setMatchOverOpen] = useState(false)
  const [inningsOverOpen, setInningsOverOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [outboxFlushing, setOutboxFlushing] = useState(false)
  const outboxFlushingRef = useRef(false)
  const [requestEditOpen, setRequestEditOpen] = useState(false)
  const [requestEditReason, setRequestEditReason] = useState('')
  const selectionContextRef = useRef('')
  const lastHydratedEventKeyRef = useRef('')
  const hasHydratedInningsRef = useRef(false)
  const reconciliationAttemptedVersionRef = useRef<number | null>(null)

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine)
    globalThis.addEventListener('online', updateOnlineState)
    globalThis.addEventListener('offline', updateOnlineState)
    return () => {
      globalThis.removeEventListener('online', updateOnlineState)
      globalThis.removeEventListener('offline', updateOnlineState)
    }
  }, [])

  useEffect(() => {
    if (!liveQ.data || deliveryOutbox.length === 0) return
    queryClient.setQueryData<LiveScoreStateDto>(
      ['admin', 'matches', mid, 'live'],
      (current) =>
        deliveryOutbox.reduce(
          (state, entry, index) => appendOptimisticBall(state, entry.payload, index),
          current ?? liveQ.data,
        ),
    )
  }, [deliveryOutbox, liveQ.data, mid, queryClient])

  const scoringWriteHeaders = (version?: number): HeadersInit => {
    if (outboxRef.current.length > 0) {
      throw new Error(
        'Sync the queued deliveries before changing setup, conditions, corrections, or match status.',
      )
    }
    const token = scoringSessionQ.data?.session_token
    if (!token) {
      throw new Error('This device does not own the scoring session yet.')
    }
    return {
      'X-Score-Version': String(version ?? liveQ.data?.scoring_version ?? 0),
      'X-Scoring-Session': token,
    }
  }

  const matchTeams = useMemo<ScoringTeam[]>(() => {
    if (!match) return []
    return [
      {
        id: match.home_team_id,
        name: teamById.get(match.home_team_id)?.name ?? `Team ${match.home_team_id}`,
      },
      {
        id: match.away_team_id,
        name: teamById.get(match.away_team_id)?.name ?? `Team ${match.away_team_id}`,
      },
    ]
  }, [match, teamById])

  useEffect(() => {
    if (!match || matchTeams.length < 2) return
    if (!tossWinnerTeamId) setTossWinnerTeamId(match.home_team_id)
    if (!battingFirstTeamId) setBattingFirstTeamId(match.home_team_id)
    if (match.match_overs != null && String(match.match_overs).trim() !== '') {
      setMatchOvers(String(match.match_overs))
    }
    if (!conditionsDirty) {
      const currentOvers = liveQ.data?.match_overs ?? match.match_overs
      if (currentOvers != null) setRevisedMatchOvers(String(currentOvers))
    }
  }, [
    battingFirstTeamId,
    conditionsDirty,
    liveQ.data?.match_overs,
    match,
    matchTeams.length,
    tossWinnerTeamId,
  ])

  useEffect(() => {
    if (!tossWinnerTeamId || matchTeams.length < 2) return
    const otherTeamId = matchTeams.find((team) => team.id !== tossWinnerTeamId)?.id
    if (!otherTeamId) return
    setBattingFirstTeamId(tossDecision === 'bat' ? tossWinnerTeamId : otherTeamId)
  }, [matchTeams, tossDecision, tossWinnerTeamId])

  useEffect(() => {
    if (!match?.umpires) return
    const parts = match.umpires.split(',').map((part) => part.trim())
    setUmpire1((current) => current || parts[0] || '')
    setUmpire2((current) => current || parts[1] || '')
    setReserveUmpire((current) => current || parts[2] || '')
  }, [match?.umpires])

  useEffect(() => {
    if (!match?.toss_info || !matchTeams.length) return
    const lower = match.toss_info.toLowerCase()
    const tossTeam = matchTeams.find((team) => lower.includes(team.name.toLowerCase()))
    const battingTeam = matchTeams.find((team) => lower.includes(`${team.name.toLowerCase()} batting first`))
    if (tossTeam) setTossWinnerTeamId((current) => current || tossTeam.id)
    if (lower.includes('bowl first')) setTossDecision('bowl')
    if (lower.includes('bat first')) setTossDecision('bat')
    if (battingTeam) setBattingFirstTeamId((current) => current || battingTeam.id)
  }, [match?.toss_info, matchTeams])

  useEffect(() => {
    if (!squadQ.data || squadDirty) return

    const next: PlayerRoleMap = {}
    for (const team of squadQ.data.teams) {
      for (const player of team.players) {
        next[player.player_id] = player.role
      }
    }
    setPlayerRoles(next)
  }, [squadDirty, squadQ.data])

  useEffect(() => {
    if (!currentMatchId || !currentHomeTeamId || !currentAwayTeamId) return

    const recordedFirstInningsEvent = (liveQ.data?.events ?? []).find(
      (event) => event.innings === 1,
    )
    const firstBattingTeamId =
      recordedFirstInningsEvent?.batting_team_id ?? (battingFirstTeamId || currentHomeTeamId)
    const firstBowlingTeamId =
      recordedFirstInningsEvent?.bowling_team_id ??
      (firstBattingTeamId === currentHomeTeamId ? currentAwayTeamId : currentHomeTeamId)
    const latestRecordedEvent = [...(liveQ.data?.events ?? [])]
      .filter((event) => event.innings === innings)
      .sort((a, b) => b.sequence_number - a.sequence_number || b.id - a.id)[0]
    const nextBattingTeamId = latestRecordedEvent?.batting_team_id ??
      (innings === 1 ? firstBattingTeamId : firstBowlingTeamId)
    const nextBowlingTeamId = latestRecordedEvent?.bowling_team_id ??
      (innings === 1 ? firstBowlingTeamId : firstBattingTeamId)
    const selectionContext = `${currentMatchId}:${innings}:${nextBattingTeamId}:${nextBowlingTeamId}`

    if (selectionContextRef.current === selectionContext) return
    selectionContextRef.current = selectionContext
    lastHydratedEventKeyRef.current = ''
    setBattingTeamId(nextBattingTeamId)
    setBowlingTeamId(nextBowlingTeamId)
    if (latestRecordedEvent) return
    setStrikerPlayerId('')
    setNonStrikerPlayerId('')
    setBowlerPlayerId('')
    setWicketPlayerId('')
    setFielderPlayerId('')
    setNewBatterPlayerId('')
  }, [
    battingFirstTeamId,
    currentAwayTeamId,
    currentHomeTeamId,
    currentMatchId,
    innings,
    liveQ.data?.events,
  ])

  useEffect(() => {
    if (hasHydratedInningsRef.current || liveQ.data?.current_innings == null) return
    hasHydratedInningsRef.current = true
    setInnings(liveQ.data.current_innings)
  }, [liveQ.data?.current_innings])

  const teamHasSavedSquad = useMemo(() => {
    const result = new Map<number, boolean>()
    for (const team of matchTeams) {
      result.set(
        team.id,
        (playersQ.data ?? []).some(
          (player) => player.team_id === team.id && Boolean(playerRoles[player.id]),
        ),
      )
    }
    return result
  }, [matchTeams, playerRoles, playersQ.data])

  const playersForTeam = (teamId: number | '') => {
    if (!teamId) return []
    return (playersQ.data ?? []).filter((player) => player.team_id === teamId)
  }

  const scoringPlayersForTeam = (teamId: number | '') => {
    const players = playersForTeam(teamId)
    if (!teamId || !teamHasSavedSquad.get(teamId)) return players
    return players.filter((player) => {
      const role = playerRoles[player.id]
      return role === 'playing_xi' || role === 'concussion_substitute'
    })
  }

  const fieldingPlayersForTeam = (teamId: number | '') => {
    const players = playersForTeam(teamId)
    if (!teamId || !teamHasSavedSquad.get(teamId)) return players
    return players.filter((player) => Boolean(playerRoles[player.id]))
  }

  const battingPlayers = useMemo(
    () => scoringPlayersForTeam(battingTeamId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [battingTeamId, playersQ.data, playerRoles, teamHasSavedSquad],
  )

  const bowlingPlayers = useMemo(
    () => scoringPlayersForTeam(bowlingTeamId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bowlingTeamId, playersQ.data, playerRoles, teamHasSavedSquad],
  )

  const fieldingPlayers = useMemo(
    () => fieldingPlayersForTeam(bowlingTeamId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bowlingTeamId, playersQ.data, playerRoles, teamHasSavedSquad],
  )

  const dismissedBatterIds = useMemo(() => {
    const dismissed = new Set<number>()
    for (const event of liveQ.data?.events ?? []) {
      if (
        event.innings === innings &&
        event.wicket_player_id &&
        dismissalCountsAsWicket(event.wicket_type)
      ) {
        dismissed.add(event.wicket_player_id)
      }
    }
    return dismissed
  }, [innings, liveQ.data?.events])

  const eligibleWicketPlayers = useMemo(
    () => battingPlayers.filter((player) => !dismissedBatterIds.has(player.id)),
    [battingPlayers, dismissedBatterIds],
  )

  const availableNewBatters = useMemo(
    () =>
      eligibleWicketPlayers.filter(
        (player) =>
          player.id !== strikerPlayerId &&
          player.id !== nonStrikerPlayerId &&
          player.id !== wicketPlayerId,
      ),
    [eligibleWicketPlayers, nonStrikerPlayerId, strikerPlayerId, wicketPlayerId],
  )

  useEffect(() => {
    if (!strikerPlayerId && battingPlayers[0]) {
      setStrikerPlayerId(battingPlayers[0].id)
    }
    if (!nonStrikerPlayerId && battingPlayers[1]) {
      setNonStrikerPlayerId(battingPlayers[1].id)
    }
    if (!wicketPlayerId && eligibleWicketPlayers[0]) {
      setWicketPlayerId(eligibleWicketPlayers[0].id)
    }
  }, [
    battingPlayers,
    eligibleWicketPlayers,
    nonStrikerPlayerId,
    strikerPlayerId,
    wicketPlayerId,
  ])

  useEffect(() => {
    if (!bowlerPlayerId && bowlingPlayers[0]) {
      setBowlerPlayerId(bowlingPlayers[0].id)
    }
    if (!fielderPlayerId && fieldingPlayers[0]) {
      setFielderPlayerId(fieldingPlayers[0].id)
    }
  }, [bowlerPlayerId, bowlingPlayers, fieldingPlayers, fielderPlayerId])

  const currentSummary = useMemo(
    () => liveQ.data?.summaries.find((summary) => summary.innings === innings) ?? null,
    [innings, liveQ.data?.summaries],
  )
  const firstInningsSummary = useMemo(
    () => liveQ.data?.summaries.find((summary) => summary.innings === 1) ?? null,
    [liveQ.data?.summaries],
  )
  const secondInningsSummary = useMemo(
    () => liveQ.data?.summaries.find((summary) => summary.innings === 2) ?? null,
    [liveQ.data?.summaries],
  )
  const legalBalls = currentSummary?.legal_balls ?? 0
  const nextDelivery = nextDeliveryPosition(liveQ.data?.events ?? [], innings)
  const nextOverNumber = nextDelivery.over
  const nextBallNumber = nextDelivery.ball
  const currentOverDeliveryEvents = (liveQ.data?.events ?? [])
    .filter(
      (event) =>
        event.innings === innings &&
        event.over_number === nextOverNumber &&
        !event.is_dead_ball,
    )
    .sort((a, b) => a.sequence_number - b.sequence_number || a.id - b.id)
  const currentOverLegalEvents = currentOverDeliveryEvents.filter(
    (event) => event.is_legal_delivery,
  )
  const lastDeliveryInCurrentOver = currentOverDeliveryEvents.at(-1) ?? null
  const chaseTarget =
    liveQ.data?.revised_target_runs ??
    (firstInningsSummary ? firstInningsSummary.runs + 1 : null)
  const chaseTargetReached =
    liveQ.data?.status !== 'completed' &&
    secondInningsSummary != null &&
    chaseTarget != null &&
    secondInningsSummary.runs >= chaseTarget
  const allocatedInningsBalls = oversFieldToBalls(
    liveQ.data?.match_overs ?? matchOvers,
  )
  const allocatedWholeOvers = Math.floor(allocatedInningsBalls / 6)
  const completedAllocatedOvers =
    allocatedInningsBalls > 0 &&
    allocatedInningsBalls % 6 === 0 &&
    nextOverNumber >= allocatedWholeOvers
  const firstInningsOversReached =
    liveQ.data?.status !== 'completed' &&
    innings === 1 &&
    firstInningsSummary != null &&
    secondInningsSummary == null &&
    allocatedInningsBalls > 0 &&
    (completedAllocatedOvers || firstInningsSummary.legal_balls >= allocatedInningsBalls)

  useEffect(() => {
    if (liveQ.data?.status === 'completed' || !chaseTargetReached) {
      setMatchOverOpen(false)
      return
    }
    setBowlerChangeOpen(false)
    setMatchOverOpen(true)
  }, [chaseTargetReached, liveQ.data?.status])

  useEffect(() => {
    if (liveQ.data?.status === 'completed' || !firstInningsOversReached) {
      setInningsOverOpen(false)
      return
    }
    setBowlerChangeOpen(false)
    setInningsOverOpen(true)
  }, [firstInningsOversReached, liveQ.data?.status])

  useEffect(() => {
    const latestEvent = [...(liveQ.data?.events ?? [])]
      .filter((event) => event.innings === innings)
      .sort((a, b) => b.sequence_number - a.sequence_number || b.id - a.id)[0]
    if (!latestEvent) return

    const eventKey = `${latestEvent.innings}:${latestEvent.sequence_number}:${latestEvent.updated_at}`
    if (lastHydratedEventKeyRef.current === eventKey) return
    lastHydratedEventKeyRef.current = eventKey

    const selection = selectionAfterEvent(latestEvent)
    setBattingTeamId(latestEvent.batting_team_id)
    setBowlingTeamId(latestEvent.bowling_team_id)
    setStrikerPlayerId(selection.strikerPlayerId ?? '')
    setNonStrikerPlayerId(selection.nonStrikerPlayerId ?? '')
    setBowlerPlayerId(selection.bowlerPlayerId)
    setWicketPlayerId(selection.strikerPlayerId ?? selection.nonStrikerPlayerId ?? '')
  }, [innings, liveQ.data?.events])

  useEffect(() => {
    const events = [...(liveQ.data?.events ?? [])].sort(
      (a, b) => b.sequence_number - a.sequence_number || b.id - a.id,
    )
    if (events.length === 0) {
      setCommentaryEventId(null)
      setCommentaryDraft('')
      return
    }
    const current = events.find((event) => event.id === commentaryEventId)
    if (current) return
    setCommentaryEventId(events[0].id)
    setCommentaryDraft(events[0].commentary ?? '')
  }, [commentaryEventId, liveQ.data?.events])

  const battingTeamName =
    matchTeams.find((team) => team.id === battingTeamId)?.name ?? 'Batting team'
  const bowlingTeamName =
    matchTeams.find((team) => team.id === bowlingTeamId)?.name ?? 'Bowling team'

  const saveCommentaryMutation = useMutation({
    mutationFn: ({ eventId, commentary }: { eventId: number; commentary: string }) =>
      adminPutJson<LiveBallEventDto>(
        `/admin/matches/${mid}/live/balls/${eventId}/commentary`,
        { commentary: commentary.trim() || null },
      ),
    onSuccess: (updatedEvent) => {
      queryClient.setQueryData<LiveScoreStateDto>(
        ['admin', 'matches', mid, 'live'],
        (current) =>
          current
            ? {
                ...current,
                events: current.events.map((event) =>
                  event.id === updatedEvent.id ? updatedEvent : event,
                ),
              }
            : current,
      )
      setCommentaryDraft(updatedEvent.commentary ?? '')
      setActionError(null)
    },
    onError: (error: Error) => setActionError(error.message),
  })

  const uploadMatchPhotoMutation = useMutation({
    mutationFn: () => {
      if (!photoFile) throw new Error('Choose a photo to upload.')
      return scorerUploadMatchPhoto<GalleryItemDto>(
        mid,
        photoFile,
        photoTitle.trim() || `${match?.title?.trim() || 'Match'} photo`,
      )
    },
    onSuccess: async () => {
      setPhotoFile(null)
      setPhotoTitle('')
      const input = document.getElementById('live-match-photo-file') as HTMLInputElement | null
      if (input) input.value = ''
      setActionError(null)
      await queryClient.invalidateQueries({ queryKey: ['public', 'gallery', 'match', mid] })
    },
    onError: (error: Error) => setActionError(error.message),
  })

  const saveSetupMutation = useMutation({
    mutationFn: () => {
      if (!tossWinnerTeamId || !battingFirstTeamId) {
        throw new Error('Choose toss winner and batting first team.')
      }
      const overs = Number(matchOvers)
      if (!Number.isFinite(overs) || overs <= 0) {
        throw new Error('Enter valid match overs, for example 40.0 or 20.0.')
      }
      const body: MatchLiveSetupInput = {
        toss_winner_team_id: tossWinnerTeamId,
        toss_decision: tossDecision,
        batting_first_team_id: battingFirstTeamId,
        match_overs: matchOvers,
        umpire_1: umpire1.trim() || null,
        umpire_2: umpire2.trim() || null,
        reserve_umpire: reserveUmpire.trim() || null,
      }
      return adminPutJson<MatchDto>(
        `/admin/matches/${mid}/live/setup`,
        body,
        scoringWriteHeaders(),
      )
    },
    onSuccess: async (savedMatch) => {
      setActionError(null)
      setRevisedMatchOvers(String(savedMatch.match_overs))
      setConditionsDirty(false)
      setActiveScorerPanel('squads')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'scorer', 'matches'] })
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'matches', mid, 'scoring-session', deviceId],
      })
    },
    onError: (error: Error) => setActionError(error.message),
  })

  const saveConditionsMutation = useMutation({
    mutationFn: () => {
      const revisedOvers = revisedMatchOvers.trim()
      const overs = Number(revisedOvers)
      const clearDls = revisedOvers === '' || overs === 0
      if (!clearDls && (!Number.isFinite(overs) || overs < 0)) {
        throw new Error('Enter valid revised overs, for example 35.0 or 19.4.')
      }
      const body: LiveMatchConditionsInput = {
        match_overs: clearDls ? null : revisedOvers,
        innings,
        clear_dls: clearDls,
      }
      return adminPutJson<LiveScoreStateDto>(
        `/admin/matches/${mid}/live/conditions`,
        body,
        scoringWriteHeaders(),
      )
    },
    onSuccess: async (state) => {
      setActionError(null)
      setConditionsDirty(false)
      setConditionsOpen(false)
      setMatchOvers(String(state.match_overs ?? revisedMatchOvers))
      queryClient.setQueryData(['admin', 'matches', mid, 'live'], state)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'scorer', 'matches'] })
    },
    onError: (error: Error) => setActionError(error.message),
  })

  const saveSquadMutation = useMutation({
    mutationFn: () => {
      if (!match) throw new Error('Match not loaded.')
      const body: MatchSquadSaveInput = {
        teams: matchTeams.map((team) => {
          const players = playersForTeam(team.id)
            .map((player, index) => ({ player, index }))
            .filter(({ player }) => Boolean(playerRoles[player.id]))

          return {
            team_id: team.id,
            players: players.map(({ player, index }) => ({
              player_id: player.id,
              role: playerRoles[player.id] as MatchSquadRole,
              lineup_order: index + 1,
              is_captain: false,
              is_wicketkeeper: false,
            })),
          }
        }),
      }

      return adminPutJson<MatchSquadDto>(
        `/admin/matches/${mid}/squads`,
        body,
        scoringWriteHeaders(),
      )
    },
    onSuccess: async () => {
      setActionError(null)
      setSquadDirty(false)
      setActiveScorerPanel('score')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'squads'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
    },
    onError: (error: Error) => setActionError(error.message),
  })

  const startMutation = useMutation({
    mutationFn: () => {
      if (!battingTeamId || !bowlingTeamId) {
        throw new Error('Choose batting and bowling teams first.')
      }

      return adminPost<LiveScoreStateDto>(
        `/admin/matches/${mid}/live/start`,
        {
          batting_team_id: battingTeamId,
          bowling_team_id: bowlingTeamId,
        },
        { headers: scoringWriteHeaders() },
      )
    },
    onSuccess: async () => {
      setActionError(null)
      setFinalReviewConfirmed(false)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'scorer', 'matches'] })
    },
    onError: (error: Error) => setActionError(error.message),
  })

  const applyPostBallState = (
    body: LiveBallEventInput,
    newBatterId: number | null,
    strikeRuns: number,
  ) => {
    let nextStriker = strikerPlayerId
    let nextNonStriker = nonStrikerPlayerId

    if (body.wicket_type && newBatterId) {
      if (body.wicket_player_id === nextStriker) {
        nextStriker = newBatterId
      } else if (body.wicket_player_id === nextNonStriker) {
        nextNonStriker = newBatterId
      }
    }

    const oddRuns = strikeRuns % 2 === 1
    const endOfOver =
      !body.is_dead_ball &&
      (body.over_complete_override === true ||
        (body.is_legal_delivery !== false &&
          body.over_complete_override !== false &&
          nextBallNumber === 6))

    if (oddRuns !== endOfOver && nextStriker && nextNonStriker) {
      const oldStriker = nextStriker
      nextStriker = nextNonStriker
      nextNonStriker = oldStriker
    }

    setStrikerPlayerId(nextStriker)
    setNonStrikerPlayerId(nextNonStriker)
    setWicketPlayerId(nextStriker || nextNonStriker || '')
  }

  const restorePreBallState = (event: LiveBallEventDto) => {
    setBattingTeamId(event.batting_team_id)
    setBowlingTeamId(event.bowling_team_id)
    setStrikerPlayerId(event.striker_player_id)
    setNonStrikerPlayerId(event.non_striker_player_id ?? '')
    setBowlerPlayerId(event.bowler_player_id)
    setWicketPlayerId(event.striker_player_id)

    const savedNotes = (event.notes ?? '').split('\n')
    const savedOverNote = savedNotes.find((line) => line.startsWith('Over note: '))
    setNotes(savedNotes.filter((line) => !line.startsWith('Over note: ')).join('\n'))
    setOverNote(savedOverNote?.slice('Over note: '.length) ?? '')
  }

  const moveToSecondInnings = () => {
    const firstInningsEvent = (liveQ.data?.events ?? []).find(
      (event) => event.innings === 1,
    )
    const firstInningsBattingTeamId = firstInningsEvent?.batting_team_id ?? battingTeamId
    const firstInningsBowlingTeamId = firstInningsEvent?.bowling_team_id ?? bowlingTeamId

    if (
      firstInningsBattingTeamId &&
      firstInningsBowlingTeamId &&
      firstInningsBattingTeamId !== firstInningsBowlingTeamId
    ) {
      setBattingTeamId(firstInningsBowlingTeamId)
      setBowlingTeamId(firstInningsBattingTeamId)
    }

    setStrikerPlayerId('')
    setNonStrikerPlayerId('')
    setBowlerPlayerId('')
    setWicketPlayerId('')
    setFielderPlayerId('')
    setNewBatterPlayerId('')
    selectionContextRef.current = ''
    lastHydratedEventKeyRef.current = ''
    setInnings(2)
    setActiveScorerPanel('score')
  }

  const applyAcceptedBallUi = (
    created: LiveBallEventDto,
    payload: BallSubmitPayload,
    savedToServer: boolean,
  ) => {
    const inningsEnded =
      dismissalCountsAsWicket(payload.body.wicket_type) &&
      (currentSummary?.wickets ?? 0) >= 9

    if (savedToServer) setLastSavedAt(new Date())
    setNotes('')
    if (
      payload.body.is_legal_delivery !== false &&
      !payload.body.is_dead_ball &&
      (payload.body.over_complete_override ??
        created.over_complete_override ??
        created.ball_number === 6)
    ) {
      setOverNote('')
    }
    setWicketOpen(false)
    setWicketDeliveryType('legal')
    setFielderPlayerId('')
    setNewBatterPlayerId('')
    setWicketEnd('striker')
    setWicketRunsCompleted(0)
    setWicketRunCredit('bat')
    setBattersCrossed(false)
    setDismissalText('')
    setDismissalTextTouched(false)
    setExtrasOpen(false)
    if (payload.body.is_legal_delivery !== false) {
      setUmpireEndOverAfterNextBall(payload.body.over_complete_override === false)
      setUmpireContinueOverAfterNextBall(false)
      setUmpireReplacementInOver(false)
    }
    lastHydratedEventKeyRef.current = `${created.innings}:${created.sequence_number}:${created.updated_at}`
    if (!inningsEnded) {
      applyPostBallState(
        payload.body,
        payload.newBatterId ?? null,
        payload.strikeRuns ?? 0,
      )
      if (
        payload.body.is_legal_delivery !== false &&
        !payload.body.is_dead_ball &&
        (payload.body.over_complete_override ??
          created.over_complete_override ??
          created.ball_number === 6)
      ) {
        setCompletedOverSummary(
          endOfOverSummary(liveQ.data?.events ?? [], created),
        )
        setPreviousBowlerPlayerId(payload.body.bowler_player_id)
        setNextBowlerPlayerId('')
        setBowlerChangeOpen(true)
      }
    }

    if (inningsEnded) {
      if (payload.body.innings === 1) moveToSecondInnings()
      else setActiveScorerPanel('review')
    }
  }

  const queueBallForDelivery = (payload: BallSubmitPayload, error: string | null) => {
    const next = enqueueScoringBall(outboxRef.current, mid, payload, error)
    outboxRef.current = next
    saveScoringOutbox(mid, next)
    setDeliveryOutbox(next)
    const current = queryClient.getQueryData<LiveScoreStateDto>([
      'admin',
      'matches',
      mid,
      'live',
    ])
    if (!current) return
    const updated = appendOptimisticBall(current, payload, next.length)
    queryClient.setQueryData(['admin', 'matches', mid, 'live'], updated)
    const optimisticEvent = updated.events.at(-1)
    if (optimisticEvent) applyAcceptedBallUi(optimisticEvent, payload, false)
  }

  const ballMutation = useMutation({
    mutationFn: (payload: BallSubmitPayload) =>
      adminPost<LiveBallEventDto>(
        `/admin/matches/${mid}/live/balls`,
        payload.body,
        { headers: scoringWriteHeaders() },
      ),
    onSuccess: async (created, payload) => {
      setActionError(null)
      applyAcceptedBallUi(created, payload, true)
      queryClient.setQueryData<LiveScoreStateDto>(
        ['admin', 'matches', mid, 'live'],
        (current) =>
          current
            ? {
                ...current,
                scoring_version: created.score_version ?? current.scoring_version,
              }
            : current,
      )
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
    },
    onError: (error: Error, payload) => {
      if (error instanceof ApiError && error.status < 500) {
        setActionError(error.message)
        return
      }
      queueBallForDelivery(payload, error.message)
      setActionError(
        `Connection interrupted: the ball is safely queued on this device and will sync automatically. ${error.message}`,
      )
    },
  })

  const undoMutation = useMutation({
    mutationFn: async (): Promise<UndoLastBallResult> => {
      const undoneEvent = [...(liveQ.data?.events ?? [])].sort(
        (a, b) => b.sequence_number - a.sequence_number || b.id - a.id,
      )[0] ?? null
      const state = await adminDeleteJson<LiveScoreStateDto>(
        `/admin/matches/${mid}/live/balls/last`,
        scoringWriteHeaders(),
      )
      return { state, undoneEvent: state.undone_event ?? undoneEvent }
    },
    onSuccess: async ({ state, undoneEvent }) => {
      setActionError(null)
      const restoredLatestEvent = [...state.events].sort(
        (a, b) => b.sequence_number - a.sequence_number || b.id - a.id,
      )[0]
      lastHydratedEventKeyRef.current = restoredLatestEvent
        ? `${restoredLatestEvent.innings}:${restoredLatestEvent.sequence_number}:${restoredLatestEvent.updated_at}`
        : ''
      queryClient.setQueryData(['admin', 'matches', mid, 'live'], state)

      if (undoneEvent) {
        if (innings === undoneEvent.innings) {
          restorePreBallState(undoneEvent)
        } else {
          setInnings(undoneEvent.innings)
          globalThis.setTimeout(() => restorePreBallState(undoneEvent), 0)
        }
      }

      setWicketOpen(false)
      setWicketDeliveryType('legal')
      setFielderPlayerId('')
      setNewBatterPlayerId('')
      setWicketEnd('striker')
      setWicketRunsCompleted(0)
      setWicketRunCredit('bat')
      setBattersCrossed(false)
      setDismissalText('')
      setDismissalTextTouched(false)
      setBowlerChangeOpen(false)
      setPreviousBowlerPlayerId(null)
      setNextBowlerPlayerId('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
    },
    onError: (error: Error) => setActionError(error.message),
  })

  const editBallMutation = useMutation({
    mutationFn: (payload: EditingBallDraft) =>
      adminPutJson<LiveScoreStateDto>(
        `/admin/matches/${mid}/live/balls/${payload.eventId}`,
        payload.body,
        scoringWriteHeaders(),
      ),
    onSuccess: async (state) => {
      setActionError(null)
      setEditBallError(null)
      setEditingBall(null)
      lastHydratedEventKeyRef.current = ''
      queryClient.setQueryData(['admin', 'matches', mid, 'live'], state)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'scorer', 'matches'] })
    },
    onError: (error: Error) => setEditBallError(error.message),
  })

  const saveOverNoteMutation = useMutation({
    mutationFn: ({ event, note }: { event: LiveBallEventDto; note: string }) =>
      adminPutJson<LiveScoreStateDto>(
        `/admin/matches/${mid}/live/balls/${event.id}`,
        { ...eventToLiveBallInput(event), notes: withOverNote(event.notes, note) },
        scoringWriteHeaders(),
      ),
    onSuccess: async (state) => {
      setActionError(null)
      lastHydratedEventKeyRef.current = ''
      queryClient.setQueryData(['admin', 'matches', mid, 'live'], state)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
    },
    onError: (error: Error) => setActionError(error.message),
  })

  const continueOverMutation = useMutation({
    mutationFn: (event: LiveBallEventDto) =>
      adminPutJson<LiveScoreStateDto>(
        `/admin/matches/${mid}/live/balls/${event.id}`,
        { ...eventToLiveBallInput(event), over_complete_override: false },
        scoringWriteHeaders(),
      ),
    onSuccess: async (state, event) => {
      const changedEvent = state.events.find((candidate) => candidate.id === event.id) ?? event
      const selection = selectionAfterEvent(changedEvent)
      setStrikerPlayerId(selection.strikerPlayerId ?? '')
      setNonStrikerPlayerId(selection.nonStrikerPlayerId ?? '')
      setActionError(null)
      setBowlerChangeOpen(false)
      setCompletedOverSummary(null)
      setPreviousBowlerPlayerId(null)
      setNextBowlerPlayerId('')
      setUmpireEndOverAfterNextBall(true)
      setUmpireContinueOverAfterNextBall(false)
      lastHydratedEventKeyRef.current = ''
      queryClient.setQueryData(['admin', 'matches', mid, 'live'], state)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
    },
    onError: (error: Error) => setActionError(error.message),
  })

  const endOverNowMutation = useMutation({
    mutationFn: (event: LiveBallEventDto) =>
      adminPutJson<LiveScoreStateDto>(
        `/admin/matches/${mid}/live/balls/${event.id}`,
        { ...eventToLiveBallInput(event), over_complete_override: true },
        scoringWriteHeaders(),
      ),
    onSuccess: async (state, event) => {
      const closingEvent = state.events.find((candidate) => candidate.id === event.id) ?? event
      const selection = selectionAfterEvent(closingEvent)
      setStrikerPlayerId(selection.strikerPlayerId ?? '')
      setNonStrikerPlayerId(selection.nonStrikerPlayerId ?? '')
      setActionError(null)
      setCompletedOverSummary(endOfOverSummary(state.events, closingEvent))
      setPreviousBowlerPlayerId(closingEvent.bowler_player_id)
      setNextBowlerPlayerId('')
      setUmpireEndOverAfterNextBall(false)
      setUmpireContinueOverAfterNextBall(false)
      setBowlerChangeOpen(true)
      lastHydratedEventKeyRef.current = ''
      queryClient.setQueryData(['admin', 'matches', mid, 'live'], state)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
    },
    onError: (error: Error) => setActionError(error.message),
  })

  const deleteBallMutation = useMutation({
    mutationFn: (eventId: number) =>
      adminDeleteJson<LiveScoreStateDto>(
        `/admin/matches/${mid}/live/balls/${eventId}`,
        scoringWriteHeaders(),
      ),
    onSuccess: async (state) => {
      setActionError(null)
      setEditBallError(null)
      setEditingBall(null)
      lastHydratedEventKeyRef.current = ''
      queryClient.setQueryData(['admin', 'matches', mid, 'live'], state)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'scorer', 'matches'] })
    },
    onError: (error: Error) => setEditBallError(error.message),
  })

  const completeMutation = useMutation({
    mutationFn: (status: 'completed' | 'abandoned' | 'cancelled') =>
      adminPost<LiveScoreStateDto>(
        `/admin/matches/${mid}/live/complete`,
        {
          status,
          match_overs: matchOvers,
        },
        { headers: scoringWriteHeaders() },
      ),
    onSuccess: async (state) => {
      setActionError(null)
      setFinalReviewConfirmed(false)
      setMatchOverOpen(false)
      setInningsOverOpen(false)
      queryClient.setQueryData<MatchDto[]>(
        ['admin', 'scorer', 'matches'],
        (current) =>
          current?.map((row) =>
            row.id === mid ? { ...row, status: state.status } : row,
          ) ?? current,
      )
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'scorer', 'matches'] })
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'matches', mid, 'scoring-session', deviceId],
      })
    },
    onError: (error: Error) => setActionError(error.message),
  })


  const resetTestMutation = useMutation({
    mutationFn: () =>
      adminPost<LiveScoreStateDto>(
        `/admin/matches/${mid}/live/reset-test`,
        {},
        { headers: scoringWriteHeaders() },
      ),
    onSuccess: async () => {
      setActionError(null)
      setEditingBall(null)
      setEditBallError(null)
      setNotes('')
      setOverNote('')
      setWicketOpen(false)
      setWicketDeliveryType('legal')
      setFielderPlayerId('')
      setNewBatterPlayerId('')
      setWicketRunsCompleted(0)
      setWicketRunCredit('bat')
      setDismissalText('')
      setDismissalTextTouched(false)
      setBowlerChangeOpen(false)
      setPreviousBowlerPlayerId(null)
      setNextBowlerPlayerId('')
      setMatchOverOpen(false)
      setInningsOverOpen(false)
      setRevisedMatchOvers('40.0')
      setConditionsDirty(false)
      setConditionsOpen(true)
      setInnings(1)
      selectionContextRef.current = ''
      lastHydratedEventKeyRef.current = ''
      hasHydratedInningsRef.current = false
      setActiveScorerPanel('setup')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'squads'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'scorer', 'matches'] })
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'matches', mid, 'scoring-session', deviceId],
      })
    },
    onError: (error: Error) => setActionError(error.message),
  })

  const reconcileScorecardMutation = useMutation({
    mutationFn: () =>
      adminPost<LiveScoreStateDto>(
        `/admin/matches/${mid}/live/reconcile`,
        {},
        { headers: scoringWriteHeaders() },
      ),
    onSuccess: (state) => {
      setActionError(null)
      queryClient.setQueryData(['admin', 'matches', mid, 'live'], state)
    },
    onError: (error: Error) =>
      setActionError(`Automatic scorecard reconciliation failed: ${error.message}`),
  })

  useEffect(() => {
    const state = liveQ.data
    if (
      state?.scorecard_reconciliation_status !== 'out_of_sync' ||
      !scoringSessionQ.data?.session_token ||
      deliveryOutbox.length > 0 ||
      reconciliationAttemptedVersionRef.current === state?.scoring_version
    ) {
      return
    }
    reconciliationAttemptedVersionRef.current = state.scoring_version
    reconcileScorecardMutation.mutate()
  }, [
    deliveryOutbox.length,
    liveQ.data,
    reconcileScorecardMutation,
    scoringSessionQ.data?.session_token,
  ])

  const requestEditAccessMutation = useMutation({
    mutationFn: (reason: string) =>
      adminPost<ScorecardEditRequestDto>(
        `/admin/matches/${mid}/scorecard-edit-requests`,
        { reason: reason.trim() || null },
      ),
    onSuccess: async () => {
      setActionError(null)
      setRequestEditOpen(false)
      setRequestEditReason('')
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'matches', mid, 'live'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'scorer', 'matches'],
      })
    },
    onError: (error: Error) => setActionError(error.message),
  })

  const takeoverSessionMutation = useMutation({
    mutationFn: (reason: string) =>
      adminPost<ScoringSessionDto>(`/admin/matches/${mid}/live/session`, {
        device_id: deviceId,
        device_label: deviceLabel,
        force_takeover: true,
        takeover_reason: reason,
      }),
    onSuccess: async (session) => {
      setActionError(null)
      queryClient.setQueryData(
        ['admin', 'matches', mid, 'scoring-session', deviceId],
        session,
      )
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'matches', mid, 'live'],
      })
    },
    onError: (error: Error) => setActionError(error.message),
  })

  const flushDeliveryOutbox = useCallback(async () => {
    const token = scoringSessionQ.data?.session_token
    if (!isOnline || !token || outboxRef.current.length === 0 || outboxFlushingRef.current) {
      return
    }

    outboxFlushingRef.current = true
    setOutboxFlushing(true)
    try {
      const authoritative = await adminGet<LiveScoreStateDto>(
        `/admin/matches/${mid}/live`,
      )
      let version = authoritative.scoring_version
      const queuedAtStart = [...outboxRef.current]

      for (const entry of queuedAtStart) {
        try {
          const saved = await adminPost<LiveBallEventDto>(
            `/admin/matches/${mid}/live/balls`,
            entry.payload.body,
            {
              headers: {
                'X-Score-Version': String(version),
                'X-Scoring-Session': token,
              },
            },
          )
          version = saved.score_version ?? version + 1
          const remaining = removeScoringBall(outboxRef.current, entry.id)
          outboxRef.current = remaining
          saveScoringOutbox(mid, remaining)
          setDeliveryOutbox(remaining)
          setLastSavedAt(new Date())
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to sync delivery.'
          const pending = markScoringAttempt(outboxRef.current, entry.id, message)
          outboxRef.current = pending
          saveScoringOutbox(mid, pending)
          setDeliveryOutbox(pending)
          setActionError(
            error instanceof ApiError && (error.status === 409 || error.status === 428)
              ? `Scoring paused: ${message} Resolve session ownership before retrying the queued deliveries.`
              : `Queued deliveries remain safe on this device. Sync stopped: ${message}`,
          )
          break
        }
      }
      if (outboxRef.current.length === 0) {
        setActionError(null)
      }
    } catch (error) {
      setActionError(
        `Queued deliveries remain safe on this device. Reconnection check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    } finally {
      outboxFlushingRef.current = false
      setOutboxFlushing(false)
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'matches', mid, 'live'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'scorer', 'matches'],
      })
    }
  }, [isOnline, mid, queryClient, scoringSessionQ.data?.session_token])

  useEffect(() => {
    if (isOnline && deliveryOutbox.length > 0 && scoringSessionQ.data?.session_token) {
      void flushDeliveryOutbox()
    }
  }, [
    deliveryOutbox.length,
    flushDeliveryOutbox,
    isOnline,
    scoringSessionQ.data?.session_token,
  ])

  const scorecardReadOnly =
    Boolean(liveQ.data?.scorecard_locked) &&
    liveQ.data?.can_edit_scorecard === false
  const canPublishCommentary =
    isCommentator || liveQ.data?.can_edit_commentary !== false
  const scoringSessionConflict =
    scoringSessionQ.error instanceof ApiError && scoringSessionQ.error.status === 409
  const requestScoringTakeover = () => {
    const reason = window.prompt(
      'Why are you taking over this scoring session? The reason is saved in the audit log.',
    )
    if (reason == null) return
    if (reason.trim().length < 5) {
      setActionError('Enter a takeover reason of at least 5 characters.')
      return
    }
    void takeoverSessionMutation.mutate(reason.trim())
  }
  const matchFinalized =
    liveQ.data?.status === 'completed' || match?.status === 'completed'
  const effectiveScorerPanel = isCommentator
    ? (['commentary', 'photos'] as ScorerPanel[]).includes(activeScorerPanel)
      ? activeScorerPanel
      : 'commentary'
    : !canPublishCommentary && activeScorerPanel === 'commentary'
      ? scorecardReadOnly
        ? 'review'
        : 'score'
    : scorecardReadOnly &&
        !(['commentary', 'photos', 'balls', 'review', 'help'] as ScorerPanel[]).includes(
          activeScorerPanel,
        )
      ? 'review'
      : activeScorerPanel

  const updateEditingBall = <K extends keyof LiveBallEventInput>(
    field: K,
    value: LiveBallEventInput[K],
  ) => {
    setEditingBall((current) =>
      current
        ? {
            ...current,
            body: { ...current.body, [field]: value },
          }
        : current,
    )
  }

  const saveEditingBall = () => {
    if (!editingBall) return
    void editBallMutation.mutate(editingBall)
  }

  const deleteRecordedBall = (event: LiveBallEventDto) => {
    const ok = window.confirm(
      `Delete recorded ball ${event.innings}.${event.over_number}.${event.ball_number}? This will recalculate live score and the official scorecard if already finalized.`,
    )
    if (!ok) return
    void deleteBallMutation.mutate(event.id)
  }

  const beginEditingBall = (event: LiveBallEventDto) => {
    setEditBallError(null)
    setEditingBall({
      eventId: event.id,
      body: eventToLiveBallInput(event),
    })
    setActiveScorerPanel('corrections')
  }

  const endCurrentInnings = (confirmed = false) => {
    if (innings >= 2) {
      setActionError('This is already the second innings. Use Match over when the match is finished.')
      return
    }

    if (!confirmed && legalBalls === 0 && (currentSummary?.runs ?? 0) === 0 && (currentSummary?.wickets ?? 0) === 0) {
      const ok = window.confirm('No balls have been recorded in this innings yet. End innings anyway?')
      if (!ok) return
    }

    if (!confirmed) {
      const ok = window.confirm('End this innings and move to the second innings?')
      if (!ok) return
    }

    setActionError(null)
    setNotes('')
    setOverNote('')
    setWicketOpen(false)
    setWicketDeliveryType('legal')
    setFielderPlayerId('')
    setNewBatterPlayerId('')
    setWicketRunsCompleted(0)
    setWicketRunCredit('bat')
    setBowlerChangeOpen(false)
    setPreviousBowlerPlayerId(null)
    setNextBowlerPlayerId('')
    setMatchOverOpen(false)
    setInningsOverOpen(false)
    moveToSecondInnings()
  }

  const markMatchOver = () => {
    if (!finalReviewConfirmed) {
      setActionError('Open Review, check the innings/fielding/NRR details, then tick the final confirmation box.')
      setActiveScorerPanel('review')
      return
    }

    const ok = window.confirm('Finalize this match into the official result, scorecard, player stats, fielding stats, standings and NRR?')
    if (!ok) return
    void completeMutation.mutate('completed')
  }


  const resetTestMatch = () => {
    const ok = window.confirm(
      'Reset this test match? This deletes live balls, match day squads, official result, scorecard rows, and removes this match from player stats and standings. The fixture and scorer assignment stay in place.',
    )
    if (!ok) return
    void resetTestMutation.mutate()
  }

  const submitBall = (
    input: {
      runsBatter?: number
      runsExtras?: number
      extrasType?: string | null
      isLegalDelivery?: boolean
      completedRuns?: number
      boundaryRuns?: number
      boundaryType?: string | null
      penaltyRunsBatting?: number
      penaltyRunsFielding?: number
      shortRuns?: number
      legByeAttempted?: boolean
      overCompleteOverride?: boolean | null
      isDeadBall?: boolean
      wicketType?: string | null
      wicketPlayerId?: number | null
      fielderPlayerId?: number | null
      wicketEnd?: WicketEnd | null
      battersCrossed?: boolean
      dismissalText?: string | null
      strikeRuns?: number
    },
    newBatterId?: number | null,
  ) => {
    if (isOnline && !scoringSessionQ.data?.session_token) {
      setActionError(
        scoringSessionQ.error instanceof ApiError && scoringSessionQ.error.status === 409
          ? 'This match is being scored on another device. Take over the session before recording.'
          : 'Connecting this scoring device. Please wait a moment and try again.',
      )
      return
    }

    if (firstInningsOversReached) {
      setInningsOverOpen(true)
      setActionError('The allocated overs are complete. Confirm the move to the second innings.')
      return
    }

    if (chaseTargetReached) {
      setMatchOverOpen(true)
      setActionError('The target has been reached. Review and finalize the match.')
      return
    }

    if (bowlerChangeOpen) {
      setActionError('Choose the new bowler before recording the next ball.')
      return
    }

    if (!battingTeamId || !bowlingTeamId || !strikerPlayerId || !bowlerPlayerId) {
      setActionError('Choose teams, striker and bowler first.')
      return
    }

    const isLegalDelivery = input.isLegalDelivery ?? true
    const overCompleteOverride = input.overCompleteOverride ?? (
      isLegalDelivery && umpireEndOverAfterNextBall
        ? true
        : isLegalDelivery && umpireContinueOverAfterNextBall
          ? false
          : null
    )
    const ballComment = notes.trim()
    const combinedNotes = [
      ballComment,
      umpireReplacementInOver ? 'Umpire-approved replacement bowler completing this over.' : '',
    ]
      .filter(Boolean)
      .join('\n')

    const body: LiveBallEventInput = {
      client_event_id: newClientEventId(),
      innings,
      over_number: nextOverNumber,
      ball_number: nextBallNumber,
      batting_team_id: battingTeamId,
      bowling_team_id: bowlingTeamId,
      striker_player_id: strikerPlayerId,
      non_striker_player_id: nonStrikerPlayerId || null,
      bowler_player_id: bowlerPlayerId,
      runs_batter: input.runsBatter ?? 0,
      runs_extras: input.runsExtras ?? 0,
      extras_type: input.extrasType ?? null,
      is_legal_delivery: isLegalDelivery,
      completed_runs:
        input.completedRuns ?? input.strikeRuns ?? input.runsBatter ?? 0,
      boundary_runs: input.boundaryRuns ?? 0,
      boundary_type: input.boundaryType ?? null,
      penalty_runs_batting: input.penaltyRunsBatting ?? 0,
      penalty_runs_fielding: input.penaltyRunsFielding ?? 0,
      short_runs: input.shortRuns ?? 0,
      leg_bye_attempted: input.legByeAttempted ?? false,
      over_complete_override: overCompleteOverride,
      is_dead_ball: input.isDeadBall ?? false,
      wicket_type: input.wicketType ?? null,
      wicket_player_id: input.wicketType
        ? input.wicketPlayerId ?? (wicketPlayerId || strikerPlayerId)
        : null,
      fielder_player_id: input.fielderPlayerId ?? null,
      replacement_player_id: input.wicketType ? newBatterId ?? null : null,
      wicket_end: input.wicketEnd ?? null,
      batters_crossed: input.battersCrossed ?? false,
      dismissal_text: input.dismissalText ?? null,
      notes: combinedNotes || null,
    }

    const payload: BallSubmitPayload = {
      body,
      newBatterId,
      strikeRuns: input.strikeRuns ?? input.runsBatter ?? 0,
    }

    if (!isOnline || outboxRef.current.length > 0) {
      queueBallForDelivery(payload, isOnline ? null : 'Device offline')
      setActionError(
        isOnline
          ? 'This ball is queued behind earlier deliveries and will sync in order.'
          : 'Offline: this ball is saved on this device. You can keep scoring and it will sync after reconnection.',
      )
      return
    }

    void ballMutation.mutate(payload)
  }

  const recordShortRun = () => {
    if (shortRunCompleted <= shortRunScored) {
      setActionError('For a short run, the runs scored must be lower than the runs completed.')
      return
    }

    const shortRuns = shortRunCompleted - shortRunScored
    const common = {
      completedRuns: shortRunCompleted,
      shortRuns,
      strikeRuns: shortRunCompleted,
      dismissalText: `${shortRuns} short run${shortRuns === 1 ? '' : 's'} called`,
    }

    if (shortRunDelivery === 'wide') {
      submitBall({ ...common, runsExtras: shortRunScored + 1, extrasType: 'wide', isLegalDelivery: false })
      return
    }
    if (shortRunDelivery === 'no_ball_bat') {
      submitBall({ ...common, runsBatter: shortRunScored, runsExtras: 1, extrasType: 'no_ball', isLegalDelivery: false })
      return
    }
    if (shortRunDelivery === 'bye') {
      submitBall({ ...common, runsExtras: shortRunScored, extrasType: 'bye' })
      return
    }
    if (shortRunDelivery === 'leg_bye') {
      submitBall({ ...common, runsExtras: shortRunScored, extrasType: 'leg_bye', legByeAttempted: true })
      return
    }
    if (shortRunDelivery === 'no_ball_bye') {
      submitBall({ ...common, runsExtras: shortRunScored + 1, extrasType: 'no_ball_bye', isLegalDelivery: false })
      return
    }
    if (shortRunDelivery === 'no_ball_leg_bye') {
      submitBall({ ...common, runsExtras: shortRunScored + 1, extrasType: 'no_ball_leg_bye', isLegalDelivery: false, legByeAttempted: true })
      return
    }
    submitBall({ ...common, runsBatter: shortRunScored })
  }

  const submitWicket = () => {
    setActionError(null)

    if (!battingTeamId || !bowlingTeamId || !strikerPlayerId || !bowlerPlayerId) {
      setActionError('Choose batting team, bowling team, striker and bowler before saving the wicket ball.')
      return
    }

    if (!nonStrikerPlayerId && wicketType === 'run_out') {
      setActionError('Choose the non-striker before saving a run out.')
      return
    }

    const option = dismissalOptionsForDelivery(wicketDeliveryType).find(
      (item) => item.value === wicketType,
    )
    if (!option) {
      setActionError('Choose a dismissal mode that is valid for this delivery.')
      return
    }

    const playerOut = wicketPlayerId || strikerPlayerId
    if (!playerOut) {
      setActionError('Choose the player who is out.')
      return
    }

    let fielderId: number | null = null
    if (wicketType === 'caught_and_bowled') {
      fielderId = bowlerPlayerId || null
    } else if (option.needsFielder) {
      if (!fielderPlayerId) {
        setActionError(`Choose the ${option.fielderLabel ?? 'fielder'} before saving this wicket.`)
        return
      }
      fielderId = fielderPlayerId
    }

    const wicketRuns = Math.max(0, Number(wicketRunsCompleted) || 0)
    if (wicketRuns > 0 && wicketType !== 'run_out') {
      setActionError('Runs completed before the wicket can only be recorded for a run out.')
      return
    }

    const newBatter = newBatterPlayerId || null
    if (replacementBatterRequired && !newBatter) {
      setActionError(
        RETIREMENT_DISMISSALS.has(wicketType)
          ? 'Choose the batter coming in after the retirement.'
          : 'Choose the new batter before saving this wicket ball.',
      )
      return
    }

    const finalDismissalText =
      dismissalText.trim() ||
      suggestedDismissal(
        wicketType,
        playerName(playerById, bowlerPlayerId || null),
        fielderId ? playerName(playerById, fielderId) : '',
      )

    if (wicketType === 'non_striker_left_early') {
      if (playerOut !== nonStrikerPlayerId) {
        setActionError('For non-striker leaving early, select the current non-striker as the player out.')
        return
      }
      submitBall(
        {
          wicketType,
          wicketPlayerId: playerOut,
          fielderPlayerId: fielderId,
          wicketEnd: 'non_striker',
          isLegalDelivery: false,
          isDeadBall: true,
          completedRuns: 0,
          strikeRuns: 0,
          dismissalText: finalDismissalText,
        },
        newBatter,
      )
      return
    }

    if (wicketType === 'timed_out') {
      submitBall(
        {
          wicketType,
          wicketPlayerId: playerOut,
          isLegalDelivery: false,
          isDeadBall: true,
          completedRuns: 0,
          strikeRuns: 0,
          dismissalText: finalDismissalText,
        },
        newBatter,
      )
      return
    }

    if (RETIREMENT_DISMISSALS.has(wicketType)) {
      submitBall(
        {
          wicketType,
          wicketPlayerId: playerOut,
          isLegalDelivery: false,
          isDeadBall: true,
          completedRuns: 0,
          strikeRuns: 0,
          dismissalText: finalDismissalText,
        },
        newBatter,
      )
      return
    }

    let runsBatter = 0
    let runsExtras = 0
    let extrasType: string | null = null
    let isLegalDelivery = true

    if (wicketDeliveryType === 'wide') {
      runsExtras = wicketRuns + 1
      extrasType = 'wide'
      isLegalDelivery = false
    } else if (wicketDeliveryType === 'no_ball') {
      runsBatter = wicketRunCredit === 'bat' ? wicketRuns : 0
      runsExtras = 1 + (wicketRunCredit === 'bat' ? 0 : wicketRuns)
      extrasType =
        wicketRuns === 0 || wicketRunCredit === 'bat'
          ? 'no_ball'
          : `no_ball_${wicketRunCredit}`
      isLegalDelivery = false
    } else {
      runsBatter = wicketRunCredit === 'bat' ? wicketRuns : 0
      runsExtras = wicketRunCredit === 'bat' ? 0 : wicketRuns
      extrasType = wicketRunCredit === 'bat' || wicketRuns === 0 ? null : wicketRunCredit
    }

    submitBall(
      {
        wicketType,
        wicketPlayerId: playerOut,
        fielderPlayerId: fielderId,
        wicketEnd: wicketType === 'run_out' ? wicketEnd : null,
        battersCrossed,
        runsBatter,
        runsExtras,
        extrasType,
        isLegalDelivery,
        legByeAttempted: wicketRunCredit === 'leg_bye',
        completedRuns: wicketRuns,
        strikeRuns: wicketRuns,
        dismissalText: finalDismissalText,
      },
      newBatter,
    )
  }

  if (matchesQ.isLoading) {
    return <p className="muted">Loading match…</p>
  }

  if (matchesQ.isError) {
    return <p className="login-error">{matchesQ.error.message}</p>
  }

  if (!match || !Number.isFinite(mid)) {
    return (
      <>
        <PageHeader title="Match not found" />
        <Link to="/scoring" className="btn-ghost">
          Back to scoring dashboard
        </Link>
      </>
    )
  }

  const currentScore = currentSummary
    ? `${currentSummary.runs}/${currentSummary.wickets} (${currentSummary.overs_label})`
    : '0/0 (0.0)'

  const wicketDismissalOptions = dismissalOptionsForDelivery(wicketDeliveryType)
  const currentWicketOption = wicketDismissalOptions.find((item) => item.value === wicketType)
  const wicketWillEndInnings =
    dismissalCountsAsWicket(wicketType) && (currentSummary?.wickets ?? 0) >= 9
  const replacementBatterRequired =
    !wicketWillEndInnings &&
    availableNewBatters.length > 0
  const inningsTarget =
    innings === 1 && currentSummary
      ? liveQ.data?.revised_target_runs ?? currentSummary.runs + 1
      : chaseTarget
  const hasSavedSetup = Boolean(match.toss_info?.trim())
  const hasMatchDaySquads =
    !squadDirty &&
    matchTeams.length > 0 &&
    matchTeams.every((team) =>
      Boolean(squadQ.data?.teams.find((savedTeam) => savedTeam.team_id === team.id)?.players.length),
    )
  const strikerName = playerName(playerById, strikerPlayerId || null)
  const nonStrikerName = playerName(playerById, nonStrikerPlayerId || null)
  const bowlerName = playerName(playerById, bowlerPlayerId || null)
  const newOverBowlerOptions = bowlingPlayers.filter(
    (player) => player.id !== previousBowlerPlayerId,
  )
  const wicketIsRetirement = RETIREMENT_DISMISSALS.has(wicketType)
  const suggestedDismissalText = suggestedDismissal(
    wicketType,
    bowlerName,
    fielderPlayerId ? playerName(playerById, fielderPlayerId) : '',
  )
  const resolvedDismissalText = dismissalTextTouched
    ? dismissalText
    : suggestedDismissalText
  const allScoringPanels: Array<{
    id: ScorerPanel
    label: string
    hint: string
    isComplete?: boolean
  }> = [
    { id: 'score', label: 'Score', hint: 'Ball controls' },
    { id: 'commentary', label: 'Commentary', hint: 'Public ball text' },
    { id: 'photos', label: 'Photos', hint: `${matchPhotosQ.data?.total ?? 0} published` },
    {
      id: 'setup',
      label: 'Setup',
      hint: hasSavedSetup ? 'Saved' : 'Toss & overs',
      isComplete: hasSavedSetup,
    },
    {
      id: 'squads',
      label: 'Squads',
      hint: hasMatchDaySquads ? 'Saved' : 'Pick XI',
      isComplete: hasMatchDaySquads,
    },
    { id: 'balls', label: 'Balls', hint: `${liveQ.data?.events.length ?? 0} recorded` },
    { id: 'corrections', label: 'Fix', hint: editingBall ? 'Editing' : 'Correct ball' },
    { id: 'review', label: 'Review', hint: 'Finalize' },
    { id: 'help', label: 'Help', hint: 'Scorer guide' },
  ]
  const scoringPanels = isCommentator
    ? allScoringPanels.filter((panel) => panel.id === 'commentary' || panel.id === 'photos')
    : scorecardReadOnly
      ? allScoringPanels.filter((panel) =>
          (
            canPublishCommentary
              ? (['commentary', 'photos', 'balls', 'review', 'help'] as ScorerPanel[])
              : (['photos', 'balls', 'review', 'help'] as ScorerPanel[])
          ).includes(panel.id),
        )
      : allScoringPanels.filter(
          (panel) => panel.id !== 'commentary' || canPublishCommentary,
        )

  const latestInningsEvent = [...(liveQ.data?.events ?? [])]
    .filter((event) => event.innings === innings)
    .sort((a, b) => b.sequence_number - a.sequence_number || b.id - a.id)[0]
  const overStripOverNumber = latestInningsEvent?.over_number ?? nextOverNumber
  const overStripEvents = [...(liveQ.data?.events ?? [])]
    .filter(
      (event) =>
        event.innings === innings &&
        event.over_number === overStripOverNumber &&
        !(event.is_dead_ball && RETIREMENT_DISMISSALS.has(event.wicket_type ?? '')),
    )
    .sort((a, b) => a.sequence_number - b.sequence_number)
  const overStripRuns = overStripEvents.reduce((total, event) => total + eventRunsTotal(event), 0)
  const scorerWarnings = [
    battingTeamId && bowlingTeamId && battingTeamId === bowlingTeamId
      ? 'Batting and bowling teams cannot be the same.'
      : null,
    strikerPlayerId && nonStrikerPlayerId && strikerPlayerId === nonStrikerPlayerId
      ? 'Striker and non-striker are the same player.'
      : null,
    !strikerPlayerId || !bowlerPlayerId ? 'Choose striker and bowler before scoring.' : null,
    wicketOpen && replacementBatterRequired && !newBatterPlayerId
      ? 'Select the new batter before saving a wicket.'
      : null,
  ].filter((warning): warning is string => Boolean(warning))

  const openWicketDetails = (initialWicketType = 'caught') => {
    const nextDelivery: WicketDeliveryType = RETIREMENT_DISMISSALS.has(initialWicketType)
      ? 'legal'
      : wicketDeliveryType
    const nextOptions = dismissalOptionsForDelivery(nextDelivery)
    const resolvedWicketType = nextOptions.some((option) => option.value === initialWicketType)
      ? initialWicketType
      : nextOptions[0]?.value ?? 'caught'

    setWicketDeliveryType(nextDelivery)
    setWicketType(resolvedWicketType)
    setDismissalText('')
    setDismissalTextTouched(false)
    setActionError(null)
    if (!wicketOpen) {
      const currentEligiblePlayer = [strikerPlayerId, nonStrikerPlayerId].find(
        (playerId) => Boolean(playerId) && !dismissedBatterIds.has(Number(playerId)),
      )
      setWicketPlayerId(currentEligiblePlayer || eligibleWicketPlayers[0]?.id || '')
      setNewBatterPlayerId('')
    }
    setWicketOpen(true)
  }

  const confirmNewOverBowler = async () => {
    if (!nextBowlerPlayerId) {
      setActionError('Choose the bowler for the new over.')
      return
    }
    if (nextBowlerPlayerId === previousBowlerPlayerId) {
      setActionError('The previous bowler cannot bowl consecutive overs.')
      return
    }

    const completedOverEvent = [...(liveQ.data?.events ?? [])]
      .filter(
        (event) =>
          event.innings === innings &&
          event.over_number === completedOverSummary?.over,
      )
      .sort((a, b) => b.sequence_number - a.sequence_number || b.id - a.id)[0]
    if (completedOverEvent && overNote.trim()) {
      try {
        await saveOverNoteMutation.mutateAsync({ event: completedOverEvent, note: overNote })
      } catch {
        return
      }
    }

    setBowlerPlayerId(nextBowlerPlayerId)
    setBowlerChangeOpen(false)
    setCompletedOverSummary(null)
    setPreviousBowlerPlayerId(null)
    setNextBowlerPlayerId('')
    setOverNote('')
    setActionError(null)
  }

  const closeWicketDetails = () => {
    setWicketOpen(false)
    setActionError(null)
    setDismissalText('')
    setDismissalTextTouched(false)
  }

  const allLiveEvents = [...(liveQ.data?.events ?? [])].sort(
    (a, b) => a.sequence_number - b.sequence_number || a.id - b.id,
  )
  const scoringInningsEvents = allLiveEvents.filter((event) => event.innings === innings)
  const scoringScorecard = liveInningsScorecard(scoringInningsEvents)
  const activeScoringBatters = [strikerPlayerId, nonStrikerPlayerId]
    .map((playerId): LiveBatterScorecardRow | null => {
      if (!playerId) return null
      return scoringScorecard.batters.find((row) => row.playerId === playerId) ?? {
        playerId,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        dismissal: 'not out',
      }
    })
    .filter((row): row is LiveBatterScorecardRow => row !== null)
  const activeScoringBowler = bowlerPlayerId
    ? scoringScorecard.bowlers.find((row) => row.playerId === bowlerPlayerId) ?? {
        playerId: bowlerPlayerId,
        legalBalls: 0,
        runs: 0,
        wickets: 0,
        dots: 0,
        wides: 0,
        noBalls: 0,
      }
    : null
  const scoringExtras = liveExtrasBreakdown(scoringInningsEvents)
  const scoringPartnership = livePartnership(scoringInningsEvents)
  const scoringBowlerMaidens = liveBowlerMaidens(scoringInningsEvents, bowlerPlayerId)
  const scoringRunRate = legalBalls > 0
    ? (((currentSummary?.runs ?? 0) * 6) / legalBalls).toFixed(2)
    : '0.00'
  const selectedCommentaryEvent =
    allLiveEvents.find((event) => event.id === commentaryEventId) ??
    allLiveEvents[allLiveEvents.length - 1] ??
    null
  const commentaryInnings = selectedCommentaryEvent?.innings ?? liveQ.data?.current_innings ?? 1
  const commentaryInningsEvents = allLiveEvents.filter(
    (event) => event.innings === commentaryInnings,
  )
  const commentaryScorecard = liveInningsScorecard(commentaryInningsEvents)
  const commentarySummary = liveQ.data?.summaries.find(
    (summary) => summary.innings === commentaryInnings,
  )
  const commentaryFallOfWickets = liveFallOfWickets(commentaryInningsEvents)
  const commentaryEventTotal = selectedCommentaryEvent
    ? selectedCommentaryEvent.runs_batter +
      selectedCommentaryEvent.runs_extras +
      selectedCommentaryEvent.penalty_runs_batting
    : 0
  const completedOverEventIdSet = completedOverEventIds(allLiveEvents, innings)
  const completedOverSummaryByEventId = new Map(
    allLiveEvents
      .filter((event) => completedOverEventIdSet.has(event.id))
      .map((event) => [event.id, endOfOverSummary(allLiveEvents, event)]),
  )
  const correctionSearchText = correctionSearch.trim().toLowerCase()
  const displayedLiveEvents = [...allLiveEvents].reverse().filter((event) => {
    if (effectiveScorerPanel !== 'corrections' || !correctionSearchText) return true

    return [
      `${event.innings}.${event.over_number}.${event.ball_number}`,
      `${event.over_number}.${event.ball_number}`,
      `event ${event.sequence_number}`,
      playerName(playerById, event.striker_player_id),
      playerName(playerById, event.non_striker_player_id),
      playerName(playerById, event.bowler_player_id),
      liveEventLabel(event),
      dismissalLabel(event.wicket_type),
      event.notes,
      event.dismissal_text,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(correctionSearchText))
  })
  const reviewSummaries = [...(liveQ.data?.summaries ?? [])].sort(
    (a, b) => a.innings - b.innings,
  )
  const firstReviewSummary = reviewSummaries.find((summary) => summary.innings === 1) ?? null
  const secondReviewSummary = reviewSummaries.find((summary) => summary.innings === 2) ?? null
  const reviewTeamName = (teamId: number | null | undefined) =>
    teamId ? teamById.get(teamId)?.name ?? `Team ${teamId}` : 'Team'
  const inningsEvents = (inningsNumber: number) =>
    allLiveEvents.filter((event) => event.innings === inningsNumber)
  const reviewExtrasText = (inningsNumber: number) => {
    const events = inningsEvents(inningsNumber)
    const wides = events
      .filter((event) => event.extras_type === 'wide')
      .reduce((total, event) => total + event.runs_extras, 0)
    const noBalls = events
      .filter((event) =>
        event.extras_type === 'no_ball' ||
        event.extras_type === 'no_ball_bye' ||
        event.extras_type === 'no_ball_leg_bye',
      )
      .reduce((total) => total + 1, 0)
    const byes = events
      .filter((event) => event.extras_type === 'bye' || event.extras_type === 'no_ball_bye')
      .reduce((total, event) => total + (event.extras_type === 'no_ball_bye' ? Math.max(0, event.runs_extras - 1) : event.runs_extras), 0)
    const legByes = events
      .filter((event) => event.extras_type === 'leg_bye' || event.extras_type === 'no_ball_leg_bye')
      .reduce((total, event) => total + (event.extras_type === 'no_ball_leg_bye' ? Math.max(0, event.runs_extras - 1) : event.runs_extras), 0)
    const penalties = events.reduce(
      (total, event) => total + event.penalty_runs_batting + event.penalty_runs_fielding,
      0,
    )

    return `Wides ${wides}, no-balls ${noBalls}, byes ${byes}, leg-byes ${legByes}, penalties ${penalties}`
  }
  const reviewWicketEvents = allLiveEvents.filter((event) => Boolean(event.wicket_type))
  const reviewFieldingEvents = reviewWicketEvents.filter(
    (event) => event.fielder_player_id || event.wicket_type === 'caught_and_bowled',
  )
  const reviewResultPreview = (() => {
    if (!firstReviewSummary || !secondReviewSummary) {
      return 'Second innings not complete yet.'
    }

    const target = liveQ.data?.revised_target_runs ?? firstReviewSummary.runs + 1

    if (secondReviewSummary.runs >= target) {
      const wicketsLeft = Math.max(0, 10 - secondReviewSummary.wickets)
      return `${reviewTeamName(secondReviewSummary.batting_team_id)} by ${wicketsLeft} wicket${wicketsLeft === 1 ? '' : 's'}`
    }

    if (secondReviewSummary.runs < target - 1) {
      const margin = target - 1 - secondReviewSummary.runs
      return `${reviewTeamName(firstReviewSummary.batting_team_id)} by ${margin} run${margin === 1 ? '' : 's'}`
    }

    return 'Tie'
  })()
  const finalReviewWarnings = [
    allLiveEvents.length === 0 ? 'No balls have been recorded.' : null,
    !hasMatchDaySquads ? 'Match day squads have not been saved for both teams.' : null,
    !firstReviewSummary ? 'First innings is missing.' : null,
    !secondReviewSummary ? 'Second innings is missing.' : null,
    !matchOvers || Number(matchOvers) <= 0 ? 'Match overs per side is missing or invalid.' : null,
    reviewWicketEvents.some((event) =>
      (event.wicket_type === 'caught' || event.wicket_type === 'run_out' || event.wicket_type === 'stumped') &&
      !event.fielder_player_id,
    )
      ? 'Some caught/run out/stumped wickets do not have a fielder selected.'
      : null,
  ].filter((warning): warning is string => Boolean(warning))

  const swapStrike = () => {
    setStrikerPlayerId(nonStrikerPlayerId || '')
    setNonStrikerPlayerId(strikerPlayerId || '')
  }

  return (
    <div className={`live-scorer-page${effectiveScorerPanel === 'score' ? ' live-scorer-page--score' : ''}${effectiveScorerPanel === 'commentary' ? ' live-scorer-page--commentary' : ''}`}>
      <style>{`
        .live-scorer-page {
          display: grid;
          gap: 1rem;
        }
        .live-scorer-sticky {
          position: sticky;
          top: 0.75rem;
          z-index: 10;
          border: 1px solid color-mix(in srgb, var(--color-primary, #111827) 18%, transparent);
          border-radius: 1.25rem;
          background: linear-gradient(135deg, var(--color-deep-maroon), #4a1118);
          color: #ffffff;
          box-shadow: 0 16px 38px rgba(32, 0, 1, 0.22);
          padding: 0.85rem;
          backdrop-filter: blur(12px);
        }
        .live-scorer-sticky__top {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.75rem;
          align-items: center;
        }
        .live-scorer-score {
          color: #ffffff;
          font-size: clamp(1.55rem, 6vw, 2.45rem);
          font-weight: 900;
          letter-spacing: -0.04em;
          line-height: 1;
        }
        .live-scorer-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          margin-top: 0.55rem;
        }
        .live-scorer-chip {
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 999px;
          color: #ffffff;
          padding: 0.3rem 0.55rem;
          font-size: 0.84rem;
          background: rgba(255, 255, 255, 0.1);
        }
        .live-scorer-tabs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
          gap: 0.45rem;
          margin-top: 0.75rem;
        }
        .live-scorer-tab {
          min-height: 3rem;
          border-radius: 1rem;
          border: 1px solid var(--npl-neutral-500);
          background: var(--npl-surface-raised);
          color: var(--color-deep-maroon);
          cursor: pointer;
          padding: 0.45rem;
          text-align: center;
        }
        .live-scorer-tab strong, .live-scorer-tab span {
          display: block;
          line-height: 1.15;
        }
        .live-scorer-tab span {
          margin-top: 0.15rem;
          color: #475569;
          font-size: 0.72rem;
          opacity: 1;
        }
        .live-scorer-tab.is-active {
          background: var(--color-rust-orange);
          border-color: var(--color-rust-orange);
          color: #ffffff;
        }
        .live-scorer-tab.is-active span {
          color: var(--npl-text-inverse);
        }
        .live-scorer-tab[aria-selected='true'] strong {
          text-decoration: underline;
          text-decoration-thickness: 0.12em;
          text-underline-offset: 0.18em;
        }
        .live-scorer-tab.is-complete,
        .live-scorer-tab.is-complete:hover {
          background: #15803d;
          border-color: #15803d;
          color: #ffffff;
        }
        .live-scorer-tab.is-complete span {
          color: #ffffff;
        }
        .live-scorer-lock-banner {
          align-items: center;
          background: rgba(229, 139, 27, 0.13);
          border: 1px solid rgba(229, 139, 27, 0.45);
          border-radius: 14px;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
          margin: 1rem 0;
          padding: 1rem;
        }
        .live-scorer-lock-banner p {
          margin: 0.25rem 0 0;
        }
        .live-scorer-lock-banner__title {
          align-items: center;
          display: flex;
          gap: 0.5rem;
        }
        .live-scorer-sync-banner {
          align-items: center;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.34);
          border-radius: 14px;
          display: flex;
          gap: 0.75rem;
          justify-content: space-between;
          margin: 1rem 0;
          padding: 0.75rem 1rem;
        }
        .live-scorer-sync-banner--offline,
        .live-scorer-sync-banner--retry {
          background: rgba(229, 139, 27, 0.13);
          border-color: rgba(229, 139, 27, 0.45);
        }
        .live-scorer-sync-banner__copy {
          align-items: center;
          display: flex;
          gap: 0.55rem;
        }
        .live-scorer-sync-banner p {
          margin: 0.15rem 0 0;
        }
        .live-scorer-page .catalog-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(86px, 1fr));
          gap: 0.5rem;
        }
        .live-scorer-page .catalog-card-grid .btn-primary,
        .live-scorer-page .catalog-card-grid .btn-ghost {
          min-height: 3.05rem;
          justify-content: center;
          text-align: center;
          white-space: normal;
        }
        .live-scorer-primary-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(280px, 0.62fr);
          gap: 1rem;
          align-items: start;
        }
        .live-scorer-cockpit {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(240px, 0.9fr);
          gap: 0.75rem;
          align-items: stretch;
          margin: 0.75rem 0 1rem;
        }
        .live-scorer-cockpit__card {
          border: 1px solid rgba(100, 116, 139, 0.25);
          border-radius: 1rem;
          background: #ffffff;
          color: #111827;
          padding: 0.85rem;
        }
        .live-scorer-cockpit__label {
          display: block;
          color: #64748b;
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .live-scorer-cockpit__main {
          display: block;
          margin-top: 0.2rem;
          font-size: clamp(1.15rem, 4vw, 1.8rem);
          font-weight: 900;
          line-height: 1.1;
        }
        .live-scorer-cockpit__sub {
          margin: 0.35rem 0 0;
          color: #475569;
        }
        .live-scorer-over-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          align-items: center;
          margin-top: 0.65rem;
        }
        .live-scorer-ball-chip {
          display: inline-grid;
          flex: 0 0 2.35rem;
          width: 2.35rem;
          height: 2.35rem;
          min-width: 2.35rem;
          min-height: 2.35rem;
          place-items: center;
          padding: 0;
          box-sizing: border-box;
          border-radius: 0.65rem;
          background: #f1f5f9;
          color: #111827;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
          line-height: 1;
          text-align: center;
        }
        .live-scorer-ball-chip--four {
          background: #dcfce7;
          color: #166534;
        }
        .live-scorer-ball-chip--six {
          background: #ede9fe;
          color: #5b21b6;
        }
        .live-scorer-ball-chip--wicket {
          background: #fee2e2;
          color: #991b1b;
        }
        .live-scorer-score-buttons {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.5rem;
        }
        .live-scorer-score-buttons .btn-primary {
          width: min(4.5rem, 100%);
          min-height: 4.5rem !important;
          aspect-ratio: 1;
          justify-self: center;
          border-radius: 999px !important;
          font-size: 1.25rem;
          font-weight: 900;
        }
        .live-scorer-score-buttons .live-scorer-quick-extra {
          min-height: 4.5rem;
          border-color: var(--npl-brand-600);
          border-radius: 999px;
          background: var(--npl-brand-50);
          color: var(--npl-brand-900);
          font-weight: 850;
        }
        .live-scorer-score-buttons .live-scorer-quick-extra:hover:not(:disabled) {
          border-color: var(--npl-brand-800);
          background: var(--npl-brand-100);
          color: var(--npl-brand-950);
        }
        .live-scorer-over-controls {
          display: grid;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
          padding: 0.75rem;
          border: 1px solid var(--npl-neutral-400);
          border-radius: 0.75rem;
          background: var(--npl-neutral-50);
        }
        .live-scorer-over-controls__head {
          display: grid;
          gap: 0.25rem;
          color: var(--npl-neutral-900);
        }
        .live-scorer-over-controls__head span {
          color: var(--npl-neutral-700);
          font-size: 0.82rem;
        }
        .live-scorer-over-controls__choices {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.5rem;
        }
        .live-scorer-over-controls .live-scorer-final-confirm {
          align-items: flex-start;
          gap: 0.5rem;
          min-height: 100%;
          margin: 0;
          padding: 0.65rem;
          border: 1px solid var(--npl-neutral-400);
          border-radius: 0.65rem;
          background: #ffffff;
          color: var(--npl-neutral-800);
          cursor: pointer;
        }
        .live-scorer-over-controls .live-scorer-final-confirm:has(input:checked) {
          border-color: var(--npl-brand-700);
          background: var(--npl-brand-50);
          color: var(--npl-brand-950);
          box-shadow: inset 0 0 0 1px var(--npl-brand-700);
        }
        .live-scorer-workspace__controls .live-scorer-over-controls input[type='radio'] {
          margin-top: 0.2rem;
          accent-color: var(--npl-brand-700);
        }
        .live-scorer-over-controls__actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem;
        }
        .live-scorer-over-controls__actions span {
          color: var(--npl-neutral-700);
          font-size: 0.82rem;
        }
        .live-scorer-over-controls__actions .btn-ghost {
          min-height: 2.5rem;
          border: 1px solid var(--npl-brand-700);
          border-radius: 999px;
          background: #ffffff;
          color: var(--npl-brand-950);
          font-weight: 850;
        }
        .live-scorer-over-controls__actions .btn-ghost:hover:not(:disabled),
        .live-scorer-over-controls__actions .btn-ghost:focus-visible {
          border-color: var(--npl-brand-900);
          background: var(--npl-brand-100);
          color: var(--npl-brand-950);
        }
        @media (min-width: 768px) {
          .live-scorer-over-controls__choices {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        .live-scorer-short-run {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          align-items: end;
          gap: 0.5rem;
          margin-top: 0.75rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid rgba(252, 252, 252, 0.22);
        }
        .live-scorer-short-run__title {
          padding-bottom: 0.6rem;
          color: var(--npl-text-muted);
          font-size: 0.78rem;
          font-weight: 850;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .live-scorer-short-run .inline-edit__field {
          margin: 0;
        }
        .live-scorer-short-run .btn-ghost {
          min-height: 2.7rem;
          white-space: nowrap;
        }
        .live-scorer-record-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
          align-items: stretch;
        }
        .live-scorer-commentary {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          min-height: 0;
        }
        .live-scorer-commentary textarea.inline-edit__control {
          height: 100%;
          min-height: 0;
        }
        .live-scorer-commentary .inline-edit__label {
          font-size: 1.05rem !important;
          font-weight: 800;
        }
        .live-scorer-quick-actions {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 0.5rem;
          margin-top: 0.75rem;
        }
        .live-scorer-quick-actions .btn-ghost,
        .live-scorer-extras-panel .btn-ghost {
          background: var(--color-white) !important;
          border-color: rgba(32, 0, 1, 0.28) !important;
          color: var(--color-deep-maroon) !important;
          border-radius: 999px !important;
        }
        .live-scorer-quick-actions .btn-ghost:hover,
        .live-scorer-extras-panel .btn-ghost:hover {
          background: #ffffff !important;
          border-color: var(--color-rust-orange) !important;
          color: var(--color-rust-orange) !important;
        }
        .live-scorer-quick-actions .btn-ghost.is-active,
        .live-scorer-quick-actions .btn-ghost.is-active:hover {
          border-color: var(--npl-brand-700) !important;
          background: var(--npl-brand-100) !important;
          color: var(--npl-brand-900) !important;
          box-shadow: inset 0 -3px var(--npl-brand-700);
        }
        .live-scorer-quick-actions .live-scorer-wicket-action,
        .live-scorer-quick-actions .live-scorer-wicket-action:hover {
          background: #c62828 !important;
          border-color: #c62828 !important;
          color: #ffffff !important;
        }
        .live-scorer-extras-panel .live-scorer-no-ball-only,
        .live-scorer-extras-panel .live-scorer-no-ball-only:hover {
          background: #c62828 !important;
          border-color: #c62828 !important;
          color: #ffffff !important;
        }
        .live-scorer-extras-panel .live-scorer-no-ball-bat,
        .live-scorer-extras-panel .live-scorer-no-ball-bat:hover {
          background: #6d28d9 !important;
          border-color: #6d28d9 !important;
          color: #ffffff !important;
        }
        .live-scorer-extras-panel .live-scorer-no-ball-extras,
        .live-scorer-extras-panel .live-scorer-no-ball-extras:hover {
          background: #1d4ed8 !important;
          border-color: #1d4ed8 !important;
          color: #ffffff !important;
        }
        .live-scorer-quick-actions .btn-ghost:disabled,
        .live-scorer-extras-panel .btn-ghost:disabled {
          opacity: 0.48;
        }
        .live-scorer-match-actions {
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(252, 252, 252, 0.12);
        }
        .live-scorer-match-actions .live-scorer-refresh-action,
        .live-scorer-match-actions .live-scorer-refresh-action:hover {
          background: #15803d !important;
          border-color: #15803d !important;
          color: #ffffff !important;
        }
        .live-scorer-match-actions .live-scorer-abandon-action,
        .live-scorer-match-actions .live-scorer-abandon-action:hover {
          background: #c62828 !important;
          border-color: #c62828 !important;
          color: #ffffff !important;
        }
        .live-scorer-innings-complete {
          background: #ecfdf5;
          border-color: rgba(21, 128, 61, 0.35);
          color: #166534;
          font-weight: 800;
        }
        .live-scorer-warning-list {
          margin: 0.75rem 0;
          display: grid;
          gap: 0.4rem;
        }
        .live-scorer-warning {
          border: 1px solid rgba(234, 88, 12, 0.35);
          border-radius: 0.85rem;
          background: #fff7ed;
          color: #9a3412;
          padding: 0.55rem 0.7rem;
          font-weight: 700;
        }
        .live-scorer-page .inline-edit__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          align-items: start;
          gap: 0.75rem;
        }
        .live-scorer-page .inline-edit__field {
          display: grid;
          min-width: 0;
          gap: 0.3rem;
        }
        .live-scorer-page .inline-edit__control {
          width: 100%;
          max-width: none;
          margin-left: 0;
        }
        .live-scorer-conditions {
          margin: 1rem 0;
          padding: 1rem;
          border: 1px solid rgba(14, 116, 144, 0.28);
          border-radius: 1rem;
          background: #ecfeff;
          color: #164e63;
        }
        .live-scorer-conditions__head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem 1rem;
          margin-bottom: 0.85rem;
        }
        .live-scorer-conditions.is-collapsed .live-scorer-conditions__head {
          margin-bottom: 0;
        }
        .live-scorer-conditions__summary {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem 0.85rem;
          margin-top: 0.25rem;
          font-weight: 750;
        }
        .live-scorer-conditions__head h3,
        .live-scorer-conditions__head p {
          margin: 0;
        }
        .live-scorer-conditions__head p {
          margin-top: 0.2rem;
        }
        .live-scorer-conditions__actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 0.55rem;
        }
        .live-scorer-conditions .inline-edit__control {
          background: #ffffff;
          color: #111827;
        }
        .live-scorer-conditions__par {
          display: flex;
          align-items: center;
          font-weight: 800;
        }
        .live-scorer-reset {
          border-color: rgba(220, 38, 38, 0.45) !important;
          color: #b91c1c !important;
        }
        .live-scorer-review-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
        }
        .live-scorer-review-card {
          border: 1px solid rgba(100, 116, 139, 0.25);
          border-radius: 1rem;
          background: #ffffff;
          color: #111827;
          padding: 0.85rem;
        }
        .live-scorer-review-card strong {
          display: block;
          margin-bottom: 0.3rem;
        }
        .live-scorer-checklist {
          display: grid;
          gap: 0.45rem;
          margin: 0.75rem 0;
        }
        .live-scorer-checklist li {
          margin-left: 1.1rem;
        }
        .live-scorer-final-confirm {
          display: flex;
          gap: 0.6rem;
          align-items: flex-start;
          margin: 1rem 0;
          color: #ffffff;
          font-weight: 800;
        }
        .live-scorer-final-confirm input {
          margin-top: 0.2rem;
        }
        .live-scorer-help-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 0.75rem;
        }
        .live-scorer-workspace {
          display: grid;
          grid-template-columns: minmax(0, 1.75fr) minmax(300px, 0.9fr);
          gap: 0;
          min-height: 0;
          margin-top: 0.6rem;
          overflow: hidden;
          border: 1px solid rgba(32, 0, 1, 0.18);
          border-radius: 1.2rem;
          background: #ffffff;
          box-shadow: 0 16px 38px rgba(32, 0, 1, 0.1);
        }
        .live-scorer-workspace__controls {
          min-width: 0;
          padding: 1rem;
          color: var(--npl-neutral-900);
        }
        .live-scorer-workspace__controls .team-hub-section__title,
        .live-scorer-workspace__controls .inline-edit__label,
        .live-scorer-workspace__controls h4 {
          color: var(--npl-brand-950) !important;
        }
        .live-scorer-workspace__controls .muted {
          color: var(--npl-text-muted) !important;
        }
        .live-scorer-workspace__controls .live-scorer-final-confirm {
          color: var(--npl-neutral-700);
        }
        .live-scorer-workspace__controls input[type='checkbox'] {
          accent-color: var(--npl-brand-600);
        }
        .live-scorer-mini-sheet {
          overflow: hidden;
          border: 1px solid var(--npl-neutral-500);
          border-radius: 1rem;
          background: var(--npl-surface-raised);
          color: var(--npl-neutral-900);
        }
        .live-scorer-mini-sheet__topline {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 0.65rem;
          background: var(--npl-brand-950);
          color: var(--npl-text-inverse);
          padding: 0.55rem 0.7rem;
          font-size: 0.74rem;
          font-weight: 800;
        }
        .live-scorer-mini-sheet__topline > span:last-child {
          text-align: right;
        }
        .live-scorer-mini-sheet__topline i {
          display: inline-block;
          width: 0.48rem;
          height: 0.48rem;
          margin-right: 0.35rem;
          border-radius: 50%;
          background: var(--npl-success-600);
          box-shadow: 0 0 0 0.18rem rgba(20, 122, 67, 0.28);
        }
        .live-scorer-mini-sheet__teams {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          border-bottom: 1px solid var(--npl-neutral-300);
          background: var(--npl-neutral-100);
        }
        .live-scorer-mini-sheet__teams > div {
          min-width: 0;
          padding: 0.55rem 0.7rem;
          border-left: 4px solid transparent;
        }
        .live-scorer-mini-sheet__teams > div + div {
          border-inline-start: 1px solid var(--npl-neutral-300);
        }
        .live-scorer-mini-sheet__teams > div.is-active {
          border-left-color: var(--npl-brand-600);
          background: var(--npl-brand-50);
        }
        .live-scorer-mini-sheet__teams span,
        .live-scorer-mini-sheet__teams strong {
          display: block;
        }
        .live-scorer-mini-sheet__teams span {
          color: var(--npl-neutral-600);
          font-size: 0.68rem;
          font-weight: 850;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .live-scorer-mini-sheet__teams strong {
          overflow: hidden;
          margin-top: 0.15rem;
          color: var(--npl-brand-950);
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .live-scorer-mini-sheet__total {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          border-bottom: 1px solid var(--npl-neutral-300);
        }
        .live-scorer-mini-sheet__total > div:first-child {
          display: flex;
          align-items: baseline;
          gap: 0.55rem;
        }
        .live-scorer-mini-sheet__total > div:first-child strong {
          color: var(--npl-brand-950);
          font-size: 2rem;
          line-height: 1;
        }
        .live-scorer-mini-sheet__total > div:first-child span,
        .live-scorer-mini-sheet__total > div:last-child span,
        .live-scorer-mini-sheet__total > div:last-child small {
          display: block;
          color: var(--npl-neutral-600);
          font-size: 0.72rem;
        }
        .live-scorer-mini-sheet__total > div:last-child {
          text-align: right;
        }
        .live-scorer-mini-sheet__total > div:last-child strong {
          color: var(--npl-brand-950);
          font-size: 1.1rem;
        }
        .live-scorer-mini-table {
          max-width: 100%;
          overflow-x: auto;
        }
        .live-scorer-mini-table table {
          width: 100%;
          min-width: 34rem;
          border-collapse: collapse;
          font-size: 0.76rem;
        }
        .live-scorer-mini-table th,
        .live-scorer-mini-table td {
          border-bottom: 1px solid var(--npl-neutral-300);
          padding: 0.48rem 0.55rem;
          text-align: right;
          white-space: nowrap;
        }
        .live-scorer-mini-table th:first-child,
        .live-scorer-mini-table td:first-child {
          text-align: left;
        }
        .live-scorer-mini-table thead th {
          background: var(--npl-neutral-100);
          color: var(--npl-neutral-700);
          font-size: 0.68rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .live-scorer-mini-table tbody th {
          color: var(--npl-brand-950);
        }
        .live-scorer-mini-table tbody tr.is-active {
          background: var(--npl-brand-50);
          box-shadow: inset 4px 0 var(--npl-brand-600);
        }
        .live-scorer-mini-sheet__summary {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          border-bottom: 1px solid var(--npl-neutral-300);
          background: var(--npl-neutral-100);
        }
        .live-scorer-mini-sheet__summary > span {
          padding: 0.55rem 0.7rem;
          color: var(--npl-neutral-700);
          font-size: 0.78rem;
        }
        .live-scorer-mini-sheet__summary > span + span {
          border-inline-start: 1px solid var(--npl-neutral-300);
        }
        .live-scorer-mini-sheet__summary strong {
          color: var(--npl-brand-950);
        }
        .live-scorer-mini-sheet__summary small {
          display: block;
          margin-top: 0.15rem;
          color: var(--npl-neutral-600);
        }
        .live-scorer-mini-sheet__over {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr);
          gap: 0.65rem;
          background: var(--npl-brand-900);
          color: var(--npl-text-inverse);
          padding: 0.65rem 0.7rem;
        }
        .live-scorer-mini-sheet__over span,
        .live-scorer-mini-sheet__over strong {
          display: block;
        }
        .live-scorer-mini-sheet__over > div > span {
          color: var(--npl-neutral-300);
          font-size: 0.68rem;
          font-weight: 850;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .live-scorer-mini-sheet__over strong {
          margin-top: 0.15rem;
          font-size: 0.82rem;
        }
        .live-scorer-mini-sheet__over .live-scorer-over-strip {
          margin-top: 0.3rem;
        }
        .live-scorer-player-controls {
          margin-top: 0.65rem;
          border: 1px solid var(--npl-neutral-500);
          border-radius: 0.85rem;
          background: var(--npl-neutral-100);
          color: var(--npl-neutral-900);
          padding: 0.65rem 0.75rem;
        }
        .live-scorer-player-controls summary {
          color: var(--npl-brand-950);
          cursor: pointer;
          font-weight: 850;
        }
        .live-scorer-player-controls > p {
          color: var(--npl-neutral-600);
          font-size: 0.78rem;
        }
        .live-scorer-player-controls .inline-edit__label {
          color: var(--npl-brand-950) !important;
        }
        .live-scorer-ball-panel {
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 0;
          border-left: 1px solid rgba(32, 0, 1, 0.16);
          border-radius: 0;
          background: #f8fafc;
          color: #111827;
        }
        .live-scorer-ball-panel__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.65rem;
          padding: 0.65rem 0.75rem;
          border-bottom: 1px solid rgba(32, 0, 1, 0.16);
          background: #efe7dd;
        }
        .live-scorer-ball-panel__head strong,
        .live-scorer-ball-panel__head span {
          display: block;
        }
        .live-scorer-ball-panel__head span {
          margin-top: 0.1rem;
          color: var(--npl-neutral-700);
          font-size: 0.74rem;
        }
        .live-scorer-ball-panel__head .btn-ghost {
          min-height: 2.35rem;
          padding: 0.35rem 0.55rem;
        }
        .live-scorer-conditions .btn-ghost,
        .live-scorer-ball-panel__head .btn-ghost,
        .live-commentary-editor .btn-ghost,
        .live-scorer-dialog .btn-ghost {
          border-color: var(--npl-neutral-500);
          background: var(--npl-surface-raised);
          color: var(--npl-neutral-800);
        }
        .live-scorer-conditions .btn-ghost:hover:not(:disabled),
        .live-scorer-ball-panel__head .btn-ghost:hover:not(:disabled),
        .live-commentary-editor .btn-ghost:hover:not(:disabled),
        .live-scorer-dialog .btn-ghost:hover:not(:disabled) {
          border-color: var(--npl-brand-600);
          background: var(--npl-brand-50);
          color: var(--npl-brand-800);
        }
        .live-scorer-conditions .btn-ghost:disabled,
        .live-scorer-ball-panel__head .btn-ghost:disabled,
        .live-commentary-editor .btn-ghost:disabled,
        .live-scorer-dialog .btn-ghost:disabled {
          border-color: var(--npl-neutral-400);
          background: var(--npl-neutral-100);
          color: var(--npl-neutral-600);
          cursor: not-allowed;
        }
        .live-scorer-page .btn-primary:disabled {
          border-color: var(--npl-neutral-500);
          background: var(--npl-neutral-300);
          color: var(--npl-neutral-700);
          cursor: not-allowed;
        }
        .live-scorer-ball-panel__list {
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        .live-scorer-ball-panel__event {
          width: 100%;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 0.6rem;
          border: 0;
          border-bottom: 1px solid rgba(100, 116, 139, 0.18);
          background: #ffffff;
          color: #111827;
          padding: 0.62rem 0.7rem;
          text-align: left;
          cursor: pointer;
        }
        .live-scorer-ball-panel__event:hover,
        .live-scorer-ball-panel__event:focus-visible {
          background: #f1f5f9;
        }
        .live-scorer-ball-panel__event-copy,
        .live-scorer-ball-panel__event-copy strong,
        .live-scorer-ball-panel__event-copy span,
        .live-scorer-ball-panel__event-copy small {
          display: block;
          min-width: 0;
        }
        .live-scorer-ball-panel__event-copy strong,
        .live-scorer-ball-panel__event-copy span,
        .live-scorer-ball-panel__event-copy small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .live-scorer-ball-panel__event-copy strong {
          font-size: 0.8rem;
        }
        .live-scorer-ball-panel__event-copy span,
        .live-scorer-ball-panel__event-copy small {
          margin-top: 0.12rem;
          color: #64748b;
          font-size: 0.72rem;
        }
        .live-scorer-ball-panel__over-summary {
          display: grid;
          gap: 0.45rem;
          padding: 0.65rem 0.7rem;
          border-bottom: 1px solid rgba(100, 116, 139, 0.22);
          background: #eaf3ff;
          color: #172554;
        }
        .live-scorer-ball-panel__over-summary-head,
        .live-scorer-ball-panel__over-summary-meta,
        .live-scorer-ball-panel__over-summary-bowler {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }
        .live-scorer-ball-panel__over-summary-head span,
        .live-scorer-ball-panel__over-summary-bowler span:first-child {
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .live-scorer-ball-panel__over-summary-head strong {
          font-size: 0.82rem;
          text-align: right;
        }
        .live-scorer-ball-panel__over-summary-meta {
          color: #334155;
          font-size: 0.74rem;
          font-weight: 750;
          justify-content: flex-start;
        }
        .live-scorer-ball-panel__over-summary-batters {
          display: grid;
          gap: 0.2rem;
        }
        .live-scorer-ball-panel__over-summary-batter {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.5rem;
          font-size: 0.76rem;
        }
        .live-scorer-ball-panel__over-summary-batter span {
          white-space: nowrap;
        }
        .live-scorer-ball-panel__over-summary-batter strong {
          white-space: nowrap;
        }
        .live-scorer-ball-panel__over-summary-bowler-inline {
          text-align: right;
          font-size: 0.74rem;
        }
        .live-commentary-workspace {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(400px, 0.95fr);
          gap: 1rem;
          align-items: start;
        }
        .live-commentary-editor,
        .live-commentary-scorecard {
          overflow: hidden;
          border: 1px solid rgba(32, 0, 1, 0.18);
          border-radius: 1.2rem;
          background: #ffffff;
          color: #23171a;
          box-shadow: 0 16px 38px rgba(32, 0, 1, 0.09);
        }
        .live-commentary-editor {
          padding: 1rem;
        }
        .live-commentary-editor__head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          padding-bottom: 0.9rem;
          border-bottom: 1px solid #eadfd4;
        }
        .live-commentary-editor__head h2,
        .live-commentary-editor__head p {
          margin: 0;
        }
        .live-commentary-editor__head h2 {
          margin-top: 0.15rem;
          color: var(--color-deep-maroon);
          font-size: 1.35rem;
        }
        .live-commentary-editor__head p {
          margin-top: 0.35rem;
          color: #6d5b5e;
          font-size: 0.88rem;
        }
        .live-commentary-kicker {
          color: var(--color-rust-orange);
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .live-commentary-live-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          border-radius: 999px;
          background: #fff1eb;
          color: #a33719;
          padding: 0.35rem 0.55rem;
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.08em;
        }
        .live-commentary-live-pill span {
          width: 0.45rem;
          height: 0.45rem;
          border-radius: 50%;
          background: #dc2626;
          box-shadow: 0 0 0 0.22rem rgba(220, 38, 38, 0.13);
        }
        .live-commentary-context {
          display: grid;
          grid-template-columns: 0.65fr 1.65fr 1fr 0.8fr;
          gap: 0.5rem;
          margin: 0.9rem 0;
        }
        .live-commentary-context > div {
          min-width: 0;
          border-radius: 0.8rem;
          background: #f5efe8;
          padding: 0.65rem;
        }
        .live-commentary-context span,
        .live-commentary-context strong {
          display: block;
        }
        .live-commentary-context span {
          color: var(--npl-neutral-600);
          font-size: 0.66rem;
          font-weight: 850;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .live-commentary-context strong {
          margin-top: 0.2rem;
          overflow: hidden;
          color: var(--color-deep-maroon);
          font-size: 0.82rem;
          text-overflow: ellipsis;
        }
        .live-commentary-field {
          display: grid;
          gap: 0.4rem;
        }
        .live-commentary-field > span {
          color: var(--color-deep-maroon);
          font-weight: 850;
        }
        .live-commentary-field textarea {
          width: 100%;
          min-height: 9.5rem;
          resize: vertical;
          border: 1px solid var(--npl-neutral-500);
          border-radius: 0.9rem;
          background: #fffdf9;
          color: #23171a;
          padding: 0.8rem;
          font: inherit;
          line-height: 1.55;
        }
        .live-commentary-field textarea:focus {
          border-color: var(--color-rust-orange);
          outline: 3px solid color-mix(in srgb, var(--color-rust-orange) 20%, transparent);
        }
        .live-commentary-field small {
          justify-self: end;
          color: var(--npl-neutral-600);
        }
        .live-commentary-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
          margin-top: 0.75rem;
        }
        .live-commentary-public-preview {
          margin-top: 0.9rem;
          border-left: 4px solid var(--color-rust-orange);
          background: #fff7ef;
          padding: 0.75rem 0.85rem;
        }
        .live-commentary-public-preview span {
          color: var(--npl-neutral-600);
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .live-commentary-public-preview p {
          margin: 0.25rem 0 0;
          line-height: 1.55;
        }
        .live-commentary-empty {
          margin-block: 1rem;
          border: 1px dashed rgba(32, 0, 1, 0.3);
          border-radius: 0.9rem;
          padding: 1.25rem;
          text-align: center;
        }
        .live-commentary-empty p {
          margin: 0.25rem 0 0;
          color: var(--npl-neutral-600);
        }
        .live-commentary-feed-picker {
          margin-top: 1rem;
          border-top: 1px solid #eadfd4;
          padding-top: 0.9rem;
        }
        .live-commentary-feed-picker__head {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 0.55rem;
          color: var(--color-deep-maroon);
        }
        .live-commentary-feed-picker__head span {
          color: var(--npl-neutral-600);
          font-size: 0.78rem;
        }
        .live-commentary-feed-picker__list {
          display: grid;
          max-height: 20rem;
          overflow-y: auto;
          border: 1px solid var(--npl-neutral-500);
          border-radius: 0.85rem;
        }
        .live-commentary-feed-picker__list > button {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.65rem;
          align-items: center;
          border: 0;
          border-bottom: 1px solid #eadfd4;
          background: #ffffff;
          color: #23171a;
          padding: 0.65rem;
          text-align: left;
          cursor: pointer;
        }
        .live-commentary-feed-picker__list > button:last-child {
          border-bottom: 0;
        }
        .live-commentary-feed-picker__list > button.is-selected {
          background: #fff2e8;
          box-shadow: inset 4px 0 var(--color-rust-orange);
        }
        .live-commentary-feed-picker__list strong,
        .live-commentary-feed-picker__list small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .live-commentary-feed-picker__list strong {
          color: var(--color-deep-maroon);
          font-size: 0.8rem;
        }
        .live-commentary-feed-picker__list small {
          margin-top: 0.15rem;
          color: var(--npl-neutral-600);
          font-size: 0.73rem;
        }
        .live-commentary-scorecard {
          position: sticky;
          top: 12rem;
        }
        .live-commentary-scorecard__hero {
          background: linear-gradient(135deg, var(--color-deep-maroon), #4a1118);
          color: #ffffff;
          padding: 1rem;
        }
        .live-commentary-scorecard__hero span {
          font-size: 0.7rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .live-commentary-scorecard__hero strong {
          display: block;
          margin-top: 0.3rem;
          font-size: 2.2rem;
          line-height: 1;
        }
        .live-commentary-scorecard__hero p {
          margin: 0.35rem 0 0;
          color: #f4ded7;
        }
        .live-commentary-scorecard__section {
          padding: 0.8rem;
          border-bottom: 1px solid #eadfd4;
        }
        .live-commentary-scorecard__section:last-child {
          border-bottom: 0;
        }
        .live-commentary-scorecard__section h3 {
          margin: 0 0 0.55rem;
          color: var(--color-deep-maroon);
          font-size: 0.82rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .live-commentary-scorecard table {
          width: 100%;
          min-width: 560px;
          border-collapse: collapse;
          font-size: 0.72rem;
        }
        .live-commentary-scorecard th,
        .live-commentary-scorecard td {
          border-bottom: 1px solid #efe7dd;
          padding: 0.45rem 0.4rem;
          text-align: right;
          white-space: nowrap;
        }
        .live-commentary-scorecard th:first-child,
        .live-commentary-scorecard td:first-child,
        .live-commentary-scorecard th:nth-child(2),
        .live-commentary-scorecard td:nth-child(2) {
          text-align: left;
        }
        .live-commentary-scorecard thead th {
          background: #f5efe8;
          color: #6f5c60;
          font-size: 0.65rem;
          text-transform: uppercase;
        }
        .live-commentary-scorecard tfoot tr:last-child {
          background: #fff2e8;
          color: var(--color-deep-maroon);
        }
        .live-commentary-fow {
          margin: 0.7rem 0 0;
          color: #6f5c60;
          font-size: 0.74rem;
          line-height: 1.5;
        }
        .live-match-photo-workspace {
          display: grid;
          gap: 1rem;
        }
        .live-match-photo-upload {
          display: grid;
          grid-template-columns: minmax(14rem, 1fr) minmax(17rem, 1.2fr) auto;
          gap: 0.8rem;
          align-items: end;
          padding: 1rem;
          border: 1px solid var(--npl-neutral-300);
          border-radius: 1rem;
          background: var(--npl-neutral-50);
        }
        .live-match-photo-upload .inline-edit__label {
          color: var(--npl-neutral-900);
          font-weight: 800;
        }
        .live-match-photo-upload .inline-edit__control {
          min-height: 3.2rem;
          border-color: #8b716f;
          background: #ffffff;
          color: var(--npl-brand-950);
        }
        .live-match-photo-upload .inline-edit__control::placeholder {
          color: #65575a;
          opacity: 1;
        }
        .live-match-photo-upload .inline-edit__control:focus-visible {
          border-color: var(--color-rust-orange);
          outline: 3px solid rgba(216, 108, 24, 0.28);
          outline-offset: 2px;
        }
        .live-match-photo-picker {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          min-height: 3.2rem;
          padding: 0.7rem 0.85rem;
          border: 1.5px dashed #9a6b61;
          border-radius: 0.75rem;
          background: #fffaf5;
          color: var(--color-deep-maroon);
          cursor: pointer;
        }
        .live-match-photo-picker:hover,
        .live-match-photo-picker:focus-within {
          border-color: var(--color-rust-orange);
          background: #fff1e6;
        }
        .live-match-photo-picker strong,
        .live-match-photo-picker small {
          display: block;
        }
        .live-match-photo-picker small {
          margin-top: 0.15rem;
          color: #5f5255;
        }
        .live-match-photo-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
          gap: 0.8rem;
        }
        .live-match-photo-list article {
          overflow: hidden;
          border: 1px solid var(--npl-neutral-300);
          border-radius: 0.85rem;
          background: #fff;
        }
        .live-match-photo-list img {
          display: block;
          width: 100%;
          aspect-ratio: 4 / 3;
          object-fit: cover;
          background: var(--npl-neutral-100);
        }
        .live-match-photo-list article > div {
          display: grid;
          gap: 0.2rem;
          padding: 0.7rem;
        }
        .live-match-photo-list article strong {
          color: var(--npl-brand-950);
        }
        .live-match-photo-list article small {
          color: #166534;
          font-weight: 800;
        }
        .live-scorer-dialog-backdrop {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: grid;
          place-items: center;
          padding: 1rem;
          background: rgba(2, 6, 23, 0.72);
          backdrop-filter: blur(6px);
        }
        .live-scorer-dialog {
          width: min(900px, 100%);
          max-height: calc(100dvh - 2rem);
          overflow-y: auto;
          border: 1px solid rgba(100, 116, 139, 0.35);
          border-radius: 1.1rem;
          background: #ffffff;
          color: #111827;
          box-shadow: 0 28px 80px rgba(2, 6, 23, 0.42);
          padding: 1rem;
        }
        .live-scorer-dialog > .team-hub-section-head:first-child {
          margin-bottom: 0.85rem;
        }
        .live-scorer-dialog--extras {
          width: min(1080px, 100%);
        }
        .live-scorer-extras-panel {
          display: grid;
          gap: 1rem;
        }
        .live-scorer-extras-panel .team-hub-section {
          margin-top: 0 !important;
        }
        .live-scorer-extras-panel .catalog-card-grid {
          grid-template-columns: repeat(auto-fit, minmax(128px, 1fr));
        }
        .live-scorer-extras-panel .live-scorer-byes-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .live-scorer-wicket-actions {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(100, 116, 139, 0.22);
        }
        @media (min-width: 768px) {
          .live-scorer-extras-panel .live-scorer-byes-grid {
            grid-template-columns: repeat(8, minmax(0, 1fr));
          }
        }
        .live-scorer-dialog--bowler-change .live-scorer-dialog__actions {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(100, 116, 139, 0.22);
        }
        .live-scorer-over-summary {
          margin: 0 0 1rem;
          overflow: hidden;
          border: 1px solid rgba(30, 64, 175, 0.28);
          border-radius: 0.85rem;
          background: #eff6ff;
        }
        .live-scorer-over-summary__headline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.75rem 0.9rem;
          background: #dbeafe;
          color: #172554;
          font-weight: 900;
        }
        .live-scorer-over-summary__headline span {
          font-size: 0.76rem;
          letter-spacing: 0.1em;
        }
        .live-scorer-over-summary__headline strong {
          text-align: right;
        }
        .live-scorer-over-summary__meta {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
          padding: 0.7rem 0.9rem;
          border-bottom: 1px solid rgba(30, 64, 175, 0.16);
          color: #334155;
          font-size: 0.9rem;
          font-weight: 750;
        }
        .live-scorer-over-summary__details {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(180px, 0.72fr);
          gap: 1rem;
          padding: 0.8rem 0.9rem;
        }
        .live-scorer-over-summary__batters {
          display: grid;
          gap: 0.45rem;
        }
        .live-scorer-over-summary__batters-header {
          color: #475569;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.08em;
        }
        .live-scorer-over-summary__batter {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          color: #172554;
          font-size: 0.94rem;
        }
        .live-scorer-over-summary__batter strong {
          white-space: nowrap;
        }
        .live-scorer-over-summary__bowler {
          display: grid;
          grid-template-columns: minmax(0, 1fr) repeat(4, minmax(1.6rem, auto));
          align-items: center;
          column-gap: 0.6rem;
          row-gap: 0.45rem;
          border-left: 1px solid rgba(30, 64, 175, 0.22);
          padding-left: 1rem;
          color: #172554;
        }
        .live-scorer-over-summary__bowler-header {
          color: #475569;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-align: center;
        }
        .live-scorer-over-summary__bowler-name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .live-scorer-over-summary__bowler-figure {
          text-align: center;
          white-space: nowrap;
        }
        @media (max-width: 640px) {
          .live-scorer-over-summary__details { grid-template-columns: 1fr; }
          .live-scorer-over-summary__bowler { border-left: 0; border-top: 1px solid rgba(30, 64, 175, 0.22); padding: 0.75rem 0 0; }
        }
        .live-scorer-dialog__close {
          min-height: 2.5rem;
          min-width: 2.5rem;
          justify-content: center;
          padding: 0.35rem;
        }
        .live-scorer-dialog__how-out {
          grid-column: 1 / -1;
        }
        .live-scorer-no-delivery {
          display: flex;
          align-items: center;
          background: #ecfdf5;
          border-color: rgba(21, 128, 61, 0.35);
          color: #166534;
          font-weight: 800;
        }
        .live-scorer-retire-action,
        .live-scorer-retire-action:hover {
          background: #b45309 !important;
          border-color: #b45309 !important;
          color: #ffffff !important;
        }
        @media (min-width: 1100px) and (min-height: 700px) {
          .app-shell__content:has(.live-scorer-page--score) {
            overflow: hidden;
            padding: 0.65rem 1rem 0.8rem;
          }
          .live-scorer-page--score {
            display: flex;
            flex-direction: column;
            height: calc(100dvh - 6rem);
            max-height: calc(100dvh - 6rem);
            min-height: 0;
            gap: 0.5rem;
          }
          .live-scorer-page--score > .page-header,
          .live-scorer-page--score > .live-scorer-match-intro {
            display: none;
          }
          .live-scorer-page--score .live-scorer-sticky {
            flex: 0 0 auto;
            position: relative;
            top: auto;
            padding: 0.55rem 0.65rem;
            border-radius: 0.9rem;
          }
          .live-scorer-page--score .live-scorer-sync-banner,
          .live-scorer-page--score .live-scorer-lock-banner {
            flex: 0 0 auto;
            margin: 0;
          }
          .live-scorer-page--score .live-scorer-score {
            font-size: 1.75rem;
          }
          .live-scorer-page--score .live-scorer-meta {
            margin-top: 0.35rem;
            gap: 0.3rem;
          }
          .live-scorer-page--score .live-scorer-chip {
            padding: 0.22rem 0.45rem;
            font-size: 0.75rem;
          }
          .live-scorer-page--score .live-scorer-tabs {
            margin-top: 0.45rem;
            gap: 0.35rem;
          }
          .live-scorer-page--score .live-scorer-tab {
            min-height: 2.35rem;
            padding: 0.3rem;
            border-radius: 0.75rem;
          }
          .live-scorer-page--score .live-scorer-tab strong {
            font-size: 0.82rem;
          }
          .live-scorer-page--score .live-scorer-tab span {
            font-size: 0.65rem;
          }
          .live-scorer-score-section {
            flex: 1 1 auto;
            min-height: 0;
            margin-top: 0;
            padding-top: 0;
            border-top: 0;
            display: grid;
            grid-template-rows: auto auto minmax(0, 1fr) auto;
            overflow: hidden;
          }
          .live-scorer-score-section > .team-hub-section-head:first-child {
            display: none;
          }
          .live-scorer-score-section .live-scorer-conditions {
            margin: 0 0 0.35rem;
            padding: 0.5rem 0.65rem;
            border-radius: 0.75rem;
          }
          .live-scorer-score-section .live-scorer-conditions__head {
            margin-bottom: 0.45rem;
          }
          .live-scorer-score-section .dashboard-match-panel__tabs {
            margin-bottom: 0.35rem;
          }
          .live-scorer-workspace {
            margin-top: 0;
            overflow: hidden;
          }
          .live-scorer-workspace__controls {
            overflow-y: auto;
            overscroll-behavior: contain;
            padding-right: 0.15rem;
          }
          .live-scorer-workspace__controls > .inline-edit__grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 0.45rem;
          }
          .live-scorer-workspace__controls .inline-edit__label {
            font-size: 0.68rem;
          }
          .live-scorer-workspace__controls .inline-edit__control {
            min-height: 2.35rem;
            padding: 0.38rem 0.5rem;
          }
          .live-scorer-workspace__controls .live-scorer-cockpit {
            margin: 0.45rem 0;
            gap: 0.45rem;
          }
          .live-scorer-workspace__controls .live-scorer-cockpit__card {
            padding: 0.55rem 0.65rem;
            border-radius: 0.75rem;
          }
          .live-scorer-workspace__controls .live-scorer-cockpit__main {
            font-size: 1rem;
          }
          .live-scorer-workspace__controls .live-scorer-cockpit__sub {
            margin-top: 0.2rem;
            font-size: 0.75rem;
          }
          .live-scorer-workspace__controls .live-scorer-over-strip {
            margin-top: 0.35rem;
          }
          .live-scorer-workspace__controls .live-scorer-ball-chip,
          .live-scorer-ball-panel .live-scorer-ball-chip {
            flex-basis: 1.95rem;
            width: 1.95rem;
            height: 1.95rem;
            min-width: 1.95rem;
            min-height: 1.95rem;
            font-size: 0.76rem;
          }
          .live-scorer-workspace__controls > .team-hub-section {
            margin-top: 0.4rem !important;
            padding-top: 0.4rem;
          }
          .live-scorer-workspace__controls > .team-hub-section > .team-hub-section-head:first-child {
            margin-bottom: 0.45rem;
          }
          .live-scorer-workspace__controls > .team-hub-section > .team-hub-section-head:first-child p,
          .live-scorer-record-grid .muted {
            display: none;
          }
          .live-scorer-record-grid {
            gap: 0.55rem;
          }
          .live-scorer-score-buttons {
            gap: 0.35rem;
          }
          .live-scorer-score-buttons .btn-primary {
            min-height: 3rem !important;
            font-size: 1.05rem !important;
          }
          .live-scorer-score-buttons .live-scorer-quick-extra {
            min-height: 3rem;
            padding: 0.35rem;
            font-size: 0.76rem;
          }
          .live-scorer-short-run {
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 0.35rem;
          }
          .live-scorer-short-run__title {
            padding-bottom: 0;
          }
          .live-scorer-record-grid textarea.inline-edit__control {
            min-height: 3.5rem !important;
            height: 3.5rem;
            resize: none !important;
          }
          .live-scorer-quick-actions {
            margin-top: 0.45rem !important;
            gap: 0.35rem;
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }
          .live-scorer-quick-actions .btn-ghost {
            min-height: 2.45rem;
            padding: 0.35rem;
            font-size: 0.76rem;
          }
          .live-scorer-match-actions {
            margin-top: 0.4rem;
            padding-top: 0.4rem;
          }
          .live-scorer-match-actions .btn-primary,
          .live-scorer-match-actions .btn-ghost {
            min-height: 2.35rem;
            padding-block: 0.35rem;
          }
        }
        @media (max-width: 1099px) {
          .live-scorer-sticky {
            position: static;
          }
        }
        @media (max-width: 900px) {
          .live-scorer-primary-grid,
          .live-scorer-cockpit,
          .live-scorer-record-grid,
          .live-scorer-workspace,
          .live-commentary-workspace {
            grid-template-columns: 1fr;
          }
          .live-commentary-scorecard {
            position: static;
          }
          .live-scorer-mini-sheet__over {
            grid-template-columns: 1fr;
          }
          .live-commentary-context {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .live-match-photo-upload {
            grid-template-columns: 1fr;
            align-items: stretch;
          }
          .live-scorer-ball-panel {
            max-height: 26rem;
          }
          .live-scorer-sticky {
            top: 0.35rem;
            border-radius: 1rem;
          }
        }
        @media (max-width: 520px) {
          .live-scorer-short-run {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .live-scorer-short-run__title,
          .live-scorer-short-run .btn-ghost {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 640px) {
          .live-scorer-page {
            gap: 0.75rem;
          }
          .live-scorer-sticky {
            position: static;
          }
          .live-scorer-sticky__top {
            grid-template-columns: 1fr;
          }
          .live-scorer-tabs {
            grid-template-columns: repeat(9, minmax(58px, 1fr));
            overflow-x: auto;
            padding-bottom: 0.1rem;
          }
          .live-scorer-tab {
            min-width: 58px;
            min-height: 2.75rem;
            padding-inline: 0.25rem;
          }
          .live-scorer-tab strong {
            font-size: 0.85rem;
          }
          .live-scorer-tab span {
            display: none;
          }
          .live-scorer-page .catalog-card-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .live-scorer-mini-sheet__topline {
            grid-template-columns: 1fr auto;
          }
          .live-scorer-mini-sheet__topline > span:last-child {
            grid-column: 1 / -1;
            text-align: left;
          }
          .live-scorer-mini-sheet__summary,
          .live-scorer-mini-sheet__teams,
          .live-scorer-mini-sheet__total {
            grid-template-columns: 1fr;
          }
          .live-scorer-mini-sheet__teams > div + div,
          .live-scorer-mini-sheet__summary > span + span {
            border-inline-start: 0;
            border-top: 1px solid var(--npl-neutral-300);
          }
          .live-scorer-mini-sheet__total > div:last-child {
            text-align: left;
          }
          .live-scorer-page .catalog-toolbar {
            gap: 0.45rem;
          }
          .live-scorer-page .catalog-toolbar .btn-primary,
          .live-scorer-page .catalog-toolbar .btn-ghost {
            flex: 1 1 135px;
            justify-content: center;
          }
          .live-scorer-quick-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .live-scorer-dialog-backdrop {
            align-items: end;
            padding: 0;
          }
          .live-scorer-dialog {
            width: 100%;
            max-height: 94dvh;
            border-radius: 1.1rem 1.1rem 0 0;
          }
          .live-scorer-over-summary__headline,
          .live-scorer-ball-panel__over-summary-head,
          .live-scorer-ball-panel__over-summary-bowler {
            align-items: flex-start;
            flex-direction: column;
          }
          .live-scorer-ball-panel__over-summary-head strong,
          .live-scorer-ball-panel__over-summary-bowler-inline {
            text-align: left;
          }
          .live-commentary-editor {
            padding: 0.75rem;
          }
          .live-commentary-editor__head {
            flex-direction: column;
          }
          .live-commentary-context {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <PageHeader
        title={
          isCommentator
            ? 'Live commentary'
            : canPublishCommentary
              ? 'Live scoring & commentary'
              : 'Live scoring'
        }
        descriptionAsTooltip
        description={
          isCommentator
            ? 'Add public ball-by-ball commentary beside the live full scorecard.'
            : canPublishCommentary
              ? 'Score ball-by-ball, manage the match, and publish public commentary from one workspace.'
              : 'Score ball-by-ball and manage the match from the live scorer workspace.'
        }
        actions={<Link to="/scoring">Scoring dashboard</Link>}
      />

      <section className="team-hub-section live-scorer-match-intro">
        <div className="team-hub-section-head">
          <div className="team-hub-section-head__lead">
            <h2 className="team-hub-section__title">
              {match.title || `Match #${match.id}`}
            </h2>
            <p className="muted">
              {matchWhen(match)} · {match.venue ?? 'Venue TBC'}
            </p>
          </div>
          <StatusBadge
            status={
              match.status as
                | 'scheduled'
                | 'live'
                | 'completed'
                | 'postponed'
                | 'abandoned'
                | 'cancelled'
            }
          />
        </div>
      </section>

      {!isCommentator && liveQ.data?.scorecard_locked ? (
        <aside className="live-scorer-lock-banner" aria-live="polite">
          <div>
            <strong className="live-scorer-lock-banner__title">
              <LockKeyhole size={19} aria-hidden />
              {scorecardReadOnly
                ? 'Scorecard locked — read only'
                : 'Temporary scorecard edit access'}
            </strong>
            <p className="muted">
              {scorecardReadOnly
                ? `This scorecard locked 120 minutes after finalization (${dateTimeLabel(liveQ.data.scorecard_locks_at)}).`
                : `Super-admin approval allows edits until ${dateTimeLabel(liveQ.data.edit_access_until)}.`}
            </p>
            {liveQ.data.edit_request_status === 'denied' && liveQ.data.edit_request_decision_note ? (
              <p className="muted">Super-admin note: {liveQ.data.edit_request_decision_note}</p>
            ) : null}
          </div>
          {scorecardReadOnly && isScorer ? (
            <button
              type="button"
              className="btn-primary btn--with-icon"
              disabled={
                liveQ.data.edit_request_status === 'pending' ||
                requestEditAccessMutation.isPending
              }
              onClick={() => setRequestEditOpen(true)}
            >
              <LockKeyhole size={18} aria-hidden />
              {liveQ.data.edit_request_status === 'pending'
                ? 'Permission requested'
                : requestEditAccessMutation.isPending
                  ? 'Requesting…'
                  : 'Request edit permission'}
            </button>
          ) : null}
        </aside>
      ) : null}

      {!isCommentator && scoringSessionConflict ? (
        <aside className="live-scorer-lock-banner" aria-live="assertive">
          <div>
            <strong className="live-scorer-lock-banner__title">
              <LockKeyhole size={19} aria-hidden />
              Scoring session owned elsewhere
            </strong>
            <p className="muted">
              {liveQ.data?.scoring_session
                ? `${liveQ.data.scoring_session.owner_name} is scoring on ${liveQ.data.scoring_session.device_label ?? 'another device'}.`
                : scoringSessionQ.error instanceof Error
                  ? scoringSessionQ.error.message
                  : 'Another scoring session currently owns this match.'}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary btn--with-icon"
            disabled={takeoverSessionMutation.isPending}
            onClick={requestScoringTakeover}
          >
            <LockKeyhole size={18} aria-hidden />
            {takeoverSessionMutation.isPending ? 'Taking over…' : 'Take over scoring'}
          </button>
        </aside>
      ) : null}

      {!isCommentator ? <aside
        className={`live-scorer-sync-banner${!isOnline ? ' live-scorer-sync-banner--offline' : deliveryOutbox.length > 0 ? ' live-scorer-sync-banner--retry' : ''}`}
        aria-live="polite"
      >
        <div className="live-scorer-sync-banner__copy">
          {!isOnline ? <WifiOff size={19} aria-hidden /> : <Wifi size={19} aria-hidden />}
          <div>
            <strong>
              {!isOnline
                ? `Offline — ${deliveryOutbox.length} ${deliveryOutbox.length === 1 ? 'ball' : 'balls'} safely queued`
                : deliveryOutbox.length > 0
                  ? `${deliveryOutbox.length} ${deliveryOutbox.length === 1 ? 'ball is' : 'balls are'} syncing`
                  : ballMutation.isPending || outboxFlushing
                    ? 'Saving ball…'
                    : 'Live score is connected'}
            </strong>
            <p className="muted">
              {!isOnline
                ? 'Keep scoring normally. Deliveries are stored durably on this device and upload in order after reconnection.'
                : deliveryOutbox.length > 0
                  ? 'Safe retry IDs prevent a delivery from being added twice.'
                  : lastSavedAt
                    ? `Last ball saved at ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`
                    : 'Each recorded ball is saved to the match centre immediately.'}
            </p>
          </div>
        </div>
        {deliveryOutbox.length > 0 ? (
          <button
            type="button"
            className="btn-primary btn--with-icon"
            disabled={!isOnline || outboxFlushing || !scoringSessionQ.data?.session_token}
            onClick={() => void flushDeliveryOutbox()}
          >
            <CloudUpload size={18} aria-hidden />
            {outboxFlushing ? 'Syncing…' : `Sync ${deliveryOutbox.length} queued`}
          </button>
        ) : null}
      </aside> : null}

      <section className="live-scorer-sticky" aria-label="Scoring quick controls">
        <div className="live-scorer-sticky__top">
          <div>
            <div className="live-scorer-score">{currentScore}</div>
            <div className="live-scorer-meta">
              <span className="live-scorer-chip">{battingTeamName}</span>
              <span className="live-scorer-chip">Over {nextOverNumber}.{nextBallNumber}</span>
              <span className="live-scorer-chip">Striker: {strikerName}</span>
              <span className="live-scorer-chip">Non-striker: {nonStrikerName}</span>
              <span className="live-scorer-chip">Bowler: {bowlerName}</span>
            </div>
          </div>
          {!scorecardReadOnly && !isCommentator ? <div className="catalog-toolbar">
            {match.status !== 'completed' ? (
              <button
                type="button"
                className="btn-primary btn--with-icon"
                onClick={() => void startMutation.mutate()}
                disabled={startMutation.isPending}
              >
                <Save size={18} strokeWidth={2} aria-hidden />
                {startMutation.isPending ? 'Starting…' : 'Start'}
              </button>
            ) : null}
            {canResetTestMatch ? (
              <button
                type="button"
                className="btn-ghost live-scorer-reset"
                onClick={resetTestMatch}
                disabled={resetTestMutation.isPending}
              >
                {resetTestMutation.isPending ? 'Resetting…' : 'Reset test'}
              </button>
            ) : null}
          </div> : null}
        </div>
        <div className="live-scorer-tabs" role="tablist" aria-label="Scorer sections">
          {scoringPanels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              id={`scorer-tab-${panel.id}`}
              role="tab"
              className={`live-scorer-tab${effectiveScorerPanel === panel.id ? ' is-active' : ''}${panel.isComplete ? ' is-complete' : ''}`}
              onClick={() => setActiveScorerPanel(panel.id)}
              aria-selected={effectiveScorerPanel === panel.id}
              aria-controls={`scorer-panel-${panel.id}`}
            >
              <strong>{panel.label}</strong>
              <span>{panel.hint}</span>
            </button>
          ))}
        </div>
        {liveQ.isError ? <p className="login-error">{liveQ.error.message}</p> : null}
        {squadQ.isError ? <p className="login-error">{squadQ.error.message}</p> : null}
        {actionError ? <p className="login-error">{actionError}</p> : null}
      </section>

      <div
        id={`scorer-panel-${effectiveScorerPanel}`}
        role="tabpanel"
        aria-labelledby={`scorer-tab-${effectiveScorerPanel}`}
        tabIndex={0}
        className="live-scorer-tabpanel"
      >

      {effectiveScorerPanel === 'setup' ? (
      <section className="team-hub-section">
        <div className="team-hub-section-head">
          <div className="team-hub-section-head__lead">
            <h2 className="team-hub-section__title">Match setup</h2>
            <p className="muted">
              Save the toss, batting-first team, and umpire names before the first ball.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary btn--with-icon"
            onClick={() => void saveSetupMutation.mutate()}
            disabled={saveSetupMutation.isPending}
          >
            <Save size={18} strokeWidth={2} aria-hidden />
            {saveSetupMutation.isPending ? 'Saving…' : 'Save setup'}
          </button>
        </div>

        <div className="inline-edit__grid">
          <label className="inline-edit__field">
            <span className="inline-edit__label">Toss won by</span>
            <select
              className="inline-edit__control"
              value={tossWinnerTeamId}
              onChange={(event) => setTossWinnerTeamId(Number(event.target.value))}
            >
              {matchTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-edit__field">
            <span className="inline-edit__label">Toss decision</span>
            <select
              className="inline-edit__control"
              value={tossDecision}
              onChange={(event) => setTossDecision(event.target.value as 'bat' | 'bowl')}
            >
              <option value="bat">Bat first</option>
              <option value="bowl">Bowl first</option>
            </select>
          </label>

          <label className="inline-edit__field">
            <span className="inline-edit__label">Team batting first</span>
            <select
              className="inline-edit__control"
              value={battingFirstTeamId}
              onChange={(event) => setBattingFirstTeamId(Number(event.target.value))}
            >
              {matchTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-edit__field">
            <span className="inline-edit__label">Match overs per side</span>
            <input
              className="inline-edit__control"
              inputMode="decimal"
              value={matchOvers}
              onChange={(event) => setMatchOvers(event.target.value)}
              placeholder="40.0"
            />
            <span className="muted">Used for official result and NRR. Example: 40.0 or 20.0.</span>
          </label>

          <label className="inline-edit__field">
            <span className="inline-edit__label">Umpire 1</span>
            <input className="inline-edit__control" value={umpire1} onChange={(event) => setUmpire1(event.target.value)} />
          </label>

          <label className="inline-edit__field">
            <span className="inline-edit__label">Umpire 2</span>
            <input className="inline-edit__control" value={umpire2} onChange={(event) => setUmpire2(event.target.value)} />
          </label>

          <label className="inline-edit__field">
            <span className="inline-edit__label">Reserve / TV umpire</span>
            <input className="inline-edit__control" value={reserveUmpire} onChange={(event) => setReserveUmpire(event.target.value)} />
          </label>
        </div>
      </section>
      ) : null}

      {effectiveScorerPanel === 'squads' ? (
      <section className="team-hub-section">
        <div className="team-hub-section-head">
          <div className="team-hub-section-head__lead">
            <h2 className="team-hub-section__title">Match day squad</h2>
            <p className="muted">
              Select up to 11 playing XI and up to 4 ordinary substitutes per team.
              Concussion substitutes can be added during a live match and are eligible to
              bat, bowl and field as soon as the squad is saved.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary btn--with-icon"
            onClick={() => void saveSquadMutation.mutate()}
            disabled={saveSquadMutation.isPending || playersQ.isLoading}
          >
            <Save size={18} strokeWidth={2} aria-hidden />
            {saveSquadMutation.isPending ? 'Saving…' : 'Save squads'}
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            alignItems: 'start',
            marginTop: '1rem',
          }}
        >
          {matchTeams.map((team) => {
            const teamPlayers = playersForTeam(team.id)
            const playingCount = selectedRoleCount(teamPlayers, playerRoles, 'playing_xi')
            const substituteCount = selectedRoleCount(teamPlayers, playerRoles, 'substitute')
            const concussionSubstituteCount = selectedRoleCount(
              teamPlayers,
              playerRoles,
              'concussion_substitute',
            )

            return (
              <div key={team.id} className="team-hub-section" style={{ marginTop: 0 }}>
                <div className="team-hub-section-head">
                  <div className="team-hub-section-head__lead">
                    <h3 className="team-hub-section__title">{team.name}</h3>
                    <p className="muted">
                      Playing XI: {playingCount}/11 · Subs: {substituteCount}/4 ·
                      Concussion subs: {concussionSubstituteCount}
                    </p>
                  </div>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Match day role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamPlayers.map((player) => (
                        <tr key={player.id}>
                          <td>{player.full_name}</td>
                          <td>
                            <select
                              className="inline-edit__control"
                              value={playerRoles[player.id] ?? ''}
                              onChange={(event) => {
                                const value = event.target.value as MatchSquadRole | ''
                                setPlayerRoles((current) => ({
                                  ...current,
                                  [player.id]: value,
                                }))
                                setSquadDirty(true)
                              }}
                            >
                              <option value="">Not in match day squad</option>
                              <option value="playing_xi">Playing XI</option>
                              <option value="substitute">Substitute</option>
                              <option value="concussion_substitute">Concussion substitute</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      </section>
      ) : null}

      {effectiveScorerPanel === 'commentary' ? (
        <section className="live-commentary-workspace" aria-label="Live commentary workspace">
          <div className="live-commentary-editor">
            <div className="live-commentary-editor__head">
              <div>
                <span className="live-commentary-kicker">Live commentary</span>
                <h2>Describe the selected delivery</h2>
                <p>
                  Commentary publishes to the public match centre without changing
                  the official score or ball record.
                </p>
              </div>
              <span className="live-commentary-live-pill">
                <span aria-hidden /> LIVE
              </span>
            </div>

            {selectedCommentaryEvent ? (
              <>
                <div className="live-commentary-context" aria-label="Selected delivery facts">
                  <div>
                    <span>Ball</span>
                    <strong>
                      {selectedCommentaryEvent.over_number}.{selectedCommentaryEvent.ball_number}
                    </strong>
                  </div>
                  <div>
                    <span>Delivery</span>
                    <strong>
                      {playerName(playerById, selectedCommentaryEvent.bowler_player_id)} to{' '}
                      {playerName(playerById, selectedCommentaryEvent.striker_player_id)}
                    </strong>
                  </div>
                  <div>
                    <span>Outcome</span>
                    <strong>
                      {selectedCommentaryEvent.wicket_type
                        ? dismissalLabel(selectedCommentaryEvent.wicket_type)
                        : `${commentaryEventTotal} run${commentaryEventTotal === 1 ? '' : 's'}`}
                    </strong>
                  </div>
                  <div>
                    <span>Score</span>
                    <strong>
                      {commentarySummary
                        ? `${commentarySummary.runs}/${commentarySummary.wickets}`
                        : currentScore}
                    </strong>
                  </div>
                </div>

                <label className="live-commentary-field">
                  <span>Public ball-by-ball text</span>
                  <textarea
                    value={commentaryDraft}
                    onChange={(event) => setCommentaryDraft(event.target.value)}
                    maxLength={4000}
                    placeholder="Example: Driven firmly through extra cover and it races away to the rope."
                  />
                  <small>{commentaryDraft.length}/4000 characters</small>
                </label>

                <div className="live-commentary-actions">
                  <button
                    type="button"
                    className="btn-primary btn--with-icon"
                    disabled={
                      saveCommentaryMutation.isPending ||
                      selectedCommentaryEvent.id < 0 ||
                      liveQ.data?.can_edit_commentary === false
                    }
                    onClick={() =>
                      void saveCommentaryMutation.mutate({
                        eventId: selectedCommentaryEvent.id,
                        commentary: commentaryDraft,
                      })
                    }
                  >
                    <Save size={18} strokeWidth={2} aria-hidden />
                    {saveCommentaryMutation.isPending ? 'Publishing…' : 'Publish commentary'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={saveCommentaryMutation.isPending || commentaryDraft.length === 0}
                    onClick={() => setCommentaryDraft('')}
                  >
                    Clear text
                  </button>
                </div>

                <div className="live-commentary-public-preview">
                  <span>Public preview</span>
                  <p>{commentaryDraft.trim() || 'Commentary will appear here as supporters see it.'}</p>
                </div>
              </>
            ) : (
              <div className="live-commentary-empty">
                <strong>Waiting for the first delivery</strong>
                <p>The latest scored ball will appear here automatically.</p>
              </div>
            )}

            <div className="live-commentary-feed-picker">
              <div className="live-commentary-feed-picker__head">
                <strong>Choose a delivery</strong>
                <span>{allLiveEvents.length} recorded</span>
              </div>
              <div className="live-commentary-feed-picker__list">
                {[...allLiveEvents]
                  .reverse()
                  .slice(0, 30)
                  .map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className={event.id === selectedCommentaryEvent?.id ? 'is-selected' : ''}
                      aria-pressed={event.id === selectedCommentaryEvent?.id}
                      onClick={() => {
                        setCommentaryEventId(event.id)
                        setCommentaryDraft(event.commentary ?? '')
                      }}
                    >
                      <span className={liveEventChipClass(event)}>
                        {liveEventChipLabel(event)}
                      </span>
                      <span>
                        <strong>
                          {event.over_number}.{event.ball_number}{' '}
                          {playerName(playerById, event.bowler_player_id)} to{' '}
                          {playerName(playerById, event.striker_player_id)}
                        </strong>
                        <small>
                          {event.commentary?.trim() || 'No public commentary yet'}
                        </small>
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>

          <aside className="live-commentary-scorecard" aria-label="Live full scorecard">
            <div className="live-commentary-scorecard__hero">
              <span>{commentaryInnings === 1 ? '1st' : '2nd'} innings</span>
              <strong>
                {commentarySummary
                  ? `${commentarySummary.runs}/${commentarySummary.wickets}`
                  : '0/0'}
              </strong>
              <p>
                {commentarySummary
                  ? `${teamById.get(commentarySummary.batting_team_id)?.name ?? 'Batting team'} · ${commentarySummary.overs_label} overs`
                  : 'Waiting for scoring data'}
              </p>
            </div>

            <div className="live-commentary-scorecard__section">
              <h3>Batting</h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Dismissal</th>
                      <th>R</th>
                      <th>B</th>
                      <th>4</th>
                      <th>6</th>
                      <th>SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commentaryScorecard.batters.map((row) => (
                      <tr key={row.playerId}>
                        <td>{playerName(playerById, row.playerId)}</td>
                        <td>{row.dismissal}</td>
                        <td><strong>{row.runs}</strong></td>
                        <td>{row.balls}</td>
                        <td>{row.fours}</td>
                        <td>{row.sixes}</td>
                        <td>{row.balls ? ((row.runs * 100) / row.balls).toFixed(2) : '—'}</td>
                      </tr>
                    ))}
                    {commentaryScorecard.batters.length === 0 ? (
                      <tr><td colSpan={7}>No batting data yet.</td></tr>
                    ) : null}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={2}>Extras</th>
                      <td colSpan={5}>
                        {commentaryInningsEvents.reduce(
                          (total, event) =>
                            total + event.runs_extras + event.penalty_runs_batting,
                          0,
                        )}
                      </td>
                    </tr>
                    <tr>
                      <th colSpan={2}>Total</th>
                      <td colSpan={5}>
                        <strong>
                          {commentarySummary
                            ? `${commentarySummary.runs}/${commentarySummary.wickets} (${commentarySummary.overs_label} ov)`
                            : '0/0 (0.0 ov)'}
                        </strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="live-commentary-fow">
                <strong>Fall of wickets:</strong>{' '}
                {commentaryFallOfWickets.length
                  ? commentaryFallOfWickets
                      .map(
                        (row) =>
                          `${row.wicket}-${row.runs} (${playerName(playerById, row.playerId)}, ${row.over})`,
                      )
                      .join(', ')
                  : 'None'}
              </p>
            </div>

            <div className="live-commentary-scorecard__section">
              <h3>Bowling</h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Bowler</th><th>O</th><th>R</th><th>W</th><th>Econ</th><th>0s</th><th>WD</th><th>NB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commentaryScorecard.bowlers.map((row) => (
                      <tr key={row.playerId}>
                        <td>{playerName(playerById, row.playerId)}</td>
                        <td>{Math.floor(row.legalBalls / 6)}.{row.legalBalls % 6}</td>
                        <td>{row.runs}</td>
                        <td><strong>{row.wickets}</strong></td>
                        <td>{row.legalBalls ? ((row.runs * 6) / row.legalBalls).toFixed(2) : '—'}</td>
                        <td>{row.dots}</td><td>{row.wides}</td><td>{row.noBalls}</td>
                      </tr>
                    ))}
                    {commentaryScorecard.bowlers.length === 0 ? (
                      <tr><td colSpan={8}>No bowling data yet.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </aside>
        </section>
      ) : null}

      {effectiveScorerPanel === 'photos' ? (
        <section className="team-hub-section live-match-photo-workspace" aria-labelledby="live-match-photos-title">
          <div className="team-hub-section-head">
            <div className="team-hub-section-head__lead">
              <h2 id="live-match-photos-title" className="team-hub-section__title">Match photos</h2>
              <p className="muted">
                Upload official in-game photos. Published images appear immediately in the public match centre Photos tab.
              </p>
            </div>
          </div>

          <form
            className="live-match-photo-upload"
            onSubmit={(event) => {
              event.preventDefault()
              void uploadMatchPhotoMutation.mutate()
            }}
          >
            <label className="inline-edit__field">
              <span className="inline-edit__label">Photo title</span>
              <input
                className="inline-edit__control"
                value={photoTitle}
                maxLength={255}
                onChange={(event) => setPhotoTitle(event.target.value)}
                placeholder={`${match.title?.trim() || 'Match'} photo`}
                disabled={uploadMatchPhotoMutation.isPending}
              />
            </label>
            <label className="live-match-photo-picker" htmlFor="live-match-photo-file">
              <ImagePlus size={28} aria-hidden />
              <span>
                <strong>{photoFile ? photoFile.name : 'Choose a match photo'}</strong>
                <small>JPG, PNG, WebP, GIF or another supported image format</small>
              </span>
            </label>
            <input
              id="live-match-photo-file"
              className="visually-hidden"
              type="file"
              accept="image/*"
              onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
              disabled={uploadMatchPhotoMutation.isPending}
            />
            <button
              type="submit"
              className="btn-primary btn--with-icon"
              disabled={!photoFile || uploadMatchPhotoMutation.isPending}
            >
              <CloudUpload size={18} aria-hidden />
              {uploadMatchPhotoMutation.isPending ? 'Uploading…' : 'Upload & publish'}
            </button>
          </form>

          <div className="live-match-photo-list" aria-live="polite">
            {(matchPhotosQ.data?.items ?? []).map((photo) => {
              const src = resolveAdminMediaUrl(photo.thumbnail_url ?? photo.file_url)
              return (
                <article key={photo.id}>
                  {src ? <img src={src} alt={photo.title} loading="lazy" decoding="async" /> : null}
                  <div><strong>{photo.title}</strong><small>Published</small></div>
                </article>
              )
            })}
            {!matchPhotosQ.isLoading && (matchPhotosQ.data?.items.length ?? 0) === 0 ? (
              <p className="muted">No in-game photos have been published yet.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {effectiveScorerPanel === 'score' ? (
      <section className="team-hub-section live-scorer-score-section">
        <div className="team-hub-section-head">
          <div className="team-hub-section-head__lead">
            <h2 className="team-hub-section__title">Current score</h2>
            <p className="muted">
              {battingTeamName}: {currentScore}
              {inningsTarget
                ? innings === 1
                  ? ` · target for next innings: ${inningsTarget}`
                  : ` · target: ${inningsTarget}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost btn--with-icon"
            onClick={() => void startMutation.mutate()}
            disabled={startMutation.isPending}
          >
            <Save size={18} strokeWidth={2} aria-hidden />
            {startMutation.isPending ? 'Starting…' : 'Start / mark live'}
          </button>
        </div>

        <aside
          className={`live-scorer-conditions${conditionsOpen ? '' : ' is-collapsed'}`}
          aria-label="Rain and revised match conditions"
        >
          <div className="live-scorer-conditions__head">
            <div>
              <h3>Rain / revised match conditions</h3>
              {conditionsOpen ? (
                <p className="muted">
                  Save the revised overs. The ICC DLS Standard Edition target is calculated automatically.
                </p>
              ) : (
                <div className="live-scorer-conditions__summary" aria-live="polite">
                  <span>{liveQ.data?.match_overs ?? revisedMatchOvers} overs</span>
                  <span>
                    {liveQ.data?.revised_target_runs != null
                      ? `ICC DLS Standard target: ${liveQ.data.revised_target_runs}`
                      : 'No revised DLS target applied'}
                  </span>
                  {liveQ.data?.dls_par_score != null ? (
                    <span>Par now: {liveQ.data.dls_par_score}</span>
                  ) : null}
                </div>
              )}
            </div>
            {conditionsOpen ? (
              <div className="live-scorer-conditions__actions">
                <button
                  type="button"
                  className="btn-ghost btn--with-icon live-scorer-reset"
                  onClick={() => {
                    setRevisedMatchOvers('')
                    setConditionsDirty(true)
                  }}
                  disabled={saveConditionsMutation.isPending}
                >
                  <RotateCcw size={18} strokeWidth={2} aria-hidden />
                  Clear DLS
                </button>
                <button
                  type="button"
                  className="btn-primary btn--with-icon"
                  onClick={() => void saveConditionsMutation.mutate()}
                  disabled={saveConditionsMutation.isPending}
                >
                  <Save size={18} strokeWidth={2} aria-hidden />
                  {saveConditionsMutation.isPending ? 'Saving…' : 'Save conditions'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-ghost btn--with-icon"
                onClick={() => {
                  const currentOvers = liveQ.data?.match_overs ?? revisedMatchOvers
                  setRevisedMatchOvers(String(currentOvers))
                  setConditionsDirty(false)
                  setConditionsOpen(true)
                }}
              >
                <Pencil size={18} strokeWidth={2} aria-hidden />
                Edit conditions
              </button>
            )}
          </div>
          {conditionsOpen ? (
            <div className="inline-edit__grid">
              <label className="inline-edit__field">
                <span className="inline-edit__label">
                  Revised overs for the {innings === 1 ? 'first' : 'second'} innings
                </span>
                <input
                  className="inline-edit__control"
                  inputMode="decimal"
                  value={revisedMatchOvers}
                  onChange={(event) => {
                    setRevisedMatchOvers(event.target.value)
                    setConditionsDirty(true)
                  }}
                  placeholder="35.0"
                />
                <span className="muted">
                  Use cricket notation, for example 19.4 means 19 overs and 4 balls.
                  Leave blank or enter 0, then save, to clear DLS and keep the current match length.
                </span>
              </label>
              <div className="live-scorer-conditions__par">
                {innings === 1
                  ? 'The first-innings resource is saved now; the target is calculated for the chase.'
                  : liveQ.data?.revised_target_runs != null
                    ? `Current ICC DLS Standard target: ${liveQ.data.revised_target_runs}`
                    : 'The revised target will be calculated from the first-innings score and both teams’ resources.'}
              </div>
              <div className="live-scorer-conditions__par">
                DLS par now: {liveQ.data?.dls_par_score ?? '—'}
              </div>
            </div>
          ) : null}
        </aside>

        <div className="dashboard-match-panel__tabs" role="tablist" aria-label="Innings">
          <button
            type="button"
            id="scorer-innings-tab-1"
            role="tab"
            aria-selected={innings === 1}
            aria-controls="scorer-innings-panel-1"
            className={`dashboard-match-panel__tab${innings === 1 ? ' is-active' : ''}`}
            onClick={() => setInnings(1)}
          >
            1st innings
          </button>
          <button
            type="button"
            id="scorer-innings-tab-2"
            role="tab"
            aria-selected={innings === 2}
            aria-controls="scorer-innings-panel-2"
            className={`dashboard-match-panel__tab${innings === 2 ? ' is-active' : ''}`}
            onClick={() => setInnings(2)}
          >
            2nd innings
          </button>
        </div>

        <div
          className="live-scorer-workspace"
          id={`scorer-innings-panel-${innings}`}
          role="tabpanel"
          aria-labelledby={`scorer-innings-tab-${innings}`}
          tabIndex={0}
        >
        <div className="live-scorer-workspace__controls">
        <section className="live-scorer-mini-sheet" aria-label="Live innings summary">
          <div className="live-scorer-mini-sheet__topline">
            <span><i aria-hidden="true" /> Live innings {innings}</span>
            <strong>Scoresheet</strong>
            <span>Updates after every ball</span>
          </div>

          <div className="live-scorer-mini-sheet__teams">
            <div className="is-active">
              <span>Batting</span>
              <strong>{battingTeamName}</strong>
            </div>
            <div>
              <span>Fielding</span>
              <strong>{bowlingTeamName}</strong>
            </div>
          </div>

          <div className="live-scorer-mini-sheet__total">
            <div role="status" aria-live="polite" aria-atomic="true">
              <strong>{currentSummary?.runs ?? 0}/{currentSummary?.wickets ?? 0}</strong>
              <span>{currentSummary?.overs_label ?? '0.0'} overs</span>
            </div>
            <div>
              <span>Current run rate</span>
              <strong>{scoringRunRate}</strong>
              {inningsTarget ? <small>Target {inningsTarget}</small> : null}
            </div>
          </div>

          <div className="live-scorer-mini-table" role="region" aria-label="Batters at the crease" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Batters</th>
                  <th scope="col">R</th>
                  <th scope="col">B</th>
                  <th scope="col">4s</th>
                  <th scope="col">6s</th>
                  <th scope="col">SR</th>
                </tr>
              </thead>
              <tbody>
                {activeScoringBatters.map((batter) => (
                  <tr key={batter.playerId} className={batter.playerId === strikerPlayerId ? 'is-active' : ''}>
                    <th scope="row">
                      {playerName(playerById, batter.playerId)}
                      {batter.playerId === strikerPlayerId ? <span aria-label="striker"> *</span> : null}
                    </th>
                    <td>{batter.runs}</td>
                    <td>{batter.balls}</td>
                    <td>{batter.fours}</td>
                    <td>{batter.sixes}</td>
                    <td>{batter.balls ? ((batter.runs / batter.balls) * 100).toFixed(2) : '0.00'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="live-scorer-mini-sheet__summary">
            <span>
              Extras <strong>{scoringExtras.total}</strong>
              <small>nb {scoringExtras.noBalls}, wd {scoringExtras.wides}, b {scoringExtras.byes}, lb {scoringExtras.legByes}, p {scoringExtras.penalties}</small>
            </span>
            <span>
              Partnership <strong>{scoringPartnership.runs}</strong>
              <small>{scoringPartnership.balls} balls · {scoringPartnership.fours} fours · {scoringPartnership.sixes} sixes</small>
            </span>
          </div>

          <div className="live-scorer-mini-table" role="region" aria-label="Current bowler" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Bowler</th>
                  <th scope="col">O</th>
                  <th scope="col">M</th>
                  <th scope="col">R</th>
                  <th scope="col">W</th>
                  <th scope="col">Econ</th>
                </tr>
              </thead>
              <tbody>
                <tr className="is-active">
                  <th scope="row">{bowlerName}</th>
                  <td>{activeScoringBowler ? oversLabel(activeScoringBowler.legalBalls) : '0.0'}</td>
                  <td>{scoringBowlerMaidens}</td>
                  <td>{activeScoringBowler?.runs ?? 0}</td>
                  <td>{activeScoringBowler?.wickets ?? 0}</td>
                  <td>{activeScoringBowler?.legalBalls ? ((activeScoringBowler.runs * 6) / activeScoringBowler.legalBalls).toFixed(2) : '0.00'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="live-scorer-mini-sheet__over">
            <div>
              <span>Next ball</span>
              <strong>{nextOverNumber}.{nextBallNumber}: {bowlerName} to {strikerName}</strong>
            </div>
            <div>
              <span>Over {overStripOverNumber + 1} · {overStripRuns} runs</span>
              <div className="live-scorer-over-strip" aria-label="Current over balls">
                {overStripEvents.length > 0 ? (
                  overStripEvents.map((event) => (
                    <span
                      key={event.id}
                      className={liveEventChipClass(event)}
                      title={`${event.over_number}.${event.ball_number} ${liveEventLabel(event)}`}
                    >
                      {liveEventChipLabel(event)}
                    </span>
                  ))
                ) : (
                  <span className="muted">No balls in this over yet.</span>
                )}
              </div>
            </div>
          </div>
        </section>

        <details
          className="live-scorer-player-controls"
          open={playerControlsOpen}
          onToggle={(event) => setPlayerControlsOpen(event.currentTarget.open)}
        >
          <summary>Batters / strike and bowler controls</summary>
          <p>Use these controls to start an innings or correct the active players. Normal strike changes update automatically after every ball.</p>
          <div className="inline-edit__grid">
            <label className="inline-edit__field">
              <span className="inline-edit__label">Batting team</span>
              <select className="inline-edit__control" value={battingTeamId} onChange={(event) => setBattingTeamId(Number(event.target.value))}>
                {matchTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
            <label className="inline-edit__field">
              <span className="inline-edit__label">Bowling team</span>
              <select className="inline-edit__control" value={bowlingTeamId} onChange={(event) => setBowlingTeamId(Number(event.target.value))}>
                {matchTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
            <label className="inline-edit__field">
              <span className="inline-edit__label">Striker</span>
              <select className="inline-edit__control" value={strikerPlayerId} onChange={(event) => setStrikerPlayerId(Number(event.target.value))}>
                <option value="">Choose striker</option>
                {battingPlayers.map((player) => <option key={player.id} value={player.id}>{player.full_name}</option>)}
              </select>
            </label>
            <label className="inline-edit__field">
              <span className="inline-edit__label">Non-striker</span>
              <select className="inline-edit__control" value={nonStrikerPlayerId} onChange={(event) => setNonStrikerPlayerId(event.target.value ? Number(event.target.value) : '')}>
                <option value="">Choose non-striker</option>
                {battingPlayers.map((player) => <option key={player.id} value={player.id}>{player.full_name}</option>)}
              </select>
            </label>
            <label className="inline-edit__field">
              <span className="inline-edit__label">Bowler</span>
              <select className="inline-edit__control" value={bowlerPlayerId} onChange={(event) => setBowlerPlayerId(Number(event.target.value))}>
                <option value="">Choose bowler</option>
                {bowlingPlayers.map((player) => <option key={player.id} value={player.id}>{player.full_name}</option>)}
              </select>
            </label>
          </div>
        </details>

        {scorerWarnings.length > 0 ? (
          <div className="live-scorer-warning-list" role="alert">
            {scorerWarnings.map((warning) => (
              <div key={warning} className="live-scorer-warning">
                {warning}
              </div>
            ))}
          </div>
        ) : null}

        <div className="team-hub-section" style={{ marginTop: '1rem' }}>
          <div className="team-hub-section-head">
            <div className="team-hub-section-head__lead">
              <h4 className="team-hub-section__title">Record ball</h4>
              <p className="muted">Add the ball comment first, then tap the run button. Short runs preserve the completed-run strike change while recording only the scored runs.</p>
            </div>
          </div>

          {overControlsOpen ? (
            <fieldset
              id="official-over-controls"
              className="live-scorer-over-controls"
            >
              <legend className="sr-only">Umpire over count</legend>
              <div className="live-scorer-over-controls__head">
                <strong>Umpire over count</strong>
                <span>Choose how the next legal delivery affects this over. The selection resets after the ball is recorded.</span>
              </div>
              <div className="live-scorer-over-controls__choices">
                <label className="live-scorer-final-confirm">
                  <input
                    type="radio"
                    name="umpire-over-count"
                    checked={!umpireEndOverAfterNextBall && !umpireContinueOverAfterNextBall}
                    onChange={() => {
                      setUmpireEndOverAfterNextBall(false)
                      setUmpireContinueOverAfterNextBall(false)
                    }}
                  />
                  <span>Normal: end after 6 legal balls</span>
                </label>
                <label className="live-scorer-final-confirm">
                  <input
                    type="radio"
                    name="umpire-over-count"
                    checked={umpireEndOverAfterNextBall}
                    onChange={() => {
                      setUmpireEndOverAfterNextBall(true)
                      setUmpireContinueOverAfterNextBall(false)
                    }}
                  />
                  <span>End over after the next legal ball</span>
                </label>
                <label className="live-scorer-final-confirm">
                  <input
                    type="radio"
                    name="umpire-over-count"
                    checked={umpireContinueOverAfterNextBall}
                    onChange={() => {
                      setUmpireEndOverAfterNextBall(false)
                      setUmpireContinueOverAfterNextBall(true)
                    }}
                  />
                  <span>Continue over after the next legal ball</span>
                </label>
              </div>
              <div className="live-scorer-over-controls__actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    if (lastDeliveryInCurrentOver) {
                      endOverNowMutation.mutate(lastDeliveryInCurrentOver)
                    }
                  }}
                  disabled={!lastDeliveryInCurrentOver || endOverNowMutation.isPending}
                >
                  {endOverNowMutation.isPending ? 'Ending over…' : 'End current over now'}
                </button>
                <span>
                  {currentOverLegalEvents.length > 0
                    ? `${currentOverLegalEvents.length} legal ball${currentOverLegalEvents.length === 1 ? '' : 's'} recorded in this over.`
                    : currentOverDeliveryEvents.length > 0
                      ? 'No legal balls recorded in this over yet.'
                      : 'Record at least one delivery before ending the over.'}
                </span>
              </div>
              <label className="live-scorer-final-confirm">
                <input
                  type="checkbox"
                  checked={umpireReplacementInOver}
                  onChange={(event) => setUmpireReplacementInOver(event.target.checked)}
                />
                <span>Replacement bowler is completing this over</span>
              </label>
            </fieldset>
          ) : null}

          <div className="live-scorer-record-grid">
            <div>
              <div className="live-scorer-score-buttons" aria-label="Ball result keypad">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((runs) => (
                  <button
                    key={runs}
                    type="button"
                    className="btn-primary"
                    aria-label={`Record ${runs} run${runs === 1 ? '' : 's'}`}
                    onClick={() =>
                      submitBall({
                        runsBatter: runs,
                        strikeRuns: runs,
                        completedRuns: runs,
                        boundaryRuns: runs === 4 || runs === 6 ? runs : 0,
                        boundaryType: runs === 4 ? 'four' : runs === 6 ? 'six' : null,
                      })
                    }
                    disabled={ballMutation.isPending}
                  >
                  {runs}
                </button>
              ))}
                <button
                  type="button"
                  className="btn-ghost live-scorer-quick-extra"
                  onClick={() =>
                    submitBall({
                      runsExtras: 1,
                      extrasType: 'wide',
                      isLegalDelivery: false,
                      completedRuns: 0,
                      strikeRuns: 0,
                    })
                  }
                  disabled={ballMutation.isPending}
                >
                  Wide
                </button>
                <button
                  type="button"
                  className="btn-ghost live-scorer-quick-extra"
                  onClick={() =>
                    submitBall({
                      runsExtras: 1,
                      extrasType: 'no_ball',
                      isLegalDelivery: false,
                      completedRuns: 0,
                      strikeRuns: 0,
                    })
                  }
                  disabled={ballMutation.isPending}
                >
                  No ball
                </button>
                <button
                  type="button"
                  className="btn-ghost live-scorer-quick-extra"
                  onClick={() =>
                    submitBall({
                      runsExtras: 1,
                      extrasType: 'bye',
                      completedRuns: 1,
                      strikeRuns: 1,
                    })
                  }
                  disabled={ballMutation.isPending}
                >
                  Bye
                </button>
                <button
                  type="button"
                  className="btn-ghost live-scorer-quick-extra"
                  onClick={() =>
                    submitBall({
                      runsExtras: 1,
                      extrasType: 'leg_bye',
                      completedRuns: 1,
                      strikeRuns: 1,
                      legByeAttempted: true,
                    })
                  }
                  disabled={ballMutation.isPending}
                >
                  Leg bye
                </button>
              </div>
            </div>

            <label className="inline-edit__field live-scorer-commentary" style={{ margin: 0 }}>
              <span className="inline-edit__label">Scorer note (internal)</span>
              <textarea
                className="inline-edit__control"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional scorer note, for example: umpire signal, correction context, dropped catch…"
                rows={4}
                style={{ resize: 'vertical', lineHeight: 1.5 }}
              />
              <span className="muted" style={{ marginTop: '0.4rem' }}>
                Saved with the delivery for scoring review. Public commentary is added only after the ball is recorded.
              </span>
            </label>
          </div>

          <div className="live-scorer-short-run" aria-label="Record a short run">
              <span className="live-scorer-short-run__title">Short run</span>
              <label className="inline-edit__field" aria-label="Short-run delivery">
                <select
                  className="inline-edit__control"
                  value={shortRunDelivery}
                  aria-label="Short-run delivery"
                  onChange={(event) => setShortRunDelivery(event.target.value as ShortRunDelivery)}
                >
                  <option value="bat">Bat runs</option>
                  <option value="wide">Wide</option>
                  <option value="no_ball_bat">No-ball + bat</option>
                  <option value="bye">Bye</option>
                  <option value="leg_bye">Leg bye</option>
                  <option value="no_ball_bye">No-ball + bye</option>
                  <option value="no_ball_leg_bye">No-ball + leg bye</option>
                </select>
              </label>
              <label className="inline-edit__field" aria-label="Completed runs">
                <select
                  className="inline-edit__control"
                  value={shortRunCompleted}
                  aria-label="Completed runs"
                  onChange={(event) => {
                    const completed = Number(event.target.value)
                    setShortRunCompleted(completed)
                    setShortRunScored((current) => Math.min(current, completed - 1))
                  }}
                >
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((runs) => (
                    <option key={runs} value={runs}>Ran {runs}</option>
                  ))}
                </select>
              </label>
              <label className="inline-edit__field" aria-label="Runs scored">
                <select
                  className="inline-edit__control"
                  value={shortRunScored}
                  aria-label="Runs scored"
                  onChange={(event) => setShortRunScored(Number(event.target.value))}
                >
                  {Array.from({ length: shortRunCompleted }, (_, runs) => (
                    <option key={runs} value={runs}>Scored {runs}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn-ghost"
                onClick={recordShortRun}
                disabled={ballMutation.isPending}
              >
                Record short run
              </button>
          </div>

          <div className="live-scorer-quick-actions" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={swapStrike}
              disabled={!strikerPlayerId || !nonStrikerPlayerId || ballMutation.isPending}
            >
              Swap strike
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setExtrasOpen(true)}
            >
              Extras
            </button>
            <button
              type="button"
              className="btn-ghost live-scorer-wicket-action"
              onClick={() => openWicketDetails('caught')}
              disabled={ballMutation.isPending}
            >
              Out / wicket
            </button>
            <button
              type="button"
              className="btn-ghost live-scorer-retire-action"
              onClick={() => openWicketDetails('retired_hurt')}
              disabled={ballMutation.isPending}
            >
              Retire hurt
            </button>
            <button
              type="button"
              className="btn-ghost"
              aria-expanded={playerControlsOpen}
              onClick={() => setPlayerControlsOpen((current) => !current)}
            >
              Batters / strike
            </button>
            <button
              type="button"
              className={overControlsOpen ? 'btn-ghost is-active' : 'btn-ghost'}
              aria-expanded={overControlsOpen}
              aria-controls="official-over-controls"
              onClick={() => setOverControlsOpen((current) => !current)}
            >
              Umpire over count
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setActiveScorerPanel('review')}
            >
              Match actions
            </button>
            <button
              type="button"
              className="btn-ghost btn--with-icon"
              onClick={() => void undoMutation.mutate()}
              disabled={
                ballMutation.isPending ||
                undoMutation.isPending ||
                (liveQ.data?.events.length ?? 0) === 0
              }
            >
              <Undo2 size={18} strokeWidth={2} aria-hidden />
              {undoMutation.isPending ? 'Undoing…' : 'Undo last'}
            </button>
          </div>
        </div>

        {extrasOpen ? (
          <div className="live-scorer-dialog-backdrop">
            <section
              className="live-scorer-dialog live-scorer-dialog--extras"
              role="dialog"
              aria-modal="true"
              aria-labelledby="extras-dialog-title"
            >
              <div className="team-hub-section-head">
                <div className="team-hub-section-head__lead">
                  <h3 id="extras-dialog-title" className="team-hub-section__title">
                    Extras
                  </h3>
                  <p className="muted">Choose an extra to record it and return to ball scoring.</p>
                </div>
                <button
                  type="button"
                  className="btn-ghost live-scorer-dialog__close"
                  data-dialog-close
                  onClick={() => setExtrasOpen(false)}
                  aria-label="Close extras"
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
              <div className="live-scorer-extras-panel">
        <div className="team-hub-section">
          <div className="team-hub-section-head">
            <div className="team-hub-section-head__lead">
              <h4 className="team-hub-section__title">Wides</h4>
              <p className="muted">Wide is not a legal delivery. The total includes the one-run wide penalty.</p>
            </div>
          </div>
          <div className="catalog-card-grid">
            {[0, 1, 2, 3, 4].map((completedRuns) => {
              const totalWides = completedRuns + 1

              return (
                <button
                  key={`wide-${completedRuns}`}
                  type="button"
                  className="btn-ghost"
                  data-dialog-initial-focus={completedRuns === 0 ? true : undefined}
                  onClick={() =>
                    submitBall({
                      runsExtras: totalWides,
                      extrasType: 'wide',
                      isLegalDelivery: false,
                      strikeRuns: completedRuns,
                    })
                  }
                  disabled={ballMutation.isPending}
                >
                  {completedRuns === 0 ? 'Wide' : `Wide + ${completedRuns}`}
                </button>
              )
            })}
          </div>
        </div>

        <div className="team-hub-section" style={{ marginTop: '1rem' }}>
          <div className="team-hub-section-head">
            <div className="team-hub-section-head__lead">
              <h4 className="team-hub-section__title">No-balls</h4>
              <p className="muted">No-ball is not a legal delivery. Bat runs go to the batter; byes/leg-byes stay as extras.</p>
            </div>
          </div>
          <div className="catalog-card-grid">
            <button
              type="button"
              className="btn-ghost live-scorer-no-ball-only"
              onClick={() =>
                submitBall({
                  runsExtras: 1,
                  extrasType: 'no_ball',
                  isLegalDelivery: false,
                  strikeRuns: 0,
                })
              }
              disabled={ballMutation.isPending}
            >
              No ball
            </button>
            {[1, 2, 3, 4, 6].map((runs) => (
              <button
                key={`no-ball-bat-${runs}`}
                type="button"
                className="btn-ghost live-scorer-no-ball-bat"
                onClick={() =>
                  submitBall({
                    runsBatter: runs,
                    runsExtras: 1,
                    extrasType: 'no_ball',
                    isLegalDelivery: false,
                    strikeRuns: runs,
                  })
                }
                disabled={ballMutation.isPending}
              >
                NB + {runs} bat
              </button>
            ))}
            {[1, 2, 3, 4].map((runs) => (
              <button
                key={`no-ball-bye-${runs}`}
                type="button"
                className="btn-ghost live-scorer-no-ball-extras"
                onClick={() =>
                  submitBall({
                    runsExtras: runs + 1,
                    extrasType: 'no_ball_bye',
                    isLegalDelivery: false,
                    strikeRuns: runs,
                  })
                }
                disabled={ballMutation.isPending}
              >
                NB + {runs} bye
              </button>
            ))}
            {[1, 2, 3, 4].map((runs) => (
              <button
                key={`no-ball-leg-bye-${runs}`}
                type="button"
                className="btn-ghost live-scorer-no-ball-extras"
                onClick={() =>
                  submitBall({
                    runsExtras: runs + 1,
                    extrasType: 'no_ball_leg_bye',
                    isLegalDelivery: false,
                    strikeRuns: runs,
                    legByeAttempted: true,
                  })
                }
                disabled={ballMutation.isPending}
              >
                NB + {runs} leg bye
              </button>
            ))}
          </div>
        </div>

        <div className="team-hub-section" style={{ marginTop: '1rem' }}>
          <div className="team-hub-section-head">
            <div className="team-hub-section-head__lead">
              <h4 className="team-hub-section__title">Byes and leg-byes</h4>
              <p className="muted">These are legal deliveries unless the no-ball options above are used.</p>
            </div>
          </div>
          <div className="catalog-card-grid live-scorer-byes-grid">
            {[1, 2, 3, 4].map((runs) => (
              <button
                key={`bye-${runs}`}
                type="button"
                className="btn-ghost"
                onClick={() =>
                  submitBall({ runsExtras: runs, extrasType: 'bye', strikeRuns: runs })
                }
                disabled={ballMutation.isPending}
              >
                Bye {runs}
              </button>
            ))}
            {[1, 2, 3, 4].map((runs) => (
              <button
                key={`leg-bye-${runs}`}
                type="button"
                className="btn-ghost"
                onClick={() =>
                  submitBall({ runsExtras: runs, extrasType: 'leg_bye', strikeRuns: runs, legByeAttempted: true })
                }
                disabled={ballMutation.isPending}
              >
                Leg bye {runs}
              </button>
            ))}
          </div>
        </div>

        <div className="team-hub-section" style={{ marginTop: '1rem' }}>
          <div className="team-hub-section-head">
            <div className="team-hub-section-head__lead">
              <h4 className="team-hub-section__title">MCC adjustments</h4>
              <p className="muted">Dead balls and penalties do not behave like normal scoring balls.</p>
            </div>
          </div>
          <div className="catalog-card-grid">
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                submitBall({
                  extrasType: null,
                  isLegalDelivery: false,
                  isDeadBall: true,
                  strikeRuns: 0,
                  dismissalText: 'Dead ball',
                })
              }
              disabled={ballMutation.isPending}
            >
              Dead ball
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                submitBall({
                  extrasType: 'penalty',
                  isLegalDelivery: false,
                  isDeadBall: true,
                  penaltyRunsBatting: 5,
                  strikeRuns: 0,
                  dismissalText: 'Five penalty runs to batting side',
                })
              }
              disabled={ballMutation.isPending}
            >
              +5 batting penalty
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                submitBall({
                  extrasType: 'penalty',
                  isLegalDelivery: false,
                  isDeadBall: true,
                  penaltyRunsFielding: 5,
                  strikeRuns: 0,
                  dismissalText: 'Five penalty runs to fielding side',
                })
              }
              disabled={ballMutation.isPending}
            >
              +5 fielding penalty
            </button>
          </div>
        </div>
              </div>
            </section>
          </div>
        ) : null}

        </div>
        <aside className="live-scorer-ball-panel" aria-label="Recent ball-by-ball events">
          <div className="live-scorer-ball-panel__head">
            <div>
              <strong>Ball-by-ball</strong>
              <span>{allLiveEvents.filter((event) => event.innings === innings).length} events</span>
            </div>
            <button
              type="button"
              className="btn-ghost btn--with-icon"
              onClick={() => setActiveScorerPanel('corrections')}
            >
              <Pencil size={16} aria-hidden />
              Fix ball
            </button>
          </div>
          <div className="live-scorer-ball-panel__list">
            {[...allLiveEvents]
              .filter((event) => event.innings === innings)
              .reverse()
              .map((event) => {
                const overSummary = completedOverSummaryByEventId.get(event.id)
                const completedOverBowler = overSummary?.bowlers.find(
                  (bowler) => bowler.playerId === event.bowler_player_id,
                )

                return (
                  <Fragment key={event.id}>
                    {overSummary ? (
                      <section className="live-scorer-ball-panel__over-summary" aria-label={`End of over ${overSummary.over} summary`}>
                        <div className="live-scorer-ball-panel__over-summary-head">
                          <span>End of over {overSummary.over}</span>
                          <strong>
                            {matchTeams.find((team) => team.id === overSummary.battingTeamId)?.name ?? 'Batting team'}{' '}
                            {overSummary.runs}/{overSummary.wickets}
                          </strong>
                        </div>
                        <div className="live-scorer-ball-panel__over-summary-meta">
                          <span>
                            Runs: {overSummary.overRuns} <span aria-hidden> | </span> Wickets: {overSummary.overWickets}
                          </span>
                        </div>
                        <div className="live-scorer-ball-panel__over-summary-batters">
                          {overSummary.batters.map((batter, index) => (
                            <div key={`${batter.playerId ?? 'unknown'}-${index}`} className="live-scorer-ball-panel__over-summary-batter">
                              <span>
                                {playerName(playerById, batter.playerId)}* <strong>{batter.runs} ({batter.balls})</strong>
                              </span>
                              {index === 0 && completedOverBowler ? (
                                <strong className="live-scorer-ball-panel__over-summary-bowler-inline">
                                  {playerName(playerById, completedOverBowler.playerId)}{' '}
                                  {oversLabel(completedOverBowler.legalBalls)}–{completedOverBowler.maidens}–{completedOverBowler.runs}–{completedOverBowler.wickets}
                                </strong>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}
                    <button
                      type="button"
                      className="live-scorer-ball-panel__event"
                      onClick={() => beginEditingBall(event)}
                      title="Open this event in Fix ball"
                    >
                      <span className={liveEventChipClass(event)}>
                        {liveEventChipLabel(event)}
                      </span>
                      <span className="live-scorer-ball-panel__event-copy">
                        <strong>
                          {event.is_dead_ball && RETIREMENT_DISMISSALS.has(event.wicket_type ?? '')
                            ? 'No ball'
                            : `${event.over_number}.${event.ball_number}`}{' '}
                          {playerName(playerById, event.bowler_player_id)} to{' '}
                          {playerName(playerById, event.striker_player_id)}
                        </strong>
                        <span>
                          {liveEventLabel(event)}
                          {event.dismissal_text ? ` · ${event.dismissal_text}` : ''}
                        </span>
                        {event.notes ? <small>{event.notes}</small> : null}
                      </span>
                      <Pencil size={15} aria-hidden />
                    </button>
                  </Fragment>
                )
              })}
            {allLiveEvents.every((event) => event.innings !== innings) ? (
              <p className="muted">No events recorded in this innings.</p>
            ) : null}
          </div>
        </aside>
        </div>

        {inningsOverOpen ? (
          <div className="live-scorer-dialog-backdrop">
            <section
              className="live-scorer-dialog live-scorer-dialog--match-over"
              role="dialog"
              aria-modal="true"
              aria-labelledby="innings-over-dialog-title"
            >
              <div className="team-hub-section-head">
                <div className="team-hub-section-head__lead">
                  <h3 id="innings-over-dialog-title" className="team-hub-section__title">
                    INNINGS OVER
                  </h3>
                  <p className="muted">
                    {reviewTeamName(firstInningsSummary?.batting_team_id)} have completed the allocated {liveQ.data?.match_overs ?? matchOvers} overs.
                    Confirm to set up the second innings.
                  </p>
                </div>
              </div>
              <div className="catalog-toolbar live-scorer-dialog__actions">
                {(() => {
                  const lastLegalEvent = [...(liveQ.data?.events ?? [])]
                    .filter((event) => event.innings === innings && event.is_legal_delivery)
                    .sort((a, b) => b.sequence_number - a.sequence_number || b.id - a.id)[0]
                  return lastLegalEvent ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => continueOverMutation.mutate(lastLegalEvent)}
                      disabled={continueOverMutation.isPending}
                    >
                      {continueOverMutation.isPending
                        ? 'Updating…'
                        : 'Umpire count: continue this over'}
                    </button>
                  ) : null
                })()}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => endCurrentInnings(true)}
                >
                  Confirm & move to 2nd innings
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {matchOverOpen ? (
          <div className="live-scorer-dialog-backdrop">
            <section
              className="live-scorer-dialog live-scorer-dialog--match-over"
              role="dialog"
              aria-modal="true"
              aria-labelledby="match-over-dialog-title"
            >
              <div className="team-hub-section-head">
                <div className="team-hub-section-head__lead">
                  <h3 id="match-over-dialog-title" className="team-hub-section__title">
                    MATCH OVER
                  </h3>
                  <p className="muted">
                    {reviewTeamName(secondInningsSummary?.batting_team_id)} have reached the target of {chaseTarget}.
                    Review the scorecard, then finalize the official result.
                  </p>
                </div>
              </div>
              <div className="catalog-toolbar live-scorer-dialog__actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setMatchOverOpen(false)
                    setFinalReviewConfirmed(false)
                    setActiveScorerPanel('review')
                  }}
                >
                  Review & finalize match
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {requestEditOpen ? (
          <div className="live-scorer-dialog-backdrop">
            <section
              className="live-scorer-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="scorecard-edit-request-title"
            >
              <div className="team-hub-section-head">
                <div className="team-hub-section-head__lead">
                  <h3 id="scorecard-edit-request-title" className="team-hub-section__title">
                    Request scorecard correction access
                  </h3>
                  <p className="muted">
                    Tell the super admin what needs correcting. Approved access lasts 120 minutes and every change remains in the audit trail.
                  </p>
                </div>
              </div>
              <label className="inline-edit__field">
                <span className="inline-edit__label">Correction reason</span>
                <textarea
                  className="inline-edit__control"
                  value={requestEditReason}
                  onChange={(event) => setRequestEditReason(event.target.value)}
                  placeholder="For example: wicket was recorded against the wrong batter at 18.4."
                  rows={4}
                  maxLength={512}
                />
              </label>
              <div className="catalog-toolbar live-scorer-dialog__actions">
                <button
                  type="button"
                  className="btn-ghost"
                  data-dialog-close
                  onClick={() => setRequestEditOpen(false)}
                  disabled={requestEditAccessMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => requestEditAccessMutation.mutate(requestEditReason)}
                  disabled={requestEditAccessMutation.isPending}
                >
                  {requestEditAccessMutation.isPending ? 'Requesting…' : 'Send request'}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {bowlerChangeOpen ? (
          <div className="live-scorer-dialog-backdrop">
            <section
              className="live-scorer-dialog live-scorer-dialog--bowler-change"
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-bowler-dialog-title"
            >
              <div className="team-hub-section-head">
                <div className="team-hub-section-head__lead">
                  <h3 id="new-bowler-dialog-title" className="team-hub-section__title">
                    End of over — choose the new bowler
                  </h3>
                  <p className="muted">
                    Select the bowler for over {completedOverSummary ? completedOverSummary.over + 1 : nextOverNumber + 1} before recording the next ball.
                  </p>
                </div>
              </div>

              {completedOverSummary ? (
                <section className="live-scorer-over-summary" aria-label="End of over summary">
                  <div className="live-scorer-over-summary__headline">
                    <span>END OF OVER {completedOverSummary.over}</span>
                    <strong>
                      {matchTeams.find((team) => team.id === completedOverSummary.battingTeamId)?.name ?? 'Batting team'}{' '}
                      {completedOverSummary.runs}/{completedOverSummary.wickets}
                    </strong>
                  </div>
                  <div className="live-scorer-over-summary__meta">
                    <span>Runs: {completedOverSummary.overRuns}</span>
                    <span>Wickets: {completedOverSummary.overWickets}</span>
                  </div>
                  <div className="live-scorer-over-summary__details">
                    <div className="live-scorer-over-summary__batters">
                      <span className="live-scorer-over-summary__batters-header">BATSMEN</span>
                      {completedOverSummary.batters.map((batter, index) => (
                        <div key={`${batter.playerId ?? 'unknown'}-${index}`} className="live-scorer-over-summary__batter">
                          <span>{playerName(playerById, batter.playerId)}*</span>
                          <strong>{batter.runs} ({batter.balls})</strong>
                        </div>
                      ))}
                    </div>
                    <div className="live-scorer-over-summary__bowler">
                      <span className="live-scorer-over-summary__bowler-header">BOWLER</span>
                      <span className="live-scorer-over-summary__bowler-header">O</span>
                      <span className="live-scorer-over-summary__bowler-header">M</span>
                      <span className="live-scorer-over-summary__bowler-header">R</span>
                      <span className="live-scorer-over-summary__bowler-header">W</span>
                      {completedOverSummary.bowlers.map((bowler) => (
                        <Fragment key={bowler.playerId}>
                          <strong className="live-scorer-over-summary__bowler-name">
                            {playerName(playerById, bowler.playerId)}
                          </strong>
                          <strong className="live-scorer-over-summary__bowler-figure">
                            {oversLabel(bowler.legalBalls)}
                          </strong>
                          <strong className="live-scorer-over-summary__bowler-figure">
                            {bowler.maidens}
                          </strong>
                          <strong className="live-scorer-over-summary__bowler-figure">
                            {bowler.runs}
                          </strong>
                          <strong className="live-scorer-over-summary__bowler-figure">
                            {bowler.wickets}
                          </strong>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}

              <label className="inline-edit__field">
                <span className="inline-edit__label">Over note</span>
                <input
                  className="inline-edit__control"
                  value={overNote}
                  onChange={(event) => setOverNote(event.target.value)}
                  placeholder="Optional note for this completed over"
                  disabled={saveOverNoteMutation.isPending}
                />
                <span className="muted" style={{ marginTop: '0.4rem' }}>
                  Saved with the final legal ball of the over when you start the new over.
                </span>
              </label>

              <label className="inline-edit__field">
                <span className="inline-edit__label">New bowler</span>
                <select
                  className="inline-edit__control"
                  value={nextBowlerPlayerId}
                  onChange={(event) => {
                    setNextBowlerPlayerId(event.target.value ? Number(event.target.value) : '')
                    setActionError(null)
                  }}
                  autoFocus
                >
                  <option value="">Choose new bowler</option>
                  {newOverBowlerOptions.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.full_name}
                    </option>
                  ))}
                </select>
              </label>

              {newOverBowlerOptions.length === 0 ? (
                <p className="login-error">
                  Add another eligible bowler to the match-day squad before continuing.
                </p>
              ) : null}
              {actionError ? <p className="login-error">{actionError}</p> : null}

              <div className="catalog-toolbar live-scorer-dialog__actions">
                {(() => {
                  const lastLegalEvent = [...(liveQ.data?.events ?? [])]
                    .filter((event) => event.innings === innings && event.is_legal_delivery)
                    .sort((a, b) => b.sequence_number - a.sequence_number || b.id - a.id)[0]
                  return lastLegalEvent ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => continueOverMutation.mutate(lastLegalEvent)}
                      disabled={continueOverMutation.isPending}
                    >
                      {continueOverMutation.isPending
                        ? 'Updating…'
                        : 'Umpire miscount: continue this over'}
                    </button>
                  ) : null
                })()}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={confirmNewOverBowler}
                  disabled={!nextBowlerPlayerId || newOverBowlerOptions.length === 0 || saveOverNoteMutation.isPending}
                >
                  {saveOverNoteMutation.isPending ? 'Saving note…' : 'Start new over'}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {wicketOpen ? (
          <div className="live-scorer-dialog-backdrop">
          <section
            className="live-scorer-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wicket-dialog-title"
          >
            <div className="team-hub-section-head">
              <div className="team-hub-section-head__lead">
                <h3 id="wicket-dialog-title" className="team-hub-section__title">
                  {wicketIsRetirement ? 'Retirement details' : 'Wicket details'}
                </h3>
                <p className="muted">
                  {wicketIsRetirement
                    ? 'This changes the batter without recording a delivery or ball faced.'
                    : 'Record the delivery, dismissal, fielder, bowler and next batter. Ball commentary remains separate.'}
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost live-scorer-dialog__close"
                data-dialog-close
                onClick={closeWicketDetails}
                aria-label="Close wicket details"
              >
                <X size={20} aria-hidden />
              </button>
            </div>

            <div className="inline-edit__grid">
              {!wicketIsRetirement ? <label className="inline-edit__field">
                <span className="inline-edit__label">1. Delivery</span>
                <select
                  className="inline-edit__control"
                  data-dialog-initial-focus
                  value={wicketDeliveryType}
                  onChange={(event) => {
                    const nextDelivery = event.target.value as WicketDeliveryType
                    const nextOptions = dismissalOptionsForDelivery(nextDelivery)
                    setWicketDeliveryType(nextDelivery)
                    if (!nextOptions.some((option) => option.value === wicketType)) {
                      setWicketType(nextOptions[0]?.value ?? 'run_out')
                    }
                    setDismissalText('')
                    setDismissalTextTouched(false)
                  }}
                >
                  <option value="legal">Legal ball</option>
                  <option value="wide">Wide + wicket</option>
                  <option value="no_ball">No-ball + wicket</option>
                </select>
              </label> : (
                <div className="inline-edit__field">
                  <span className="inline-edit__label">Delivery</span>
                  <div className="inline-edit__control live-scorer-no-delivery">
                    No delivery recorded
                  </div>
                </div>
              )}

              <label className="inline-edit__field">
                <span className="inline-edit__label">2. Player out</span>
                <select
                  className="inline-edit__control"
                  data-dialog-initial-focus={wicketIsRetirement ? true : undefined}
                  value={wicketPlayerId || eligibleWicketPlayers[0]?.id || ''}
                  onChange={(event) => setWicketPlayerId(Number(event.target.value))}
                >
                  {eligibleWicketPlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inline-edit__field">
                <span className="inline-edit__label">3. Mode of dismissal</span>
                <select
                  className="inline-edit__control"
                  value={wicketType}
                  onChange={(event) => {
                    const nextWicketType = event.target.value
                    setWicketType(nextWicketType)
                    if (nextWicketType !== 'run_out') setWicketRunsCompleted(0)
                    if (RETIREMENT_DISMISSALS.has(nextWicketType)) {
                      setWicketDeliveryType('legal')
                    }
                    setDismissalText('')
                    setDismissalTextTouched(false)
                  }}
                >
                  {wicketDismissalOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inline-edit__field">
                <span className="inline-edit__label">
                  {wicketIsRetirement ? 'Current bowler' : '4. Bowler'}
                </span>
                <select
                  className="inline-edit__control"
                  value={bowlerPlayerId}
                  onChange={(event) => {
                    setBowlerPlayerId(event.target.value ? Number(event.target.value) : '')
                    setDismissalText('')
                    setDismissalTextTouched(false)
                  }}
                >
                  <option value="">Choose bowler</option>
                  {bowlingPlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.full_name}
                    </option>
                  ))}
                </select>
              </label>

              {currentWicketOption?.needsFielder ? (
                <label className="inline-edit__field">
                  <span className="inline-edit__label">
                    {currentWicketOption.fielderLabel ?? 'Fielder'}
                  </span>
                  <select
                    className="inline-edit__control"
                    value={fielderPlayerId}
                    onChange={(event) =>
                      {
                        setFielderPlayerId(event.target.value ? Number(event.target.value) : '')
                        setDismissalText('')
                        setDismissalTextTouched(false)
                      }
                    }
                  >
                    <option value="">Choose fielder</option>
                    {fieldingPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.full_name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="inline-edit__field live-scorer-dialog__how-out">
                <span className="inline-edit__label">How out text on scorecard</span>
                <input
                  className="inline-edit__control"
                  value={resolvedDismissalText}
                  onChange={(event) => {
                    setDismissalText(event.target.value)
                    setDismissalTextTouched(true)
                  }}
                  placeholder="Type the exact scorecard dismissal"
                />
                <span className="muted">
                  This appears in How out. The commentary box stays as the ball description.
                </span>
              </label>

              {wicketType === 'run_out' ? (
                <label className="inline-edit__field">
                  <span className="inline-edit__label">Wicket broken at</span>
                  <select
                    className="inline-edit__control"
                    value={wicketEnd}
                    onChange={(event) => setWicketEnd(event.target.value as WicketEnd)}
                  >
                    <option value="striker">Striker end</option>
                    <option value="non_striker">Non-striker end</option>
                  </select>
                </label>
              ) : null}

              {wicketType === 'run_out' ? (
                <label className="inline-edit__field">
                  <span className="inline-edit__label">
                    {wicketDeliveryType === 'wide'
                      ? 'Completed runs (wide penalty added automatically)'
                      : wicketDeliveryType === 'no_ball'
                        ? 'Completed runs (no-ball penalty added automatically)'
                        : 'Runs completed before wicket'}
                  </span>
                  <select
                    className="inline-edit__control"
                    value={wicketRunsCompleted}
                    onChange={(event) => setWicketRunsCompleted(Number(event.target.value))}
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((runs) => (
                      <option key={runs} value={runs}>
                        {wicketDeliveryType === 'wide'
                          ? `${runs + 1} wide${runs === 0 ? '' : 's'} total (${runs} completed)`
                          : wicketDeliveryType === 'no_ball'
                            ? `${runs} completed + no-ball`
                            : `${runs} run${runs === 1 ? '' : 's'}`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {wicketType === 'run_out' &&
              wicketRunsCompleted > 0 &&
              wicketDeliveryType !== 'wide' ? (
                <label className="inline-edit__field">
                  <span className="inline-edit__label">
                    {wicketDeliveryType === 'no_ball'
                      ? 'Credit completed runs as (plus one no-ball)'
                      : 'Credit those runs as'}
                  </span>
                  <select
                    className="inline-edit__control"
                    value={wicketRunCredit}
                    onChange={(event) => setWicketRunCredit(event.target.value as WicketRunCredit)}
                  >
                    <option value="bat">Batter runs</option>
                    <option value="bye">Byes</option>
                    <option value="leg_bye">Leg byes</option>
                  </select>
                </label>
              ) : null}

              {!wicketIsRetirement ? (
                <label className="inline-edit__field">
                  <span className="inline-edit__label">Batters crossed?</span>
                  <select
                    className="inline-edit__control"
                    value={battersCrossed ? 'yes' : 'no'}
                    onChange={(event) => setBattersCrossed(event.target.value === 'yes')}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>
              ) : null}

              {wicketWillEndInnings ? (
                <div className="inline-edit__field">
                  <span className="inline-edit__label">10th wicket</span>
                  <div className="inline-edit__control live-scorer-innings-complete" role="status">
                    Innings complete
                  </div>
                </div>
              ) : (
                <label className="inline-edit__field">
                  <span className="inline-edit__label">
                    {wicketIsRetirement ? 'Batter coming in' : '5. New batter'}
                  </span>
                  <select
                    className="inline-edit__control"
                    value={newBatterPlayerId}
                    onChange={(event) =>
                      setNewBatterPlayerId(event.target.value ? Number(event.target.value) : '')
                    }
                  >
                    <option value="">Choose new batter</option>
                    {availableNewBatters.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.full_name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {actionError ? <p className="login-error">{actionError}</p> : null}

            <div className="live-scorer-wicket-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={submitWicket}
                disabled={ballMutation.isPending}
              >
                {ballMutation.isPending
                  ? 'Saving…'
                  : wicketIsRetirement
                    ? 'Save retirement (no ball)'
                    : 'Save wicket'}
              </button>
            </div>
          </section>
          </div>
        ) : null}

        <div className="catalog-toolbar live-scorer-match-actions">
          <button
            type="button"
            className="btn-ghost btn--with-icon live-scorer-refresh-action"
            onClick={() => void liveQ.refetch()}
          >
            <RotateCcw size={18} strokeWidth={2} aria-hidden />
            Refresh
          </button>
          {innings === 1 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => endCurrentInnings()}
              disabled={ballMutation.isPending || undoMutation.isPending}
            >
              End innings
            </button>
          ) : null}
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              if (matchFinalized) {
                setActiveScorerPanel('score')
              } else {
                setFinalReviewConfirmed(false)
                setActiveScorerPanel('review')
              }
            }}
            disabled={completeMutation.isPending}
          >
            {matchFinalized ? 'Finalized / edit' : 'Review & finalize'}
          </button>
          <button
            type="button"
            className="btn-ghost live-scorer-abandon-action"
            onClick={() => void completeMutation.mutate('abandoned')}
            disabled={completeMutation.isPending}
          >
            Mark abandoned
          </button>
        </div>
      </section>
      ) : null}

      {effectiveScorerPanel === 'review' ? (
        <section className="team-hub-section">
          <div className="team-hub-section-head">
            <div className="team-hub-section-head__lead">
              <h2 className="team-hub-section__title">Final review</h2>
              <p className="muted">
                Check the score, extras, wickets, fielding credits, and match overs before creating the official result and player stats.
              </p>
            </div>
          </div>

          <div className="live-scorer-review-grid">
            {reviewSummaries.length > 0 ? (
              reviewSummaries.map((summary) => (
                <div key={summary.innings} className="live-scorer-review-card">
                  <strong>{summary.innings === 1 ? '1st innings' : '2nd innings'}</strong>
                  <p>
                    {reviewTeamName(summary.batting_team_id)} {summary.runs}/{summary.wickets} in {summary.overs_label} overs
                  </p>
                  <p className="muted">Bowling: {reviewTeamName(summary.bowling_team_id)}</p>
                  <p className="muted">{reviewExtrasText(summary.innings)}</p>
                </div>
              ))
            ) : (
              <div className="live-scorer-review-card">
                <strong>No innings yet</strong>
                <p className="muted">Start scoring before final review.</p>
              </div>
            )}

            <div className="live-scorer-review-card">
              <strong>Result preview</strong>
              <p>{reviewResultPreview}</p>
              <p className="muted">Match overs per side: {matchOvers || 'not set'}</p>
            </div>

            <div className="live-scorer-review-card">
              <strong>NRR check</strong>
              <p className="muted">
                All-out innings use the full match overs. Full-overs innings use the full match overs. A successful chase uses the actual overs faced.
              </p>
            </div>
          </div>

          <div className="team-hub-section" style={{ marginTop: '1rem' }}>
            <h3 className="team-hub-section__title">Fielding credits</h3>
            {reviewFieldingEvents.length > 0 ? (
              <ul className="live-scorer-checklist">
                {reviewFieldingEvents.map((event) => (
                  <li key={event.id}>
                    {event.innings}.{event.over_number}.{event.ball_number}: {dismissalLabel(event.wicket_type)} · out: {playerName(playerById, event.wicket_player_id)}
                    {event.wicket_type === 'caught_and_bowled'
                      ? ` · catch: ${playerName(playerById, event.bowler_player_id)}`
                      : event.fielder_player_id
                        ? ` · fielder: ${playerName(playerById, event.fielder_player_id)}`
                        : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No caught, stumped, or run-out fielding credits recorded yet.</p>
            )}
          </div>

          {finalReviewWarnings.length > 0 ? (
            <div className="live-scorer-warning-list" role="alert">
              {finalReviewWarnings.map((warning) => (
                <div key={warning} className="live-scorer-warning">
                  {warning}
                </div>
              ))}
            </div>
          ) : null}

          {matchFinalized ? (
            <div className="catalog-toolbar">
              <p className="muted">
                {scorecardReadOnly
                  ? 'This match is finalized and the scorecard is locked. Request super-admin permission before making corrections.'
                  : 'This match is finalized. You can return to scoring to make an approved correction.'}
              </p>
              {!scorecardReadOnly ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setActiveScorerPanel('score')}
                >
                  Finalized / edit
                </button>
              ) : null}
            </div>
          ) : scorecardReadOnly ? (
            <p className="muted">
              This final scorecard is read only. Request super-admin permission
              before making corrections.
            </p>
          ) : (
            <>
              <label className="live-scorer-final-confirm">
                <input
                  type="checkbox"
                  checked={finalReviewConfirmed}
                  onChange={(event) =>
                    setFinalReviewConfirmed(event.target.checked)
                  }
                />
                <span>
                  I have checked the score, wickets, fielding credits, extras,
                  and NRR match overs. Finalize this match as official.
                </span>
              </label>

              <div className="catalog-toolbar">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setActiveScorerPanel('score')}
                >
                  Back to scoring
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={markMatchOver}
                  disabled={
                    completeMutation.isPending || !finalReviewConfirmed
                  }
                >
                  {completeMutation.isPending
                    ? 'Finalizing…'
                    : 'Finalize official result'}
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}

      {effectiveScorerPanel === 'help' ? (
        <section className="team-hub-section">
          <div className="team-hub-section-head">
            <div className="team-hub-section-head__lead">
              <h2 className="team-hub-section__title">Scorer help</h2>
              <p className="muted">Quick guide for live scorers during match day.</p>
            </div>
          </div>

          <div className="live-scorer-help-grid">
            <div className="live-scorer-review-card">
              <strong>Normal ball</strong>
              <p className="muted">Choose striker, non-striker, bowler, then tap a run button from 0 to 7. Strike rotates automatically on odd runs and at the end of an over.</p>
            </div>
            <div className="live-scorer-review-card">
              <strong>Extras</strong>
              <p className="muted">Tap Extras for wides, no-balls, byes, leg-byes, penalties, dead ball, and short-run adjustments.</p>
            </div>
            <div className="live-scorer-review-card">
              <strong>Wicket</strong>
              <p className="muted">Tap Out / wicket, choose legal ball, wide, or no-ball, then select the player out, dismissal type, fielder if required, wicket end, completed runs and their credit, and the new batter.</p>
            </div>
            <div className="live-scorer-review-card">
              <strong>Correction</strong>
              <p className="muted">Use Undo last to remove the latest delivery and restore its striker, non-striker and bowler. Use Fix to find and edit or delete any individual delivery. The score and scorecard are recalculated after correction.</p>
            </div>
            <div className="live-scorer-review-card">
              <strong>End innings</strong>
              <p className="muted">Use End innings when the first innings is complete, then pick the second-innings striker, non-striker and bowler.</p>
            </div>
            <div className="live-scorer-review-card">
              <strong>Finalize</strong>
              <p className="muted">Use Review & finalize only after both innings are checked. Super admins can Reset test data for practice fixtures.</p>
            </div>
          </div>
        </section>
      ) : null}

      {editingBall && effectiveScorerPanel === 'corrections' ? (
        <section className="team-hub-section">
          <div className="team-hub-section-head">
            <div className="team-hub-section-head__lead">
              <h2 className="team-hub-section__title">Correct recorded ball</h2>
              <p className="muted">
                Edit the saved ball event. The backend will recalculate live score labels, fielding stats, and the official scorecard if this match was already finalized.
              </p>
            </div>
          </div>

          {editBallError ? <p className="login-error">{editBallError}</p> : null}

          <div className="inline-edit__grid">
            <label className="inline-edit__field">
              <span className="inline-edit__label">Innings</span>
              <input
                type="number"
                className="inline-edit__control"
                value={editingBall.body.innings}
                onChange={(event) => updateEditingBall('innings', Number(event.target.value) || 1)}
              />
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">Striker</span>
              <select
                className="inline-edit__control"
                value={editingBall.body.striker_player_id}
                onChange={(event) => updateEditingBall('striker_player_id', Number(event.target.value))}
              >
                {playersForTeam(editingBall.body.batting_team_id).map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">Non-striker</span>
              <select
                className="inline-edit__control"
                value={editingBall.body.non_striker_player_id ?? ''}
                onChange={(event) =>
                  updateEditingBall(
                    'non_striker_player_id',
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
              >
                <option value="">— None —</option>
                {playersForTeam(editingBall.body.batting_team_id).map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">Bowler</span>
              <select
                className="inline-edit__control"
                value={editingBall.body.bowler_player_id}
                onChange={(event) => updateEditingBall('bowler_player_id', Number(event.target.value))}
              >
                {playersForTeam(editingBall.body.bowling_team_id).map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">Batter runs</span>
              <input
                type="number"
                min={0}
                className="inline-edit__control"
                value={editingBall.body.runs_batter ?? 0}
                onChange={(event) => updateEditingBall('runs_batter', Number(event.target.value) || 0)}
              />
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">Extras type</span>
              <select
                className="inline-edit__control"
                value={editingBall.body.extras_type ?? ''}
                onChange={(event) => updateEditingBall('extras_type', event.target.value || null)}
              >
                {EXTRAS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">Extras runs</span>
              <input
                type="number"
                min={0}
                className="inline-edit__control"
                value={editingBall.body.runs_extras ?? 0}
                onChange={(event) => updateEditingBall('runs_extras', Number(event.target.value) || 0)}
              />
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">Completed runs for strike</span>
              <input
                type="number"
                min={0}
                className="inline-edit__control"
                value={editingBall.body.completed_runs ?? 0}
                onChange={(event) => updateEditingBall('completed_runs', Number(event.target.value) || 0)}
              />
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">Boundary</span>
              <select
                className="inline-edit__control"
                value={editingBall.body.boundary_type ?? ''}
                onChange={(event) => updateEditingBall('boundary_type', event.target.value || null)}
              >
                {BOUNDARY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">Boundary runs</span>
              <input
                type="number"
                min={0}
                className="inline-edit__control"
                value={editingBall.body.boundary_runs ?? 0}
                onChange={(event) => updateEditingBall('boundary_runs', Number(event.target.value) || 0)}
              />
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">Penalty to batting side</span>
              <input
                type="number"
                min={0}
                step={5}
                className="inline-edit__control"
                value={editingBall.body.penalty_runs_batting ?? 0}
                onChange={(event) => updateEditingBall('penalty_runs_batting', Number(event.target.value) || 0)}
              />
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">Penalty to fielding side</span>
              <input
                type="number"
                min={0}
                step={5}
                className="inline-edit__control"
                value={editingBall.body.penalty_runs_fielding ?? 0}
                onChange={(event) => updateEditingBall('penalty_runs_fielding', Number(event.target.value) || 0)}
              />
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">Short runs</span>
              <input
                type="number"
                min={0}
                className="inline-edit__control"
                value={editingBall.body.short_runs ?? 0}
                onChange={(event) => updateEditingBall('short_runs', Number(event.target.value) || 0)}
              />
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">Dismissal</span>
              <select
                className="inline-edit__control"
                value={editingBall.body.wicket_type ?? ''}
                onChange={(event) => updateEditingBall('wicket_type', event.target.value || null)}
              >
                <option value="">— No wicket —</option>
                {DISMISSAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">1. Player out</span>
              <select
                className="inline-edit__control"
                value={editingBall.body.wicket_player_id ?? ''}
                onChange={(event) =>
                  updateEditingBall(
                    'wicket_player_id',
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
              >
                <option value="">— None —</option>
                {playersForTeam(editingBall.body.batting_team_id).map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">Replacement batter</span>
              <select
                className="inline-edit__control"
                value={editingBall.body.replacement_player_id ?? ''}
                onChange={(event) =>
                  updateEditingBall(
                    'replacement_player_id',
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
              >
                <option value="">— None —</option>
                {playersForTeam(editingBall.body.batting_team_id).map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">Fielder / catcher / wicketkeeper</span>
              <select
                className="inline-edit__control"
                value={editingBall.body.fielder_player_id ?? ''}
                onChange={(event) =>
                  updateEditingBall(
                    'fielder_player_id',
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
              >
                <option value="">— None —</option>
                {playersForTeam(editingBall.body.bowling_team_id).map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">Run out wicket end</span>
              <select
                className="inline-edit__control"
                value={editingBall.body.wicket_end ?? ''}
                onChange={(event) => updateEditingBall('wicket_end', event.target.value ? (event.target.value as WicketEnd) : null)}
              >
                <option value="">— Not applicable —</option>
                <option value="striker">Striker end</option>
                <option value="non_striker">Non-striker end</option>
              </select>
            </label>

            <label className="inline-edit__field">
              <span className="inline-edit__label">Notes / correction reason</span>
              <textarea
                className="inline-edit__control"
                rows={3}
                value={editingBall.body.notes ?? ''}
                onChange={(event) => updateEditingBall('notes', event.target.value || null)}
              />
            </label>
          </div>

          <div className="catalog-toolbar">
            <label className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                checked={editingBall.body.is_legal_delivery !== false}
                onChange={(event) => updateEditingBall('is_legal_delivery', event.target.checked)}
              />
              <span className="form-check-label">Legal delivery</span>
            </label>
            <label className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                checked={editingBall.body.is_dead_ball === true}
                onChange={(event) => updateEditingBall('is_dead_ball', event.target.checked)}
              />
              <span className="form-check-label">Dead ball</span>
            </label>
            <label className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                checked={editingBall.body.batters_crossed === true}
                onChange={(event) => updateEditingBall('batters_crossed', event.target.checked)}
              />
              <span className="form-check-label">Batters crossed</span>
            </label>
          </div>

          <div className="catalog-toolbar">
            <button
              type="button"
              className="btn-primary"
              onClick={saveEditingBall}
              disabled={editBallMutation.isPending}
            >
              Save correction
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setEditingBall(null)}
              disabled={editBallMutation.isPending}
            >
              Cancel edit
            </button>
          </div>
        </section>
      ) : null}

      {effectiveScorerPanel === 'balls' || effectiveScorerPanel === 'corrections' ? (
      <section className="team-hub-section">
        <div className="team-hub-section-head">
          <div className="team-hub-section-head__lead">
            <h2 className="team-hub-section__title">
              {effectiveScorerPanel === 'corrections' ? 'Choose a delivery to correct' : 'Ball-by-ball'}
            </h2>
            <p className="muted">
              {effectiveScorerPanel === 'corrections'
                ? 'Every recorded delivery is shown below. Select Edit on the exact ball you want to correct, including wides and no-balls that may share the same over.ball number.'
                : 'Latest scoring events for this match.'}
            </p>
          </div>
        </div>

        {liveQ.isLoading ? <p className="muted">Loading live score…</p> : null}

        {effectiveScorerPanel === 'corrections' && allLiveEvents.length > 0 ? (
          <label className="inline-edit__field" style={{ maxWidth: '34rem' }}>
            <span className="inline-edit__label">Find a delivery</span>
            <input
              type="search"
              className="inline-edit__control"
              value={correctionSearch}
              onChange={(event) => setCorrectionSearch(event.target.value)}
              placeholder="Search 9.1, event number, player, bowler or result…"
            />
          </label>
        ) : null}

        {allLiveEvents.length === 0 ? (
          <p className="muted">No balls recorded yet.</p>
        ) : displayedLiveEvents.length === 0 ? (
          <p className="muted">No recorded deliveries match that search.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Delivery</th>
                  <th>Striker</th>
                  <th>Non-striker</th>
                  <th>Bowler</th>
                  <th>Result</th>
                  <th>Dismissal / fielder</th>
                  <th>Notes</th>
                  {effectiveScorerPanel === 'corrections' ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {displayedLiveEvents.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <strong>{event.innings}.{event.over_number}.{event.ball_number}</strong>
                      <div className="muted">Event #{event.sequence_number}</div>
                    </td>
                    <td>{playerName(playerById, event.striker_player_id)}</td>
                    <td>{playerName(playerById, event.non_striker_player_id)}</td>
                    <td>{playerName(playerById, event.bowler_player_id)}</td>
                    <td>{liveEventLabel(event)}</td>
                    <td>
                      {event.wicket_type
                        ? `${dismissalLabel(event.wicket_type)} · out: ${playerName(
                            playerById,
                            event.wicket_player_id,
                          )}${
                            event.fielder_player_id
                              ? ` · fielder: ${playerName(playerById, event.fielder_player_id)}`
                              : ''
                          }${event.wicket_end ? ` · end: ${event.wicket_end.replace('_', '-')}` : ''}${
                            event.batters_crossed ? ' · crossed' : ''
                          }`
                        : '—'}
                    </td>
                    <td>{event.notes ?? event.dismissal_text ?? '—'}</td>
                    {effectiveScorerPanel === 'corrections' ? (
                      <td>
                        <div className="catalog-toolbar">
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => beginEditingBall(event)}
                            disabled={editBallMutation.isPending || deleteBallMutation.isPending}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => deleteRecordedBall(event)}
                            disabled={editBallMutation.isPending || deleteBallMutation.isPending}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}
      </div>
    </div>
  )
}
