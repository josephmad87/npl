import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ClipboardList, SquarePen, Table2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { LeagueDto, MatchDto, PlayerDto, SeasonDto, TeamDto } from '@/lib/api-types'
import { adminListAll, adminPatch } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { BadgeImage } from '@/components/BadgeImage'
import { MatchResultEditor } from '@/components/MatchResultEditor'
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
import { parseDetailRouteSearch } from '@/lib/detail-route-search'
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

function MatchDetailPage() {
  const { matchId } = Route.useParams()
  const mid = Number(matchId)
  const { mode } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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
    queryKey: ['admin', 'matches'],
    queryFn: () => adminListAll<MatchDto>('/admin/matches'),
  })
  const playersQ = useQuery({
    queryKey: ['admin', 'players'],
    queryFn: () => adminListAll<PlayerDto>('/admin/players'),
  })

  const match = matchesQ.data?.find((m) => m.id === mid)
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

  const isEditing = mode === 'edit'
  const isResultMode = mode === 'result'
  const [scorecardSide, setScorecardSide] = useState<'home' | 'away'>('home')
  const [patch, setPatch] = useState<Partial<MatchDto>>({})
  const [saveError, setSaveError] = useState<string | null>(null)

  const merged: MatchDto | null =
    match ? { ...match, ...patch } : null

  const goView = () => {
    if (!match) return
    setPatch({})
    setSaveError(null)
    void navigate({
      to: '/matches/$matchId',
      params: { matchId: String(match.id) },
      search: {},
    })
  }

  const beginEdit = () => {
    if (!match) return
    setPatch({})
    setSaveError(null)
    void navigate({
      to: '/matches/$matchId',
      params: { matchId: String(match.id) },
      search: { mode: 'edit' },
    })
  }

  const save = async () => {
    if (!merged || !match || !Number.isFinite(mid)) return
    if (merged.home_team_id === merged.away_team_id) {
      setSaveError('Home and away teams must differ.')
      return
    }
    try {
      await adminPatch<MatchDto>(`/admin/matches/${mid}`, {
        season_id: merged.season_id,
        category: merged.category,
        home_team_id: merged.home_team_id,
        away_team_id: merged.away_team_id,
        title: merged.title,
        venue: merged.venue,
        match_date: merged.match_date,
        status: merged.status,
        cover_image_url: merged.cover_image_url ?? null,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches'] })
      goView()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
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
  const scorecardRows = useMemo(
    () =>
      playerStats.filter((s) =>
        scorecardSide === 'home'
          ? s.team_id === (match?.home_team_id ?? -1)
          : s.team_id === (match?.away_team_id ?? -1),
      ),
    [playerStats, scorecardSide, match?.home_team_id, match?.away_team_id],
  )

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
        <BackNavLink to="/matches">Back to fixtures</BackNavLink>
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

  return (
    <>
      <PageHeader
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
            <BackNavLink to="/matches">Fixtures</BackNavLink>
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
                  search={{ mode: 'result' }}
                  className="btn-primary btn--with-icon"
                >
                  <Table2 size={18} strokeWidth={2} aria-hidden />
                  Result & scorecard
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
          match={match}
          matchId={mid}
          homeLabel={homeName ?? `#${match.home_team_id}`}
          awayLabel={awayName ?? `#${match.away_team_id}`}
          players={playersQ.data ?? []}
          onCancel={goView}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['admin', 'matches'] })
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
                <input
                  id="category"
                  className="inline-edit__control"
                  value={merged.category}
                  onChange={(e) =>
                    setPatch((p) => ({ ...p, category: e.target.value }))
                  }
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
                  {STATUSES.map((s) => (
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
            <div className="dashboard-match-panel__tabs" role="tablist" aria-label="Scorecard side">
              <button
                type="button"
                className={`dashboard-match-panel__tab${scorecardSide === 'home' ? ' is-active' : ''}`}
                onClick={() => setScorecardSide('home')}
                role="tab"
                aria-selected={scorecardSide === 'home'}
              >
                {homeName ?? 'Home'}
              </button>
              <button
                type="button"
                className={`dashboard-match-panel__tab${scorecardSide === 'away' ? ' is-active' : ''}`}
                onClick={() => setScorecardSide('away')}
                role="tab"
                aria-selected={scorecardSide === 'away'}
              >
                {awayName ?? 'Away'}
              </button>
            </div>
          </div>
          {playerStats.length > 0 ? (
            <div className="table-wrap">
              <div className="table-scroll table-scroll--sticky-first match-stats-scroll">
                <table className="data-table data-table--sticky-first data-table--no-wrap match-stats-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Side</th>
                      <th>R</th>
                      <th>BF</th>
                      <th>4s</th>
                      <th>6s</th>
                      <th>How out</th>
                      <th>Ov</th>
                      <th>M</th>
                      <th>Conc</th>
                      <th>W</th>
                      <th>Ct</th>
                      <th>St</th>
                      <th>RO</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scorecardRows.map((s) => (
                      <tr key={s.id}>
                        <td>{playerById.get(s.player_id) ?? `#${s.player_id}`}</td>
                        <td>
                          {s.team_id === match.home_team_id
                            ? (homeName ?? 'Home')
                            : s.team_id === match.away_team_id
                              ? (awayName ?? 'Away')
                              : `#${s.team_id}`}
                        </td>
                        <td>{s.runs}</td>
                        <td>{s.balls_faced}</td>
                        <td>{s.fours}</td>
                        <td>{s.sixes}</td>
                        <td>{s.dismissal ?? '—'}</td>
                        <td>{s.overs != null && s.overs !== '' ? String(s.overs) : '—'}</td>
                        <td>{s.maidens}</td>
                        <td>{s.runs_conceded}</td>
                        <td>{s.wickets}</td>
                        <td>{s.catches}</td>
                        <td>{s.stumpings}</td>
                        <td>{s.run_outs}</td>
                        <td>{s.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="muted">No per-player rows yet.</p>
          )}
          {playerStats.length > 0 && scorecardRows.length === 0 ? (
            <p className="muted">No scorecard rows for this side yet.</p>
          ) : (
            null
          )}
        </section>
        </>
      )}
    </>
  )
}
