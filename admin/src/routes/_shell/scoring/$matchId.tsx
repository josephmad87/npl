import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { RotateCcw, Save, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type {
  LiveBallEventDto,
  LiveBallEventInput,
  LiveScoreStateDto,
  MatchDto,
  MatchLiveSetupInput,
  MatchSquadDto,
  MatchSquadRole,
  MatchSquadSaveInput,
  Paginated,
  PlayerDto,
  TeamDto,
} from '@/lib/api-types'
import { adminGet, adminPost } from '@/lib/admin-client'
import { apiFetch } from '@/lib/api'
import { getSession } from '@/lib/session'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'

export const Route = createFileRoute('/_shell/scoring/$matchId')({
  component: LiveScoringPage,
})

type ScoringTeam = {
  id: number
  name: string
}

type PlayerRoleMap = Record<number, MatchSquadRole | ''>

type BallSubmitPayload = {
  body: LiveBallEventInput
  newBatterId?: number | null
  strikeRuns?: number
}

type WicketEnd = 'striker' | 'non_striker'
type WicketRunCredit = 'bat' | 'bye' | 'leg_bye'

type EditingBallDraft = {
  eventId: number
  body: LiveBallEventInput
}

type ScorerPanel = 'score' | 'setup' | 'squads' | 'balls' | 'corrections' | 'review' | 'help'

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
    is_dead_ball: event.is_dead_ball,
    wicket_type: event.wicket_type,
    wicket_player_id: event.wicket_player_id,
    fielder_player_id: event.fielder_player_id,
    wicket_end: event.wicket_end,
    batters_crossed: event.batters_crossed,
    dismissal_text: event.dismissal_text,
    notes: event.notes,
  }
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
  { value: 'stumped', label: 'Stumped', needsFielder: true, fielderLabel: 'Wicketkeeper' },
  { value: 'hit_wicket', label: 'Hit wicket', needsFielder: false },
  { value: 'retired_hurt', label: 'Retired hurt', needsFielder: false },
  { value: 'retired_out', label: 'Retired out', needsFielder: false },
  { value: 'retired_not_out', label: 'Retired not out', needsFielder: false },
  { value: 'hit_ball_twice', label: 'Hit the ball twice', needsFielder: false },
  { value: 'obstructing_field', label: 'Obstructing the field', needsFielder: false },
  { value: 'timed_out', label: 'Timed out', needsFielder: false },
]

function adminAccessToken(): string | undefined {
  const session = getSession() as
    | { accessToken?: string; access_token?: string; token?: string }
    | null
    | undefined

  return session?.accessToken ?? session?.access_token ?? session?.token
}

async function adminDeleteJson<T>(path: string): Promise<T> {
  return apiFetch<T>(path, {
    method: 'DELETE',
    accessToken: adminAccessToken(),
  })
}

async function adminPutJson<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PUT',
    accessToken: adminAccessToken(),
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
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

