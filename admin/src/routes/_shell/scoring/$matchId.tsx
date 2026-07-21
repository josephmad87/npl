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
  const [battersCrossed, setBattersCrossed] = useState(false)
  const [tossWinnerTeamId, setTossWinnerTeamId] = useState<number | ''>('')
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl'>('bat')
  const [battingFirstTeamId, setBattingFirstTeamId] = useState<number | ''>('')
  const [umpire1, setUmpire1] = useState('')
  const [umpire2, setUmpire2] = useState('')
  const [reserveUmpire, setReserveUmpire] = useState('')

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
      const body: MatchLiveSetupInput = {
        toss_winner_team_id: tossWinnerTeamId,
        toss_decision: tossDecision,
        batting_first_team_id: battingFirstTeamId,
        umpire_1: umpire1.trim() || null,
        umpire_2: umpire2.trim() || null,
        reserve_umpire: reserveUmpire.trim() || null,
      }
      return adminPutJson<MatchDto>(`/admin/matches/${mid}/live/setup`, body)
    },
    onSuccess: async () => {
      setActionError(null)
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

  const completeMutation = useMutation({
    mutationFn: (status: 'completed' | 'abandoned' | 'cancelled') =>
      adminPost<LiveScoreStateDto>(`/admin/matches/${mid}/live/complete`, {
        status,
      }),
    onSuccess: async () => {
      setActionError(null)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid, 'live'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'scorer', 'matches'] })
    },
    onError: (error: Error) => setActionError(error.message),
  })

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
    setInnings(innings + 1)
  }

  const markMatchOver = () => {
    const ok = window.confirm('Mark this match as completed? This will remove it from live scoring.')
    if (!ok) return
    void completeMutation.mutate('completed')
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
        setActionError(`Choose the ${option.fielderLabel ?? 'fielder'}.`)
        return
      }
      fielderId = fielderPlayerId
    }

    const newBatter = newBatterPlayerId || null
    const parts = [option.label]
    if (fielderId) parts.push(`fielder: ${playerName(playerById, fielderId)}`)

    submitBall(
      {
        wicketType,
        wicketPlayerId: playerOut,
        fielderPlayerId: fielderId,
        wicketEnd: wicketType === 'run_out' ? wicketEnd : null,
        battersCrossed,
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

  return (
    <>
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

        {matchTeams.map((team) => {
          const teamPlayers = playersForTeam(team.id)
          const playingCount = selectedRoleCount(teamPlayers, playerRoles, 'playing_xi')
          const substituteCount = selectedRoleCount(teamPlayers, playerRoles, 'substitute')

          return (
            <div key={team.id} className="team-hub-section" style={{ marginTop: '1rem' }}>
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
      </section>

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

        <div className="team-hub-section-head">
          <div className="team-hub-section-head__lead">
            <h3 className="team-hub-section__title">Next ball</h3>
            <p className="muted">
              {bowlingTeamName} bowling · over {nextOverNumber}.{nextBallNumber}
            </p>
          </div>
        </div>

        <div className="team-hub-section" style={{ marginTop: '1rem' }}>
          <div className="team-hub-section-head">
            <div className="team-hub-section-head__lead">
              <h4 className="team-hub-section__title">Batter runs</h4>
              <p className="muted">Legal delivery unless you use a no-ball option below.</p>
            </div>
          </div>
          <div className="catalog-card-grid">
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
        </div>

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
              Undo last ball
            </button>
          </div>
        </div>

        {wicketOpen ? (
          <div className="team-hub-section" style={{ marginTop: '1rem' }}>
            <div className="team-hub-section-head">
              <div className="team-hub-section-head__lead">
                <h3 className="team-hub-section__title">Wicket details</h3>
                <p className="muted">
                  Pick the player out, mode of dismissal, fielder if needed, and new batter.
                </p>
              </div>
            </div>

            <div className="inline-edit__grid">
              <label className="inline-edit__field">
                <span className="inline-edit__label">Player out</span>
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
                <span className="inline-edit__label">Mode of dismissal</span>
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
                <span className="inline-edit__label">New batter</span>
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

            <button
              type="button"
              className="btn-primary"
              onClick={submitWicket}
              disabled={ballMutation.isPending}
            >
              Save wicket
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
            onClick={markMatchOver}
            disabled={completeMutation.isPending}
          >
            Match over
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
