import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { RotateCcw, Save, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type {
  LiveBallEventDto,
  LiveBallEventInput,
  LiveScoreStateDto,
  MatchDto,
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
  if (event.wicket_type) return 'W'
  if (event.extras_type) return `${event.runs_extras} ${event.extras_type.replaceAll('_', ' ')}`
  return String(event.runs_batter)
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
    () =>
      new Map((playersQ.data ?? []).map((player) => [player.id, player] as const)),
    [playersQ.data],
  )

  const [innings, setInnings] = useState(1)
  const [battingTeamId, setBattingTeamId] = useState<number | ''>('')
  const [bowlingTeamId, setBowlingTeamId] = useState<number | ''>('')
  const [strikerPlayerId, setStrikerPlayerId] = useState<number | ''>('')
  const [nonStrikerPlayerId, setNonStrikerPlayerId] = useState<number | ''>('')
  const [bowlerPlayerId, setBowlerPlayerId] = useState<number | ''>('')
  const [wicketPlayerId, setWicketPlayerId] = useState<number | ''>('')
  const [notes, setNotes] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

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
    if (!match) return

    if (innings === 1) {
      setBattingTeamId(match.home_team_id)
      setBowlingTeamId(match.away_team_id)
    } else {
      setBattingTeamId(match.away_team_id)
      setBowlingTeamId(match.home_team_id)
    }

    setStrikerPlayerId('')
    setNonStrikerPlayerId('')
    setBowlerPlayerId('')
    setWicketPlayerId('')
  }, [innings, match])

  const battingPlayers = useMemo(
    () =>
      (playersQ.data ?? []).filter((player) => player.team_id === battingTeamId),
    [battingTeamId, playersQ.data],
  )

  const bowlingPlayers = useMemo(
    () =>
      (playersQ.data ?? []).filter((player) => player.team_id === bowlingTeamId),
    [bowlingTeamId, playersQ.data],
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
  }, [bowlerPlayerId, bowlingPlayers])

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

  const ballMutation = useMutation({
    mutationFn: (body: LiveBallEventInput) =>
      adminPost<LiveBallEventDto>(`/admin/matches/${mid}/live/balls`, body),
    onSuccess: async () => {
      setActionError(null)
      setNotes('')
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

  const submitBall = (input: {
    runsBatter?: number
    runsExtras?: number
    extrasType?: string | null
    isLegalDelivery?: boolean
    wicketType?: string | null
  }) => {
    if (!battingTeamId || !bowlingTeamId || !strikerPlayerId || !bowlerPlayerId) {
      setActionError('Choose teams, striker and bowler first.')
      return
    }

    const isWicket = Boolean(input.wicketType)

    void ballMutation.mutate({
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
      wicket_type: input.wicketType ?? null,
      wicket_player_id: isWicket ? wicketPlayerId || strikerPlayerId : null,
      dismissal_text: isWicket ? 'Wicket' : null,
      notes: notes.trim() || null,
    })
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
          Back to live scoring
        </Link>
      </>
    )
  }

  const title = `${matchTeams[0]?.name ?? `Team ${match.home_team_id}`} vs ${
    matchTeams[1]?.name ?? `Team ${match.away_team_id}`
  }`

  return (
    <>
      <PageHeader
        title={title}
        description={`${matchWhen(match)} · ${match.venue ?? 'Venue TBC'}`}
        actions={
          <Link to="/scoring" className="btn-ghost">
            Assigned matches
          </Link>
        }
      />

      <section className="team-hub-section">
        <div className="team-hub-section-head">
          <div className="team-hub-section-head__lead">
            <h2 className="team-hub-section__title">Live score</h2>
            <p className="muted">
              {battingTeamName} {currentSummary?.runs ?? 0}/
              {currentSummary?.wickets ?? 0} after{' '}
              {currentSummary?.overs_label ?? '0.0'} overs
            </p>
          </div>
          <StatusBadge
            status={
              (liveQ.data?.status ?? match.status) as
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
        {actionError ? <p className="login-error">{actionError}</p> : null}

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
              <option value="">Optional</option>
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

          <label className="inline-edit__field">
            <span className="inline-edit__label">Wicket player</span>
            <select
              className="inline-edit__control"
              value={wicketPlayerId}
              onChange={(event) =>
                setWicketPlayerId(event.target.value ? Number(event.target.value) : '')
              }
            >
              <option value="">Default striker</option>
              {battingPlayers.map((player) => (
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

        <div className="catalog-card-grid">
          {[0, 1, 2, 3, 4, 6].map((runs) => (
            <button
              key={runs}
              type="button"
              className="btn-primary"
              onClick={() => submitBall({ runsBatter: runs })}
              disabled={ballMutation.isPending}
            >
              {runs}
            </button>
          ))}
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              submitBall({ runsExtras: 1, extrasType: 'wide', isLegalDelivery: false })
            }
            disabled={ballMutation.isPending}
          >
            Wide
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              submitBall({ runsExtras: 1, extrasType: 'no_ball', isLegalDelivery: false })
            }
            disabled={ballMutation.isPending}
          >
            No ball
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => submitBall({ runsExtras: 1, extrasType: 'bye' })}
            disabled={ballMutation.isPending}
          >
            Bye
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => submitBall({ runsExtras: 1, extrasType: 'leg_bye' })}
            disabled={ballMutation.isPending}
          >
            Leg bye
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => submitBall({ wicketType: 'out' })}
            disabled={ballMutation.isPending}
          >
            Wicket
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
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void completeMutation.mutate('completed')}
            disabled={completeMutation.isPending}
          >
            Mark completed
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
                  <th>Batting</th>
                  <th>Bowler</th>
                  <th>Result</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {[...(liveQ.data?.events ?? [])].reverse().map((event) => (
                  <tr key={event.id}>
                    <td>
                      {event.innings}.{event.over_number}.{event.ball_number}
                    </td>
                    <td>{playerById.get(event.striker_player_id)?.full_name ?? event.striker_player_id}</td>
                    <td>{playerById.get(event.bowler_player_id)?.full_name ?? event.bowler_player_id}</td>
                    <td>{liveEventLabel(event)}</td>
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
