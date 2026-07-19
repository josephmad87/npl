import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ClipboardList, PlayCircle, Save, SquarePen, Table2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type {
  LeagueDto,
  MatchDto,
  PlayerDto,
  ScorerAssignmentDto,
  SeasonDto,
  TeamDto,
  UserDto,
} from '@/lib/api-types'
import { adminGet, adminListAll, adminPatch } from '@/lib/admin-client'
import { apiFetch } from '@/lib/api'
import { getSession } from '@/lib/session'
import { invalidateCompetitionDataQueries } from '@/lib/invalidate-competition-data'
import { CompetitionCategorySelect } from '@/components/CompetitionCategorySelect'
import { BadgeImage } from '@/components/BadgeImage'
import { MatchResultEditor } from '@/components/MatchResultEditor'
import { InningsScorecardPanels } from '@/components/InningsScorecardPanels'
import {
  MatchTableTeamCell,
  type MatchTableTeamRow,
} from '@/components/MatchTableTeamCell'
import { DetailFields } from '@/components/DetailFields'
import { InlineEditForm } from '@/components/InlineEditForm'
import { MediaUrlField } from '@/components/MediaUrlField'
import { PageHeader } from '@/components/PageHeader'
import { SectionHintTip } from '@/components/SectionHintTip'
import { StatusBadge } from '@/components/StatusBadge'
import { normalizeCompetitionCategory } from '@/lib/competitionCategories'
import { parseDetailRouteSearch } from '@/lib/detail-route-search'
import { formatExtrasBreakdown } from '@/lib/match-extras'
import { getInningsSides, type InningsNumber } from '@/lib/cricket'
import { matchResultSummaryLine, matchWinnerSide } from '@/lib/match-winner'

export const Route = createFileRoute('/_shell/matches/$matchId')({
  validateSearch: parseDetailRouteSearch,
  component: MatchDetailPage,
})

const STATUSES = [
  'scheduled',
  'live',
  'completed',
  'postponed',
  'abandoned',
  'cancelled',
] as const

function fixtureStatusOptions(current: string): readonly (typeof STATUSES)[number][] {
  if (current === 'completed') return STATUSES
  return STATUSES.filter((s) => s !== 'completed')
}

type MatchResultOutcome = 'win' | 'tie' | 'no_result'

function matchResultOutcome(match: MatchDto): MatchResultOutcome | null {
  const result = match.result as
    | (NonNullable<MatchDto['result']> & { outcome?: string | null })
    | null
    | undefined

  const outcome = String(result?.outcome ?? '').trim().toLowerCase()

  if (outcome === 'win' || outcome === 'tie' || outcome === 'no_result') {
    return outcome
  }

  if (result?.winning_team_id != null) {
    return 'win'
  }

  return null
}

function formatMatchResultOutcome(match: MatchDto): string | null {
  const outcome = matchResultOutcome(match)

  if (outcome === 'win') return 'Win'
  if (outcome === 'tie') return 'Tie'
  if (outcome === 'no_result') return 'No result'

  return null
}


function adminAccessToken(): string | undefined {
  const session = getSession() as
    | { accessToken?: string; access_token?: string; token?: string }
    | null
    | undefined

  return session?.accessToken ?? session?.access_token ?? session?.token
}

async function adminPutJson<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
    accessToken: adminAccessToken(),
  })
}