function liveEventLabel(event: LiveBallEventDto): string {
  if (event.is_dead_ball) {
    if (event.penalty_runs_batting) return `Penalty +${event.penalty_runs_batting}`
    if (event.penalty_runs_fielding) return `Penalty fielding +${event.penalty_runs_fielding}`
    return 'Dead ball'
  }

  if (event.wicket_type) return 'W'

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

function liveEventChipLabel(event: LiveBallEventDto): string {
  if (event.is_dead_ball) {
    if (event.penalty_runs_batting || event.penalty_runs_fielding) return '+5'
    return 'DB'
  }
  if (event.wicket_type) return 'W'
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

function playerName(playerById: Map<number, PlayerDto>, playerId: number | null | undefined): string {
  if (!playerId) return '—'
  return playerById.get(playerId)?.full_name ?? `#${playerId}`
}

function dismissalLabel(value: string | null | undefined): string {
  if (!value) return ''
  return DISMISSAL_OPTIONS.find((item) => item.value === value)?.label ?? value.split('_').join(' ')
}

function selectedRoleCount(players: PlayerDto[], roles: PlayerRoleMap, role: MatchSquadRole): number {
  return players.filter((player) => roles[player.id] === role).length
}

function LiveScoringPage() {
  const { matchId } = Route.useParams()
  const mid = Number(matchId)
  const queryClient = useQueryClient()
  const currentSession = getSession() as { role?: string } | null | undefined
  const canResetTestMatch = currentSession?.role === 'super_admin'

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

  const liveQ = useQuery({
    queryKey: ['admin', 'matches', mid, 'live'],
    queryFn: () => adminGet<LiveScoreStateDto>(`/admin/matches/${mid}/live`),
    enabled: Number.isFinite(mid),
    refetchInterval: 10000,
    retry: 1,
  })

  const squadQ = useQuery({
    queryKey: ['admin', 'matches', mid, 'squads'],
    queryFn: () => adminGet<MatchSquadDto>(`/admin/matches/${mid}/squads`),
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
  const [actionError, setActionError] = useState<string | null>(null)
  const [playerRoles, setPlayerRoles] = useState<PlayerRoleMap>({})
  const [squadDirty, setSquadDirty] = useState(false)
  const [wicketOpen, setWicketOpen] = useState(false)
  const [wicketType, setWicketType] = useState('caught')
  const [wicketPlayerId, setWicketPlayerId] = useState<number | ''>('')
  const [fielderPlayerId, setFielderPlayerId] = useState<number | ''>('')
  const [newBatterPlayerId, setNewBatterPlayerId] = useState<number | ''>('')
  const [wicketEnd, setWicketEnd] = useState<WicketEnd>('striker')
  const [wicketRunsCompleted, setWicketRunsCompleted] = useState(0)
  const [wicketRunCredit, setWicketRunCredit] = useState<WicketRunCredit>('bat')
  const [battersCrossed, setBattersCrossed] = useState(false)
  const [tossWinnerTeamId, setTossWinnerTeamId] = useState<number | ''>('')
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl'>('bat')
  const [battingFirstTeamId, setBattingFirstTeamId] = useState<number | ''>('')
  const [umpire1, setUmpire1] = useState('')
  const [umpire2, setUmpire2] = useState('')
  const [reserveUmpire, setReserveUmpire] = useState('')
  const [matchOvers, setMatchOvers] = useState('40.0')
  const [editingBall, setEditingBall] = useState<EditingBallDraft | null>(null)
  const [editBallError, setEditBallError] = useState<string | null>(null)
  const [activeScorerPanel, setActiveScorerPanel] = useState<ScorerPanel>('score')
  const [extrasOpen, setExtrasOpen] = useState(false)
  const [finalReviewConfirmed, setFinalReviewConfirmed] = useState(false)

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
  }, [battingFirstTeamId, match, matchTeams.length, tossWinnerTeamId])

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
    if (!match) return

    const firstBattingTeamId = battingFirstTeamId || match.home_team_id
    const firstBowlingTeamId =
      firstBattingTeamId === match.home_team_id ? match.away_team_id : match.home_team_id

    if (innings === 1) {
      setBattingTeamId(firstBattingTeamId)
      setBowlingTeamId(firstBowlingTeamId)
    } else {
      setBattingTeamId(firstBowlingTeamId)
      setBowlingTeamId(firstBattingTeamId)
    }

    setStrikerPlayerId('')
    setNonStrikerPlayerId('')
    setBowlerPlayerId('')
    setWicketPlayerId('')
    setFielderPlayerId('')
    setNewBatterPlayerId('')
  }, [battingFirstTeamId, innings, match])

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

  useEffect(() => {
    if (!strikerPlayerId && battingPlayers[0]) {
      setStrikerPlayerId(battingPlayers[0].id)
    }
    if (!nonStrikerPlayerId && battingPlayers[1]) {
      setNonStrikerPlayerId(battingPlayers[1].id)
    }
    if (!wicketPlayerId && battingPlayers[0]) {
      setWicketPlayerId(battingPlayers[0].id)
    }
  }, [battingPlayers, nonStrikerPlayerId, strikerPlayerId, wicketPlayerId])

  useEffect(() => {
    if (!bowlerPlayerId && bowlingPlayers[0]) {
      setBowlerPlayerId(bowlingPlayers[0].id)
    }
    if (!fielderPlayerId && bowlingPlayers[0]) {
      setFielderPlayerId(bowlingPlayers[0].id)
    }
  }, [bowlerPlayerId, bowlingPlayers, fielderPlayerId])

  const currentSummary = useMemo(
    () => liveQ.data?.summaries.find((summary) => summary.innings === innings) ?? null,
    [innings, liveQ.data?.summaries],
  )

  const legalBalls = currentSummary?.legal_balls ?? 0
  const nextOverNumber = Math.floor(legalBalls / 6)
  const nextBallNumber = (legalBalls % 6) + 1
  const battingTeamName =
    matchTeams.find((team) => team.id === battingTeamId)?.name ?? 'Batting team'
  const bowlingTeamName =
    matchTeams.find((team) => team.id === bowlingTeamId)?.name ?? 'Bowling team'

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
      return adminPutJson<MatchDto>(`/admin/matches/${mid}/live/setup`, body)
    },
    onSuccess: async () => {
      setActionError(null)
      setActiveScorerPanel('squads')
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

      return adminPutJson<MatchSquadDto>(`/admin/matches/${mid}/squads`, body)
    },
    onSuccess: async () => {
      setActionError(null)
      setSquadDirty(false)
      setActiveScorerPanel('score')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'squads'] })
    },
    onError: (error: Error) => setActionError(error.message),
  })

  const startMutation = useMutation({
    mutationFn: () => {
      if (!battingTeamId || !bowlingTeamId) {
        throw new Error('Choose batting and bowling teams first.')
      }

      return adminPost<LiveScoreStateDto>(`/admin/matches/${mid}/live/start`, {
        batting_team_id: battingTeamId,
        bowling_team_id: bowlingTeamId,
      })
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
    const endOfOver = body.is_legal_delivery !== false && (legalBalls + 1) % 6 === 0

    if (oddRuns !== endOfOver && nextStriker && nextNonStriker) {
      const oldStriker = nextStriker
      nextStriker = nextNonStriker
      nextNonStriker = oldStriker
    }

    setStrikerPlayerId(nextStriker)
    setNonStrikerPlayerId(nextNonStriker)
  }

  const ballMutation = useMutation({
    mutationFn: (payload: BallSubmitPayload) =>
      adminPost<LiveBallEventDto>(`/admin/matches/${mid}/live/balls`, payload.body),
    onSuccess: async (_created, payload) => {
      setActionError(null)
      setNotes('')
      setWicketOpen(false)
      setFielderPlayerId('')
      setNewBatterPlayerId('')
      setWicketEnd('striker')
      setWicketRunsCompleted(0)
      setWicketRunCredit('bat')
      setBattersCrossed(false)
      applyPostBallState(payload.body, payload.newBatterId ?? null, payload.strikeRuns ?? 0)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
    },
    onError: (error: Error) => setActionError(error.message),
  })

  const undoMutation = useMutation({
    mutationFn: () =>
      adminDeleteJson<LiveScoreStateDto>(`/admin/matches/${mid}/live/balls/last`),
    onSuccess: async () => {
      setActionError(null)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
    },
    onError: (error: Error) => setActionError(error.message),
  })

  const editBallMutation = useMutation({
    mutationFn: (payload: EditingBallDraft) =>
      adminPutJson<LiveScoreStateDto>(
        `/admin/matches/${mid}/live/balls/${payload.eventId}`,
        payload.body,
      ),
    onSuccess: async () => {
      setActionError(null)
      setEditBallError(null)
      setEditingBall(null)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'scorer', 'matches'] })
    },
    onError: (error: Error) => setEditBallError(error.message),
  })

  const deleteBallMutation = useMutation({
    mutationFn: (eventId: number) =>
      adminDeleteJson<LiveScoreStateDto>(`/admin/matches/${mid}/live/balls/${eventId}`),
    onSuccess: async () => {
      setActionError(null)
      setEditBallError(null)
      setEditingBall(null)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'scorer', 'matches'] })
    },
    onError: (error: Error) => setEditBallError(error.message),
  })

  const completeMutation = useMutation({
    mutationFn: (status: 'completed' | 'abandoned' | 'cancelled') =>
      adminPost<LiveScoreStateDto>(`/admin/matches/${mid}/live/complete`, {
        status,
        match_overs: matchOvers,
      }),
    onSuccess: async () => {
      setActionError(null)
      setFinalReviewConfirmed(false)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'scorer', 'matches'] })
    },
    onError: (error: Error) => setActionError(error.message),
  })


  const resetTestMutation = useMutation({
    mutationFn: () => adminPost<LiveScoreStateDto>(`/admin/matches/${mid}/live/reset-test`, {}),
    onSuccess: async () => {
      setActionError(null)
      setEditingBall(null)
      setEditBallError(null)
      setNotes('')
      setWicketOpen(false)
      setFielderPlayerId('')
      setNewBatterPlayerId('')
      setWicketRunsCompleted(0)
      setWicketRunCredit('bat')
      setInnings(1)
      setActiveScorerPanel('setup')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'squads'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'scorer', 'matches'] })
    },
    onError: (error: Error) => setActionError(error.message),
  })

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

  const endCurrentInnings = () => {
    if (innings >= 2) {
      setActionError('This is already the second innings. Use Match over when the match is finished.')
      return
    }

    if (legalBalls === 0 && (currentSummary?.runs ?? 0) === 0 && (currentSummary?.wickets ?? 0) === 0) {
      const ok = window.confirm('No balls have been recorded in this innings yet. End innings anyway?')
      if (!ok) return
    }

    const ok = window.confirm('End this innings and move to the second innings?')
    if (!ok) return

    setActionError(null)
    setNotes('')
    setWicketOpen(false)
    setFielderPlayerId('')
    setNewBatterPlayerId('')
    setWicketRunsCompleted(0)
    setWicketRunCredit('bat')
    setInnings(innings + 1)
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
    if (!battingTeamId || !bowlingTeamId || !strikerPlayerId || !bowlerPlayerId) {
      setActionError('Choose teams, striker and bowler first.')
      return
    }

    const body: LiveBallEventInput = {
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
      is_legal_delivery: input.isLegalDelivery ?? true,
      completed_runs:
        input.completedRuns ?? input.strikeRuns ?? input.runsBatter ?? 0,
      boundary_runs: input.boundaryRuns ?? 0,
      boundary_type: input.boundaryType ?? null,
      penalty_runs_batting: input.penaltyRunsBatting ?? 0,
      penalty_runs_fielding: input.penaltyRunsFielding ?? 0,
      short_runs: input.shortRuns ?? 0,
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
      notes: notes.trim() || null,
    }

    void ballMutation.mutate({
      body,
      newBatterId,
      strikeRuns: input.strikeRuns ?? input.runsBatter ?? 0,
    })
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

    const option = DISMISSAL_OPTIONS.find((item) => item.value === wicketType)
    if (!option) {
      setActionError('Choose a dismissal mode.')
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
      setActionError('Runs completed before wicket is only for run outs. For bowled, caught, LBW or stumped, keep runs as 0.')
      return
    }

    const newBatter = newBatterPlayerId || null
    const needsNewBatter =
      !['retired_hurt', 'retired_not_out'].includes(wicketType) && availableNewBatters.length > 0
    if (needsNewBatter && !newBatter) {
      setActionError('Choose the new batter before saving this wicket ball.')
      return
    }

    const parts = [option.label]
    if (wicketType === 'run_out') {
      parts.push(`${wicketRuns} completed run${wicketRuns === 1 ? '' : 's'}`)
      parts.push(`end: ${wicketEnd.replace('_', '-')}`)
    }
    if (fielderId) parts.push(`fielder: ${playerName(playerById, fielderId)}`)

    submitBall(
      {
        wicketType,
        wicketPlayerId: playerOut,
        fielderPlayerId: fielderId,
        wicketEnd: wicketType === 'run_out' ? wicketEnd : null,
        battersCrossed,
        runsBatter: wicketRunCredit === 'bat' ? wicketRuns : 0,
        runsExtras: wicketRunCredit === 'bat' ? 0 : wicketRuns,
        extrasType: wicketRunCredit === 'bat' || wicketRuns === 0 ? null : wicketRunCredit,
        completedRuns: wicketRuns,
        strikeRuns: wicketRuns,
        dismissalText: parts.join(' · '),
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

  const currentWicketOption = DISMISSAL_OPTIONS.find((item) => item.value === wicketType)
  const availableNewBatters = battingPlayers.filter(
    (player) => player.id !== strikerPlayerId && player.id !== nonStrikerPlayerId,
  )
  const inningsTarget =
    innings === 1 && currentSummary ? currentSummary.runs + 1 : null
  const hasMatchDaySquads = matchTeams.length > 0 && matchTeams.every((team) => teamHasSavedSquad.get(team.id))
  const strikerName = playerName(playerById, strikerPlayerId || null)
  const nonStrikerName = playerName(playerById, nonStrikerPlayerId || null)
  const bowlerName = playerName(playerById, bowlerPlayerId || null)
  const scoringPanels: Array<{ id: ScorerPanel; label: string; hint: string }> = [
    { id: 'score', label: 'Score', hint: 'Ball controls' },
    { id: 'setup', label: 'Setup', hint: 'Toss & overs' },
    { id: 'squads', label: 'Squads', hint: hasMatchDaySquads ? 'Saved' : 'Pick XI' },
    { id: 'balls', label: 'Balls', hint: `${liveQ.data?.events.length ?? 0} recorded` },
    { id: 'corrections', label: 'Fix', hint: editingBall ? 'Editing' : 'Correct ball' },
    { id: 'review', label: 'Review', hint: 'Finalize' },
    { id: 'help', label: 'Help', hint: 'Scorer guide' },
  ]

  const overStripOverNumber =
    legalBalls > 0 && legalBalls % 6 === 0 ? Math.max(0, nextOverNumber - 1) : nextOverNumber
  const overStripEvents = [...(liveQ.data?.events ?? [])]
    .filter((event) => event.innings === innings && event.over_number === overStripOverNumber)
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
    wicketOpen && wicketType !== 'retired_hurt' && wicketType !== 'retired_not_out' && !newBatterPlayerId
      ? 'Select the new batter before saving a wicket.'
      : null,
  ].filter((warning): warning is string => Boolean(warning))

  const allLiveEvents = [...(liveQ.data?.events ?? [])].sort(
    (a, b) => a.sequence_number - b.sequence_number || a.id - b.id,
  )
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

    if (secondReviewSummary.runs > firstReviewSummary.runs) {
      const wicketsLeft = Math.max(0, 10 - secondReviewSummary.wickets)
      return `${reviewTeamName(secondReviewSummary.batting_team_id)} by ${wicketsLeft} wicket${wicketsLeft === 1 ? '' : 's'}`
    }

    if (firstReviewSummary.runs > secondReviewSummary.runs) {
      const margin = firstReviewSummary.runs - secondReviewSummary.runs
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
    <div className="live-scorer-page">
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
          background: #f8fafc;
          color: #111827;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.12);
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
          color: #111827;
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
          border: 1px solid rgba(100, 116, 139, 0.45);
          border-radius: 999px;
          color: #1f2937;
          padding: 0.3rem 0.55rem;
          font-size: 0.84rem;
          background: #ffffff;
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
          border: 1px solid rgba(100, 116, 139, 0.42);
          background: #ffffff;
          color: #111827;
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
          background: #111827;
          border-color: #111827;
          color: #ffffff;
        }
        .live-scorer-tab.is-active span {
          color: #e5e7eb;
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
          display: inline-flex;
          min-width: 2.35rem;
          min-height: 2.15rem;
          align-items: center;
          justify-content: center;
          border-radius: 0.65rem;
          background: #f1f5f9;
          color: #111827;
          font-weight: 900;
        }
        .live-scorer-ball-chip--boundary {
          background: #dcfce7;
          color: #166534;
        }
        .live-scorer-ball-chip--wicket {
          background: #fee2e2;
          color: #991b1b;
        }
        .live-scorer-score-buttons {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 0.5rem;
        }
        .live-scorer-score-buttons .btn-primary {
          min-height: 4rem !important;
          font-size: 1.25rem;
          font-weight: 900;
        }
        .live-scorer-quick-actions {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 0.5rem;
          margin-top: 0.75rem;
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
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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
          color: #111827;
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
        @media (max-width: 900px) {
          .live-scorer-primary-grid,
          .live-scorer-cockpit {
            grid-template-columns: 1fr;
          }
          .live-scorer-sticky {
            top: 0.35rem;
            border-radius: 1rem;
          }
        }
        @media (max-width: 640px) {
          .live-scorer-sticky__top {
            grid-template-columns: 1fr;
          }
          .live-scorer-tabs {
            grid-template-columns: repeat(7, minmax(58px, 1fr));
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
          .live-scorer-page .catalog-card-grid,
          .live-scorer-score-buttons {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .live-scorer-page .catalog-toolbar {
            gap: 0.45rem;
          }
          .live-scorer-page .catalog-toolbar .btn-primary,
          .live-scorer-page .catalog-toolbar .btn-ghost {
            flex: 1 1 135px;
            justify-content: center;
          }
        }
      `}</style>
      <PageHeader
        title="Live scoring"
        descriptionAsTooltip
        description="Pick match day squads first, then score ball-by-ball from the selected XI and substitutes."
        actions={<Link to="/scoring">Scoring dashboard</Link>}
      />

      <section className="team-hub-section">
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

        {liveQ.isError ? <p className="login-error">{liveQ.error.message}</p> : null}
        {squadQ.isError ? <p className="login-error">{squadQ.error.message}</p> : null}
        {actionError ? <p className="login-error">{actionError}</p> : null}
      </section>

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
          <div className="catalog-toolbar">
            <button
              type="button"
              className="btn-primary btn--with-icon"
              onClick={() => void startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              <Save size={18} strokeWidth={2} aria-hidden />
              {startMutation.isPending ? 'Starting…' : 'Start'}
            </button>
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
          </div>
        </div>
        <div className="live-scorer-tabs" role="tablist" aria-label="Scorer sections">
          {scoringPanels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              className={`live-scorer-tab${activeScorerPanel === panel.id ? ' is-active' : ''}`}
              onClick={() => setActiveScorerPanel(panel.id)}
              aria-pressed={activeScorerPanel === panel.id}
            >
              <strong>{panel.label}</strong>
              <span>{panel.hint}</span>
            </button>
          ))}
        </div>
      </section>

      {activeScorerPanel === 'setup' ? (
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

      {activeScorerPanel === 'squads' ? (
      <section className="team-hub-section">
        <div className="team-hub-section-head">
          <div className="team-hub-section-head__lead">
            <h2 className="team-hub-section__title">Match day squad</h2>
            <p className="muted">
              Select up to 11 playing XI and up to 4 substitutes per team. Once saved,
              the scoring controls use only these players.
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

            return (
              <div key={team.id} className="team-hub-section" style={{ marginTop: 0 }}>
                <div className="team-hub-section-head">
                  <div className="team-hub-section-head__lead">
                    <h3 className="team-hub-section__title">{team.name}</h3>
                    <p className="muted">
                      Playing XI: {playingCount}/11 · Subs: {substituteCount}/4
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

      {activeScorerPanel === 'score' ? (
      <section className="team-hub-section">
        <div className="team-hub-section-head">
          <div className="team-hub-section-head__lead">
            <h2 className="team-hub-section__title">Current score</h2>
            <p className="muted">
              {battingTeamName}: {currentScore}
              {inningsTarget ? ` · target for next innings: ${inningsTarget}` : ''}
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

        <div className="dashboard-match-panel__tabs" role="tablist" aria-label="Innings">
          <button
            type="button"
            className={`dashboard-match-panel__tab${innings === 1 ? ' is-active' : ''}`}
            onClick={() => setInnings(1)}
          >
            1st innings
          </button>
          <button
            type="button"
            className={`dashboard-match-panel__tab${innings === 2 ? ' is-active' : ''}`}
            onClick={() => setInnings(2)}
          >
            2nd innings
          </button>
        </div>

        <div className="inline-edit__grid">
          <label className="inline-edit__field">
            <span className="inline-edit__label">Batting team</span>
            <select
              className="inline-edit__control"
              value={battingTeamId}
              onChange={(event) => setBattingTeamId(Number(event.target.value))}
            >
              {matchTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-edit__field">
            <span className="inline-edit__label">Bowling team</span>
            <select
              className="inline-edit__control"
              value={bowlingTeamId}
              onChange={(event) => setBowlingTeamId(Number(event.target.value))}
            >
              {matchTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-edit__field">
            <span className="inline-edit__label">Striker</span>
            <select
              className="inline-edit__control"
              value={strikerPlayerId}
              onChange={(event) => setStrikerPlayerId(Number(event.target.value))}
            >
              <option value="">Choose striker</option>
              {battingPlayers.map((player) => (
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
              value={nonStrikerPlayerId}
              onChange={(event) =>
                setNonStrikerPlayerId(event.target.value ? Number(event.target.value) : '')
              }
            >
              <option value="">Choose non-striker</option>
              {battingPlayers.map((player) => (
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
              value={bowlerPlayerId}
              onChange={(event) => setBowlerPlayerId(Number(event.target.value))}
            >
              <option value="">Choose bowler</option>
              {bowlingPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.full_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="live-scorer-cockpit" aria-label="Scoring cockpit">
          <div className="live-scorer-cockpit__card">
            <span className="live-scorer-cockpit__label">Next ball</span>
            <span className="live-scorer-cockpit__main">
              {nextOverNumber}.{nextBallNumber}: {bowlerName} to {strikerName}
            </span>
            <p className="live-scorer-cockpit__sub">
              {bowlingTeamName} bowling · {battingTeamName} batting
            </p>
          </div>
          <div className="live-scorer-cockpit__card">
            <span className="live-scorer-cockpit__label">
              Over {overStripOverNumber + 1} · {overStripRuns} runs
            </span>
            <div className="live-scorer-over-strip" aria-label="Current over balls">
              {overStripEvents.length > 0 ? (
                overStripEvents.map((event) => (
                  <span
                    key={event.id}
                    className={`live-scorer-ball-chip${event.wicket_type ? ' live-scorer-ball-chip--wicket' : event.boundary_runs >= 4 ? ' live-scorer-ball-chip--boundary' : ''}`}
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
              <h4 className="team-hub-section__title">Batter runs</h4>
              <p className="muted">Legal delivery unless you use a no-ball option below.</p>
            </div>
          </div>
          <div className="live-scorer-score-buttons">
            {[0, 1, 2, 3, 4, 6].map((runs) => (
              <button
                key={runs}
                type="button"
                className="btn-primary"
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
          </div>
          <div className="live-scorer-quick-actions">
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
              onClick={() => setExtrasOpen((open) => !open)}
            >
              {extrasOpen ? 'Hide extras' : 'Extras / MCC'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setWicketOpen((open) => !open)}
              disabled={ballMutation.isPending}
            >
              Out / wicket
            </button>
            <button
              type="button"
              className="btn-ghost btn--with-icon"
              onClick={() => void undoMutation.mutate()}
              disabled={undoMutation.isPending}
            >
              <Undo2 size={18} strokeWidth={2} aria-hidden />
              Undo last
            </button>
          </div>
        </div>

        {extrasOpen ? (
          <>
        <div className="team-hub-section" style={{ marginTop: '1rem' }}>
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
              className="btn-ghost"
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
                className="btn-ghost"
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
                className="btn-ghost"
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
                className="btn-ghost"
                onClick={() =>
                  submitBall({
                    runsExtras: runs + 1,
                    extrasType: 'no_ball_leg_bye',
                    isLegalDelivery: false,
                    strikeRuns: runs,
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
          <div className="catalog-card-grid">
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
                  submitBall({ runsExtras: runs, extrasType: 'leg_bye', strikeRuns: runs })
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
              <p className="muted">Dead ball, penalties, and short-run corrections do not behave like normal scoring balls.</p>
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
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                submitBall({
                  runsBatter: 1,
                  completedRuns: 2,
                  shortRuns: 1,
                  strikeRuns: 1,
                  dismissalText: 'One short run called',
                })
              }
              disabled={ballMutation.isPending}
            >
              Short run: ran 2, score 1
            </button>
          </div>
        </div>
          </>
        ) : null}

        {wicketOpen ? (
          <div className="team-hub-section" style={{ marginTop: '1rem' }}>
            <div className="team-hub-section-head">
              <div className="team-hub-section-head__lead">
                <h3 className="team-hub-section__title">Wicket details</h3>
                <p className="muted">
                  Pick the player out, mode of dismissal, fielder if needed, runs completed before a run out, and new batter.
                </p>
              </div>
            </div>

            <div className="inline-edit__grid">
              <label className="inline-edit__field">
                <span className="inline-edit__label">1. Player out</span>
                <select
                  className="inline-edit__control"
                  value={wicketPlayerId || strikerPlayerId}
                  onChange={(event) => setWicketPlayerId(Number(event.target.value))}
                >
                  {battingPlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inline-edit__field">
                <span className="inline-edit__label">2. Mode of dismissal</span>
                <select
                  className="inline-edit__control"
                  value={wicketType}
                  onChange={(event) => setWicketType(event.target.value)}
                >
                  {DISMISSAL_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
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
                      setFielderPlayerId(event.target.value ? Number(event.target.value) : '')
                    }
                  >
                    <option value="">Choose fielder</option>
                    {bowlingPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.full_name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

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
                  <span className="inline-edit__label">Runs completed before wicket</span>
                  <select
                    className="inline-edit__control"
                    value={wicketRunsCompleted}
                    onChange={(event) => setWicketRunsCompleted(Number(event.target.value))}
                  >
                    <option value={0}>0 runs</option>
                    <option value={1}>1 run</option>
                    <option value={2}>2 runs</option>
                    <option value={3}>3 runs</option>
                  </select>
                </label>
              ) : null}

              {wicketType === 'run_out' && wicketRunsCompleted > 0 ? (
                <label className="inline-edit__field">
                  <span className="inline-edit__label">Credit those runs as</span>
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

              <label className="inline-edit__field">
                <span className="inline-edit__label">4. New batter</span>
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
            </div>

            {actionError ? <p className="login-error">{actionError}</p> : null}

            <button
              type="button"
              className="btn-primary"
              onClick={submitWicket}
              disabled={ballMutation.isPending}
            >
              {ballMutation.isPending ? 'Saving wicket…' : 'Save wicket'}
            </button>
          </div>
        ) : null}

        <label className="inline-edit__field">
          <span className="inline-edit__label">Ball note</span>
          <input
            className="inline-edit__control"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional scorer note"
          />
        </label>

        <div className="catalog-toolbar">
          <button
            type="button"
            className="btn-ghost btn--with-icon"
            onClick={() => void liveQ.refetch()}
          >
            <RotateCcw size={18} strokeWidth={2} aria-hidden />
            Refresh
          </button>
          {innings === 1 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={endCurrentInnings}
              disabled={ballMutation.isPending || undoMutation.isPending}
            >
              End innings
            </button>
          ) : null}
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFinalReviewConfirmed(false)
              setActiveScorerPanel('review')
            }}
            disabled={completeMutation.isPending}
          >
            Review & finalize
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void completeMutation.mutate('abandoned')}
            disabled={completeMutation.isPending}
          >
            Mark abandoned
          </button>
        </div>
      </section>
      ) : null}

      {activeScorerPanel === 'review' ? (
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

          <label className="live-scorer-final-confirm">
            <input
              type="checkbox"
              checked={finalReviewConfirmed}
              onChange={(event) => setFinalReviewConfirmed(event.target.checked)}
            />
            <span>
              I have checked the score, wickets, fielding credits, extras, and NRR match overs. Finalize this match as official.
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
              disabled={completeMutation.isPending || !finalReviewConfirmed}
            >
              {completeMutation.isPending ? 'Finalizing…' : 'Finalize official result'}
            </button>
          </div>
        </section>
      ) : null}

      {activeScorerPanel === 'help' ? (
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
              <p className="muted">Choose striker, non-striker, bowler, then tap 0, 1, 2, 3, 4 or 6. Strike rotates automatically on odd runs and at the end of an over.</p>
            </div>
            <div className="live-scorer-review-card">
              <strong>Extras</strong>
              <p className="muted">Tap Extras / MCC for wides, no-balls, byes, leg-byes, penalties, dead ball, and short-run adjustments.</p>
            </div>
            <div className="live-scorer-review-card">
              <strong>Wicket</strong>
              <p className="muted">Tap Out / wicket, choose the player out, dismissal type, fielder if required, wicket end for run outs, any completed runs before the wicket, and the new batter.</p>
            </div>
            <div className="live-scorer-review-card">
              <strong>Correction</strong>
              <p className="muted">Use Undo last for the latest mistake. Use Balls → Edit/Delete for an earlier ball. The score and scorecard are recalculated after correction.</p>
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

      {editingBall && activeScorerPanel === 'corrections' ? (
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

      {activeScorerPanel === 'balls' ? (
      <section className="team-hub-section">
        <div className="team-hub-section-head">
          <div className="team-hub-section-head__lead">
            <h2 className="team-hub-section__title">Ball-by-ball</h2>
            <p className="muted">Latest scoring events for this match.</p>
          </div>
        </div>

        {liveQ.isLoading ? <p className="muted">Loading live score…</p> : null}

        {(liveQ.data?.events ?? []).length === 0 ? (
          <p className="muted">No balls recorded yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ball</th>
                  <th>Batter</th>
                  <th>Bowler</th>
                  <th>Result</th>
                  <th>Dismissal / fielder</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...(liveQ.data?.events ?? [])].reverse().map((event) => (
                  <tr key={event.id}>
                    <td>
                      {event.innings}.{event.over_number}.{event.ball_number}
                    </td>
                    <td>{playerName(playerById, event.striker_player_id)}</td>
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
                    <td>
                      <div className="catalog-toolbar">
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => {
                            setEditBallError(null)
                            setEditingBall({
                              eventId: event.id,
                              body: eventToLiveBallInput(event),
                            })
                            setActiveScorerPanel('corrections')
                          }}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}
    </div>
  )
}