function MatchDetailPage() {
  const { matchId } = Route.useParams()
  const mid = Number(matchId)
  const search = Route.useSearch()
  const { mode } = search
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const matchListSearch = {
    statusTab: search.statusTab ?? 'active',
    leagueId: search.leagueId ?? null,
    seasonId: search.seasonId ?? null,
  }

  const teamsQ = useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: () => adminListAll<TeamDto>('/admin/teams'),
  })
  const seasonsQ = useQuery({
    queryKey: ['admin', 'seasons', 'all'],
    queryFn: () => adminListAll<SeasonDto>('/admin/seasons'),
  })
  const leaguesQ = useQuery({
    queryKey: ['admin', 'leagues'],
    queryFn: () => adminListAll<LeagueDto>('/admin/leagues'),
  })
  const matchesQ = useQuery({
    queryKey: ['admin', 'matches', mid],
    queryFn: () => adminGet<MatchDto>(`/admin/matches/${mid}`),
    enabled: Number.isFinite(mid),
  })
  const playersQ = useQuery({
    queryKey: ['admin', 'players'],
    queryFn: () => adminListAll<PlayerDto>('/admin/players'),
  })
  const usersQ = useQuery({
    queryKey: ['admin', 'users', 'scorers'],
    queryFn: () => adminListAll<UserDto>('/admin/users'),
    retry: 1,
  })
  const scorersQ = useQuery({
    queryKey: ['admin', 'matches', mid, 'scorers'],
    queryFn: () => adminGet<ScorerAssignmentDto[]>(`/admin/matches/${mid}/scorers`),
    enabled: Number.isFinite(mid),
    retry: 1,
  })

  const match = matchesQ.data
  const homeName = useMemo(
    () =>
      match
        ? teamsQ.data?.find((t) => t.id === match.home_team_id)?.name
        : undefined,
    [match, teamsQ.data],
  )
  const awayName = useMemo(
    () =>
      match
        ? teamsQ.data?.find((t) => t.id === match.away_team_id)?.name
        : undefined,
    [match, teamsQ.data],
  )

  const homeTeam = useMemo(
    () =>
      match
        ? teamsQ.data?.find((t) => t.id === match.home_team_id)
        : undefined,
    [match, teamsQ.data],
  )
  const awayTeam = useMemo(
    () =>
      match
        ? teamsQ.data?.find((t) => t.id === match.away_team_id)
        : undefined,
    [match, teamsQ.data],
  )

  const matchPlayerStatsKey = useMemo(
    () =>
      match
        ? (match.player_stats ?? [])
            .map((s) => `${s.id}:${s.runs}:${s.balls_faced}:${s.wickets}`)
            .join('|')
        : '',
    [match],
  )

  const isEditing = mode === 'edit'
  const isResultMode = mode === 'result'
  const [scorecardInnings, setScorecardInnings] = useState<InningsNumber>(1)
  const [patch, setPatch] = useState<Partial<MatchDto>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedScorerIds, setSelectedScorerIds] = useState<number[]>([])
  const [scorerSaveError, setScorerSaveError] = useState<string | null>(null)
  const [isSavingScorers, setIsSavingScorers] = useState(false)

  const merged: MatchDto | null =
    match ? { ...match, ...patch } : null

  const goView = () => {
    if (!match) return
    setPatch({})
    setSaveError(null)
    void navigate({
      to: '/matches/$matchId',
      params: { matchId: String(match.id) },
      search: matchListSearch,
    })
  }

  const beginEdit = () => {
    if (!match) return
    setPatch({ category: normalizeCompetitionCategory(match.category) })
    setSaveError(null)
    void navigate({
      to: '/matches/$matchId',
      params: { matchId: String(match.id) },
      search: { ...matchListSearch, mode: 'edit' },
    })
  }

  const save = async () => {
    if (!merged || !match || !Number.isFinite(mid)) return
    if (merged.home_team_id === merged.away_team_id) {
      setSaveError('Home and away teams must differ.')
      return
    }
    if (merged.status === 'completed' && match.status !== 'completed') {
      setSaveError('Use Result & scorecard to mark a match completed.')
      return
    }
    try {
      await adminPatch<MatchDto>(`/admin/matches/${mid}`, {
        season_id: merged.season_id,
        category: merged.category,
        home_team_id: merged.home_team_id,
        away_team_id: merged.away_team_id,
        title: merged.title?.trim() || null,
        venue: merged.venue,
        match_date: merged.match_date,
        start_time: merged.start_time ?? null,
        toss_info: merged.toss_info?.trim() || null,
        umpires: merged.umpires?.trim() || null,
        description: merged.description?.trim() || null,
        status: merged.status,
        cover_image_url: merged.cover_image_url ?? null,
      })
      await invalidateCompetitionDataQueries(queryClient)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid] })
      goView()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    }
  }


  const scorerUsers = useMemo(
    () =>
      (usersQ.data ?? [])
        .filter((user) => user.role === 'scorer' && user.is_active)
        .sort((a, b) =>
          (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email),
        ),
    [usersQ.data],
  )

  useEffect(() => {
    setSelectedScorerIds((scorersQ.data ?? []).map((row) => row.user_id))
  }, [scorersQ.data])

  const assignedScorerNames = useMemo(() => {
    const rows = scorersQ.data ?? []
    if (rows.length === 0) return 'No scorer assigned yet.'
    return rows
      .map((row) => row.user_full_name?.trim() || row.user_email)
      .join(', ')
  }, [scorersQ.data])

  const saveScorerAssignments = async () => {
    if (!Number.isFinite(mid)) return

    setIsSavingScorers(true)
    setScorerSaveError(null)

    try {
      await adminPutJson<ScorerAssignmentDto[]>(`/admin/matches/${mid}/scorers`, {
        user_ids: selectedScorerIds,
      })
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'matches', mid, 'scorers'],
      })
    } catch (e: unknown) {
      setScorerSaveError(e instanceof Error ? e.message : 'Could not save scorers')
    } finally {
      setIsSavingScorers(false)
    }
  }

  const leagueById = useMemo(() => {
    const m = new Map<number, string>()
    for (const l of leaguesQ.data ?? []) {
      m.set(l.id, l.name)
    }
    return m
  }, [leaguesQ.data])

  const playerById = useMemo(
    () =>
      new Map(
        (playersQ.data ?? []).map((p) => [p.id, p.full_name] as const),
      ),
    [playersQ.data],
  )

  const matchTableRow = useMemo((): MatchTableTeamRow | null => {
    if (!match) return null
    const home = teamsQ.data?.find((t) => t.id === match.home_team_id)
    const away = teamsQ.data?.find((t) => t.id === match.away_team_id)
    return {
      ...match,
      home_name: home?.name ?? `#${match.home_team_id}`,
      away_name: away?.name ?? `#${match.away_team_id}`,
      home_logo_url: home?.logo_url ?? null,
      away_logo_url: away?.logo_url ?? null,
    }
  }, [match, teamsQ.data])

  const loading =
    teamsQ.isLoading ||
    matchesQ.isLoading ||
    seasonsQ.isLoading ||
    leaguesQ.isLoading ||
    playersQ.isLoading
  const err =
    teamsQ.error ??
    matchesQ.error ??
    seasonsQ.error ??
    leaguesQ.error ??
    playersQ.error
  const teamOptions = teamsQ.data ?? []
  const seasonOptions = seasonsQ.data ?? []
  const playerStats = useMemo(() => match?.player_stats ?? [], [match?.player_stats])
  const battingFirstTeamId = match?.result?.batting_first_team_id ?? null
  const inningsExtrasLine = useMemo(() => {
    if (!match?.result || !match.home_team_id || !match.away_team_id) return null
    const sides = getInningsSides(
      scorecardInnings,
      battingFirstTeamId,
      match.home_team_id,
      match.away_team_id,
    )
    if (!sides) return null
    const side =
      sides.battingTeamId === match.home_team_id ? 'home' : 'away'
    return formatExtrasBreakdown(match.result, side)
  }, [
    match?.result,
    match?.home_team_id,
    match?.away_team_id,
    scorecardInnings,
    battingFirstTeamId,
  ])

  if (loading) {
    return <p className="muted">Loading…</p>
  }
  if (err) {
    return <p className="login-error">{err.message}</p>
  }
  if (!match || !merged || !Number.isFinite(mid)) {
    return (
      <>
        <PageHeader title="Match not found" />
        <Link to="/matches" search={matchListSearch} className="btn-ghost">
          Back to fixtures
        </Link>
      </>
    )
  }

  const title =
    `${homeName ?? `#${match.home_team_id}`} vs ${awayName ?? `#${match.away_team_id}`}`

  const headerDescParts = [
    match.season
      ? `${match.season.league.name} · ${match.season.name}`
      : match.season_id != null
        ? `Season id ${match.season_id}`
        : 'No season',
    `Match ${match.id}`,
  ]
  const resultScoreline = matchResultSummaryLine(match)
  if (resultScoreline) headerDescParts.push(resultScoreline)

  const headerWinner = matchWinnerSide(match)
  const readonlyResultOutcome = formatMatchResultOutcome(match)

  return (
    <>
      <PageHeader
        className="page-header--match"
        title={title}
        description={headerDescParts.join(' · ')}
        media={
          <div className="match-header-badges match-header-badges--fixture-duo">
            <span
              className={`entity-thumb-card__badge-wrap${headerWinner === 'home' ? ' entity-thumb-card__badge-wrap--winner' : ''}`}
              aria-label={headerWinner === 'home' ? 'Winner' : undefined}
            >
              <BadgeImage
                imageUrl={homeTeam?.logo_url}
                alt={`${homeName ?? 'Home'} logo`}
                size="lg"
              />
              {headerWinner === 'home' ? (
                <span
                  className="entity-thumb-card__winner-cup"
                  aria-hidden
                  title="Winner"
                >
                  🏆
                </span>
              ) : null}
            </span>
            <span className="muted" aria-hidden="true">
              vs
            </span>
            <span
              className={`entity-thumb-card__badge-wrap${headerWinner === 'away' ? ' entity-thumb-card__badge-wrap--winner' : ''}`}
              aria-label={headerWinner === 'away' ? 'Winner' : undefined}
            >
              <BadgeImage
                imageUrl={awayTeam?.logo_url}
                alt={`${awayName ?? 'Away'} logo`}
                size="lg"
              />
              {headerWinner === 'away' ? (
                <span
                  className="entity-thumb-card__winner-cup"
                  aria-hidden
                  title="Winner"
                >
                  🏆
                </span>
              ) : null}
            </span>
          </div>
        }
        actions={
          <>
            <Link to="/matches" search={matchListSearch} className="btn-ghost">
              Fixtures
            </Link>
            {isResultMode ? (
              <button
                type="button"
                className="btn-ghost btn--with-icon"
                onClick={goView}
              >
                <ClipboardList size={18} strokeWidth={2} aria-hidden />
                Match view
              </button>
            ) : null}
            {!isEditing && !isResultMode ? (
              <>
                <Link
                  to="/matches/$matchId"
                  params={{ matchId: String(mid) }}
                  search={{ ...matchListSearch, mode: 'result' }}
                  className="btn-primary btn--with-icon"
                >
                  <Table2 size={18} strokeWidth={2} aria-hidden />
                  Result & scorecard
                </Link>
                <Link
                  to="/scoring/$matchId"
                  params={{ matchId: String(mid) }}
                  className="btn-ghost btn--with-icon"
                >
                  <PlayCircle size={18} strokeWidth={2} aria-hidden />
                  Live scoring
                </Link>
                <button
                  type="button"
                  className="btn-ghost btn--with-icon"
                  onClick={beginEdit}
                >
                  <SquarePen size={18} strokeWidth={2} aria-hidden />
                  Edit fixture
                </button>
              </>
            ) : null}
          </>
        }
      />
      {isResultMode ? (
        <MatchResultEditor
          key={`${mid}|${matchPlayerStatsKey}`}
          match={match}
          matchId={mid}
          homeLabel={homeName ?? `#${match.home_team_id}`}
          awayLabel={awayName ?? `#${match.away_team_id}`}
          players={playersQ.data ?? []}
          onCancel={goView}
          onSaved={() => {
            void invalidateCompetitionDataQueries(queryClient).then(() =>
              queryClient.invalidateQueries({ queryKey: ['admin', 'matches', mid] }),
            )
            goView()
          }}
        />
      ) : isEditing ? (
        <InlineEditForm
          error={saveError}
          onCancel={goView}
          onSave={() => void save()}
          fields={[
            {
              id: 'season_id',
              label: 'Season',
              control: (
                <select
                  id="season_id"
                  className="inline-edit__control"
                  value={
                    merged.season_id != null ? String(merged.season_id) : ''
                  }
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      season_id: e.target.value
                        ? Number(e.target.value)
                        : null,
                    }))
                  }
                >
                  <option value="">— None —</option>
                  {seasonOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {(leagueById.get(s.league_id) ?? `League ${s.league_id}`) +
                        ' — ' +
                        s.name}
                    </option>
                  ))}
                </select>
              ),
            },
            {
              id: 'category',
              label: 'Category',
              control: (
                <CompetitionCategorySelect
                  id="category"
                  className="inline-edit__control"
                  value={normalizeCompetitionCategory(merged.category)}
                  onChange={(next) => setPatch((p) => ({ ...p, category: next }))}
                />
              ),
            },
            {
              id: 'home_team_id',
              label: 'Home team',
              control: (
                <select
                  id="home_team_id"
                  className="inline-edit__control"
                  value={merged.home_team_id}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      home_team_id: Number(e.target.value),
                    }))
                  }
                >
                  {teamOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ),
            },
            {
              id: 'away_team_id',
              label: 'Away team',
              control: (
                <select
                  id="away_team_id"
                  className="inline-edit__control"
                  value={merged.away_team_id}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      away_team_id: Number(e.target.value),
                    }))
                  }
                >
                  {teamOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ),
            },
            {
              id: 'title',
              label: 'Title (optional)',
              control: (
                <input
                  id="title"
                  className="inline-edit__control"
                  value={merged.title ?? ''}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      title: e.target.value || null,
                    }))
                  }
                />
              ),
            },
            {
              id: 'venue',
              label: 'Venue',
              control: (
                <input
                  id="venue"
                  className="inline-edit__control"
                  value={merged.venue ?? ''}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      venue: e.target.value || null,
                    }))
                  }
                />
              ),
            },
            {
              id: 'match_date',
              label: 'Match date',
              control: (
                <input
                  id="match_date"
                  type="date"
                  className="inline-edit__control"
                  value={merged.match_date ?? ''}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      match_date: e.target.value || null,
                    }))
                  }
                />
              ),
            },
            {
              id: 'start_time',
              label: 'Start time (optional)',
              control: (
                <input
                  id="start_time"
                  type="datetime-local"
                  className="inline-edit__control"
                  value={
                    merged.start_time
                      ? merged.start_time.slice(0, 16)
                      : ''
                  }
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      start_time: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    }))
                  }
                />
              ),
            },
            {
              id: 'toss_info',
              label: 'Toss (optional)',
              control: (
                <input
                  id="toss_info"
                  className="inline-edit__control"
                  value={merged.toss_info ?? ''}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      toss_info: e.target.value || null,
                    }))
                  }
                />
              ),
            },
            {
              id: 'umpires',
              label: 'Umpires (optional)',
              control: (
                <input
                  id="umpires"
                  className="inline-edit__control"
                  value={merged.umpires ?? ''}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      umpires: e.target.value || null,
                    }))
                  }
                />
              ),
            },
            {
              id: 'description',
              label: 'Notes (optional)',
              control: (
                <textarea
                  id="description"
                  className="inline-edit__control"
                  rows={3}
                  value={merged.description ?? ''}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      description: e.target.value || null,
                    }))
                  }
                />
              ),
            },
            {
              id: 'cover_image_url',
              label: 'Cover image (optional)',
              control: (
                <MediaUrlField
                  id="cover_image_url"
                  uploadKind="matches"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  value={merged.cover_image_url}
                  onChange={(next) =>
                    setPatch((p) => ({ ...p, cover_image_url: next }))
                  }
                />
              ),
            },
            {
              id: 'status',
              label: 'Status',
              control: (
                <select
                  id="status"
                  className="inline-edit__control"
                  value={merged.status}
                  onChange={(e) =>
                    setPatch((p) => ({ ...p, status: e.target.value }))
                  }
                >
                  {fixtureStatusOptions(match.status).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ),
            },
          ]}
        />
      ) : (
        <>
          <section className="team-hub-section">
            <div className="team-hub-section-head">
              <div className="team-hub-section-head__lead">
                <h2 className="team-hub-section__title">Live scoring access</h2>
                <p className="muted">
                  Assign scorer accounts to this match, then open the live scoring
                  screen. Current assignment: {assignedScorerNames}
                </p>
              </div>
              <Link
                to="/scoring/$matchId"
                params={{ matchId: String(mid) }}
                className="btn-primary btn--with-icon"
              >
                <PlayCircle size={18} strokeWidth={2} aria-hidden />
                Open live scoring
              </Link>
            </div>

            {usersQ.isError ? (
              <p className="muted">
                Scorer picker could not load. Only super admins can list users in
                the current backend. Scorers already assigned can still open their
                scoring screen.
              </p>
            ) : (
              <div className="inline-edit__grid">
                <label className="inline-edit__field">
                  <span className="inline-edit__label">Assigned scorer accounts</span>
                  <select
                    multiple
                    className="inline-edit__control"
                    value={selectedScorerIds.map(String)}
                    onChange={(event) => {
                      const next = Array.from(event.currentTarget.selectedOptions)
                        .map((option) => Number(option.value))
                        .filter((value) => Number.isFinite(value))
                      setSelectedScorerIds(next)
                    }}
                  >
                    {scorerUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name?.trim() || user.email} — {user.email}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="inline-edit__field">
                  <span className="inline-edit__label">Actions</span>
                  <button
                    type="button"
                    className="btn-ghost btn--with-icon"
                    onClick={() => void saveScorerAssignments()}
                    disabled={isSavingScorers || usersQ.isLoading}
                  >
                    <Save size={18} strokeWidth={2} aria-hidden />
                    {isSavingScorers ? 'Saving…' : 'Save scorers'}
                  </button>
                  {scorerSaveError ? (
                    <p className="login-error">{scorerSaveError}</p>
                  ) : null}
                  {usersQ.isLoading ? <p className="muted">Loading scorers…</p> : null}
                  {!usersQ.isLoading && scorerUsers.length === 0 ? (
                    <p className="muted">
                      No active scorer users yet. Create a user with the scorer
                      role first.
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </section>

          <div className="match-detail-panels">
            <div className="match-detail-panels__left">
              <DetailFields
                items={[
                  {
                    label: 'League · season',
                    value: match.season
                      ? `${match.season.league.name} — ${match.season.name}`
                      : '—',
                  },
                  {
                    label: 'When',
                    value: match.match_date ?? match.start_time ?? '—',
                  },
                  { label: 'Venue', value: match.venue ?? '—' },
                  { label: 'Title', value: match.title ?? '—' },
                  { label: 'Toss', value: match.toss_info ?? '—' },
                  { label: 'Umpires', value: match.umpires ?? '—' },
                  {
                    label: 'Notes',
                    value: match.description ?? '—',
                  },
                  { label: 'Category', value: match.category },
                  {
                    label: 'Home',
                    value:
                      matchTableRow != null ? (
                        <MatchTableTeamCell side="home" row={matchTableRow} />
                      ) : (
                        <span className="table-cell-with-badge">
                          <BadgeImage
                            imageUrl={homeTeam?.logo_url}
                            alt=""
                            size="sm"
                          />
                          <span>{homeName ?? `#${match.home_team_id}`}</span>
                        </span>
                      ),
                  },
                  {
                    label: 'Away',
                    value:
                      matchTableRow != null ? (
                        <MatchTableTeamCell side="away" row={matchTableRow} />
                      ) : (
                        <span className="table-cell-with-badge">
                          <BadgeImage
                            imageUrl={awayTeam?.logo_url}
                            alt=""
                            size="sm"
                          />
                          <span>{awayName ?? `#${match.away_team_id}`}</span>
                        </span>
                      ),
                  },
                  {
                    label: 'Status',
                    value: (
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
                    ),
                  },
                ]}
              />
            </div>
            <div className="match-detail-panels__right">
              {match.result != null || playerStats.length > 0 ? (
                <section className="match-readonly-result">
                  <div className="match-readonly-result__head">
                    <h2 className="match-readonly-result__h">Result & player stats</h2>
                    <SectionHintTip
                      ariaHelp="Submitted match outcome, margin, and per-player scorecard rows from the Result & scorecard editor."
                    >
                      <span className="section-hint-tip__text">
                        Submitted match outcome, margin, and per-player scorecard
                        rows from the <strong>Result & scorecard</strong> editor.
                      </span>
                    </SectionHintTip>
                  </div>
                  {match.result ? (
                    <div className="match-readonly-result__summary">
  {readonlyResultOutcome ? (
    <p>
      <strong>Outcome:</strong> {readonlyResultOutcome}
    </p>
  ) : null}

  {match.result.score_summary ? (
                        <p>
                          <strong>Score:</strong> {match.result.score_summary}
                        </p>
                      ) : null}
                      {match.result.margin_text ? (
                        <p>
                          <strong>Margin:</strong> {match.result.margin_text}
                        </p>
                      ) : null}
                      {match.result.winning_team_id != null ? (
                        <p>
                          <strong>Winner:</strong>{' '}
                          <span aria-hidden title="Winner">
                            🏆
                          </span>{' '}
                          {match.result.winning_team_id === match.home_team_id
                            ? (homeName ?? `Team ${match.home_team_id}`)
                            : match.result.winning_team_id === match.away_team_id
                              ? (awayName ?? `Team ${match.away_team_id}`)
                              : `Team #${match.result.winning_team_id}`}
                        </p>
                      ) : null}
                      {match.result.player_of_match_player_id != null ? (
                        <p>
                          <strong>Player of the match:</strong>{' '}
                          {playerById.get(match.result.player_of_match_player_id) ??
                            `#${match.result.player_of_match_player_id}`}
                        </p>
                      ) : null}
                      {match.result.innings_breakdown ? (
                        <p>
                          <strong>Innings:</strong> {match.result.innings_breakdown}
                        </p>
                      ) : null}
                      {match.result.top_performers ? (
                        <p>
                          <strong>Top performers:</strong> {match.result.top_performers}
                        </p>
                      ) : null}
                      {match.result.match_report ? (
                        <p>
                          <strong>Report:</strong> {match.result.match_report}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ) : (
                <p className="muted match-readonly-empty-hint">
                  <span>No result or scorecard yet.</span>
                  <SectionHintTip
                    ariaHelp="No result or scorecard yet. Use Result & scorecard to record the outcome and player statistics."
                  >
                    <span className="section-hint-tip__text">
                      Use <strong>Result & scorecard</strong> to record the outcome
                      and player statistics.
                    </span>
                  </SectionHintTip>
                </p>
              )}
            </div>
          </div>
          <section className="team-hub-section">
            <div className="team-hub-section-head">
              <div className="team-hub-section-head__lead">
                <h2 className="team-hub-section__title">Scorecard</h2>
                <SectionHintTip ariaHelp="Per-player scorecard rows for this fixture. The first column stays visible while remaining columns scroll horizontally.">
                  <span className="section-hint-tip__text">
                    Per-player scorecard rows for this fixture. The first column
                    stays visible while remaining columns scroll horizontally.
                  </span>
                </SectionHintTip>
              </div>
              <div className="dashboard-match-panel__tabs" role="tablist" aria-label="Scorecard innings">
                <button
                  type="button"
                  className={`dashboard-match-panel__tab${scorecardInnings === 1 ? ' is-active' : ''}`}
                  onClick={() => setScorecardInnings(1)}
                  role="tab"
                  aria-selected={scorecardInnings === 1}
                >
                  1st innings
                </button>
                <button
                  type="button"
                  className={`dashboard-match-panel__tab${scorecardInnings === 2 ? ' is-active' : ''}`}
                  onClick={() => setScorecardInnings(2)}
                  role="tab"
                  aria-selected={scorecardInnings === 2}
                >
                  2nd innings
                </button>
              </div>
            </div>
            {playerStats.length > 0 ? (
              <InningsScorecardPanels
                innings={scorecardInnings}
                battingFirstTeamId={battingFirstTeamId}
                homeTeamId={match.home_team_id}
                awayTeamId={match.away_team_id}
                homeLabel={homeName ?? 'Home'}
                awayLabel={awayName ?? 'Away'}
                stats={playerStats}
                playerName={(id) => playerById.get(id) ?? `#${id}`}
                extrasLine={inningsExtrasLine}
              />
            ) : (
              <p className="muted">No per-player rows yet.</p>
            )}
          </section>
        </>
      )}
    </>
  )
}
