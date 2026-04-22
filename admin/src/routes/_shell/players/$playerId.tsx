import { useQueries, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ClipboardList, SquarePen } from 'lucide-react'
import { useMemo, useState } from 'react'
import type {
  PlayerDto,
  PlayerMatchAppearanceDto,
  TeamDto,
} from '@/lib/api-types'
import { adminGet, adminListAll, adminPatch } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { BadgeImage } from '@/components/BadgeImage'
import { InlineEditForm } from '@/components/InlineEditForm'
import { MediaUrlField } from '@/components/MediaUrlField'
import { PageHeader } from '@/components/PageHeader'
import { PlayerAvatar, resolvePlayerPhotoSrc } from '@/components/PlayerAvatar'
import { SectionHintTip } from '@/components/SectionHintTip'
import { StatusBadge } from '@/components/StatusBadge'
import { parseDetailRouteSearch } from '@/lib/detail-route-search'

export const Route = createFileRoute('/_shell/players/$playerId')({
  validateSearch: parseDetailRouteSearch,
  component: PlayerDetailPage,
})

const STATUSES = ['active', 'inactive', 'injured'] as const

function fmtRate(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toFixed(2)
}

function oversToBalls(overs: string | number | null | undefined): number {
  if (overs == null) return 0
  const raw = String(overs).trim()
  if (!raw) return 0
  if (!raw.includes('.')) {
    const whole = Number(raw)
    return Number.isFinite(whole) ? whole * 6 : 0
  }
  const [wholePart, fracPart = '0'] = raw.split('.')
  const whole = Number(wholePart)
  const balls = Number(fracPart.slice(0, 1))
  if (!Number.isFinite(whole) || !Number.isFinite(balls)) return 0
  return whole * 6 + Math.max(0, Math.min(5, balls))
}

function PlayerDetailPage() {
  const { playerId } = Route.useParams()
  const pid = Number(playerId)
  const { mode } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [teamsQ, playersQ, perfQ] = useQueries({
    queries: [
      {
        queryKey: ['admin', 'teams'],
        queryFn: () => adminListAll<TeamDto>('/admin/teams'),
      },
      {
        queryKey: ['admin', 'players'],
        queryFn: () => adminListAll<PlayerDto>('/admin/players'),
      },
      {
        queryKey: ['admin', 'players', pid, 'match-appearances'],
        queryFn: () =>
          adminGet<PlayerMatchAppearanceDto[]>(
            `/admin/players/${pid}/match-appearances`,
          ),
        enabled: Number.isFinite(pid),
      },
    ],
  })

  const player = playersQ.data?.find((p) => p.id === pid)
  const teamName = useMemo(() => {
    if (!player) return ''
    return teamsQ.data?.find((t) => t.id === player.team_id)?.name ?? ''
  }, [player, teamsQ.data])

  const teamForPlayer = useMemo(() => {
    if (!player) return undefined
    return teamsQ.data?.find((t) => t.id === player.team_id)
  }, [player, teamsQ.data])

  const isEditing = mode === 'edit'
  const [patch, setPatch] = useState<Partial<PlayerDto>>({})
  const [saveError, setSaveError] = useState<string | null>(null)

  const merged: PlayerDto | null =
    player ? { ...player, ...patch } : null

  const goView = () => {
    if (!player) return
    setPatch({})
    setSaveError(null)
    void navigate({
      to: '/players/$playerId',
      params: { playerId: String(player.id) },
      search: {},
    })
  }

  const beginEdit = () => {
    if (!player) return
    setPatch({})
    setSaveError(null)
    void navigate({
      to: '/players/$playerId',
      params: { playerId: String(player.id) },
      search: { mode: 'edit' },
    })
  }

  const save = async () => {
    if (!merged || !player || !Number.isFinite(pid)) return
    const fullName = merged.full_name.trim()
    if (!fullName) {
      setSaveError('Full name is required.')
      return
    }
    try {
      await adminPatch<PlayerDto>(`/admin/players/${pid}`, {
        full_name: merged.full_name,
        slug: merged.slug,
        profile_photo_url: merged.profile_photo_url,
        team_id: merged.team_id,
        category: merged.category,
        role: merged.role,
        jersey_number: merged.jersey_number,
        status: merged.status,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'players'] })
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'players', pid, 'match-appearances'],
      })
      goView()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const loading =
    teamsQ.isLoading || playersQ.isLoading || perfQ.isLoading
  const err = teamsQ.error ?? playersQ.error ?? perfQ.error
  const teamOptions = teamsQ.data ?? []
  const appearances = perfQ.data ?? []
  const scorecardCount = appearances.length
  const careerByLeague = useMemo(() => {
    const source = perfQ.data ?? []
    type LeagueStats = {
      league: string
      matchIds: Set<number>
      runs: number
      ballsFaced: number
      outs: number
      highestScore: number
      wickets: number
      runsConceded: number
      bowlingBalls: number
      catches: number
      stumpings: number
      potm: number
      bestWickets: number
      bestRunsConceded: number | null
    }

    const byLeague = new Map<string, LeagueStats>()
    for (const row of source) {
      const leagueLabel = row.league_name ?? 'Unknown league'
      const next =
        byLeague.get(leagueLabel) ??
        {
          league: leagueLabel,
          matchIds: new Set<number>(),
          runs: 0,
          ballsFaced: 0,
          outs: 0,
          highestScore: 0,
          wickets: 0,
          runsConceded: 0,
          bowlingBalls: 0,
          catches: 0,
          stumpings: 0,
          potm: 0,
          bestWickets: 0,
          bestRunsConceded: null,
        }

      next.matchIds.add(row.match_id)
      next.runs += row.runs ?? 0
      next.ballsFaced += row.balls_faced ?? 0
      next.highestScore = Math.max(next.highestScore, row.runs ?? 0)
      next.wickets += row.wickets ?? 0
      next.runsConceded += row.runs_conceded ?? 0
      next.bowlingBalls += oversToBalls(row.overs)
      next.catches += row.catches ?? 0
      next.stumpings += row.stumpings ?? 0

      const dismissal = (row.dismissal ?? '').trim().toLowerCase()
      if (dismissal && dismissal !== 'not out' && dismissal !== 'retired hurt') {
        next.outs += 1
      }

      const wkts = row.wickets ?? 0
      const conceded = row.runs_conceded ?? 0
      const isBetterBest =
        wkts > next.bestWickets ||
        (wkts === next.bestWickets &&
          wkts > 0 &&
          (next.bestRunsConceded == null || conceded < next.bestRunsConceded))
      if (isBetterBest) {
        next.bestWickets = wkts
        next.bestRunsConceded = conceded
      }

      byLeague.set(leagueLabel, next)
    }

    return [...byLeague.values()]
      .sort((a, b) => a.league.localeCompare(b.league))
      .map((s) => {
        const matches = s.matchIds.size
        const battingAverage = s.outs > 0 ? s.runs / s.outs : null
        const strikeRate = s.ballsFaced > 0 ? (s.runs / s.ballsFaced) * 100 : null
        const bowlingAverage = s.wickets > 0 ? s.runsConceded / s.wickets : null
        const economy =
          s.bowlingBalls > 0 ? (s.runsConceded * 6) / s.bowlingBalls : null
        const best =
          s.bestWickets > 0 && s.bestRunsConceded != null
            ? `${s.bestWickets}/${s.bestRunsConceded}`
            : '—'

        return {
          league: s.league,
          matches,
          runs: s.runs,
          battingAverage,
          strikeRate,
          highestScore: s.highestScore,
          wickets: s.wickets,
          bowlingAverage,
          economy,
          best,
          catches: s.catches,
          stumpings: s.stumpings,
          potm: s.potm,
        }
      })
  }, [perfQ.data])

  if (loading) {
    return <p className="muted">Loading…</p>
  }
  if (err) {
    return <p className="login-error">{err.message}</p>
  }
  if (!player || !merged || !Number.isFinite(pid)) {
    return (
      <>
        <PageHeader title="Player not found" />
        <BackNavLink to="/players">Back to players</BackNavLink>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={isEditing ? merged.full_name : player.full_name}
        description={`Slug: ${(isEditing ? merged.slug : player.slug) ?? ''} · ID ${player.id}`}
        descriptionAsTooltip={!isEditing}
        media={
          isEditing ? (
            <PlayerAvatar
              profilePhotoUrl={merged.profile_photo_url}
              alt={`${player.full_name} photo`}
              size="lg"
            />
          ) : undefined
        }
        actions={
          <>
            <BackNavLink to="/players">Players</BackNavLink>
            {!isEditing ? (
              <button
                type="button"
                className="btn-primary btn--with-icon"
                onClick={beginEdit}
              >
                <SquarePen size={18} strokeWidth={2} aria-hidden />
                Edit player
              </button>
            ) : null}
          </>
        }
      />
      {isEditing ? (
        <InlineEditForm
          error={saveError}
          onCancel={goView}
          onSave={() => void save()}
          fields={[
            {
              id: 'full_name',
              label: 'Full name',
              control: (
                <input
                  id="full_name"
                  className="inline-edit__control"
                  value={merged.full_name}
                  onChange={(e) =>
                    setPatch((p) => ({ ...p, full_name: e.target.value }))
                  }
                />
              ),
            },
            {
              id: 'slug',
              label: 'Slug',
              control: (
                <input
                  id="slug"
                  className="inline-edit__control"
                  value={merged.slug}
                  onChange={(e) =>
                    setPatch((p) => ({ ...p, slug: e.target.value }))
                  }
                />
              ),
            },
            {
              id: 'profile_photo_url',
              label: 'Profile photo (image)',
              control: (
                <MediaUrlField
                  id="profile_photo_url"
                  uploadKind="players"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  value={merged.profile_photo_url}
                  onChange={(next) =>
                    setPatch((p) => ({ ...p, profile_photo_url: next }))
                  }
                />
              ),
            },
            {
              id: 'team_id',
              label: 'Team',
              control: (
                <select
                  id="team_id"
                  className="inline-edit__control"
                  value={merged.team_id}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      team_id: Number(e.target.value),
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
              id: 'role',
              label: 'Role',
              control: (
                <input
                  id="role"
                  className="inline-edit__control"
                  value={merged.role ?? ''}
                  onChange={(e) =>
                    setPatch((p) => ({ ...p, role: e.target.value || null }))
                  }
                />
              ),
            },
            {
              id: 'jersey_number',
              label: 'Jersey number',
              control: (
                <input
                  id="jersey_number"
                  type="number"
                  min={0}
                  className="inline-edit__control"
                  value={merged.jersey_number ?? ''}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      jersey_number: e.target.value
                        ? Number(e.target.value)
                        : null,
                    }))
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
          <article
            className="entity-detail-hero"
            aria-label={`${player.full_name} profile summary`}
          >
            <div className="entity-detail-hero__media">
              <img
                src={resolvePlayerPhotoSrc(player.profile_photo_url)}
                alt=""
                loading="eager"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.src = resolvePlayerPhotoSrc(null)
                }}
              />
            </div>
            <div className="entity-detail-hero__body">
              <div className="entity-detail-hero-row">
                <span className="entity-detail-hero-row__label">Team</span>
                <span className="entity-detail-hero-row__value">
                  <Link
                    to="/teams/$teamId"
                    params={{ teamId: String(player.team_id) }}
                    className="team-hub-player-link table-cell-with-badge"
                  >
                    <BadgeImage
                      imageUrl={teamForPlayer?.logo_url}
                      alt=""
                      size="sm"
                    />
                    <span>{teamName || `#${player.team_id}`}</span>
                  </Link>
                </span>
              </div>
              <div className="entity-detail-hero-row">
                <span className="entity-detail-hero-row__label">Category</span>
                <span className="entity-detail-hero-row__value">
                  {player.category}
                </span>
              </div>
              <div className="entity-detail-hero-row">
                <span className="entity-detail-hero-row__label">Role</span>
                <span className="entity-detail-hero-row__value">
                  {player.role ?? '—'}
                </span>
              </div>
              <div className="entity-detail-hero-row">
                <span className="entity-detail-hero-row__label">Jersey</span>
                <span className="entity-detail-hero-row__value">
                  {String(player.jersey_number ?? '—')}
                </span>
              </div>
              <div className="entity-detail-hero-row">
                <span className="entity-detail-hero-row__label">Profile photo</span>
                <div className="entity-detail-hero-row__value entity-detail-hero-row__value--inline">
                  {player.profile_photo_url ? (
                    <>
                      <a
                        href={player.profile_photo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="entity-detail-hero-row__link entity-detail-hero-row__link--ellipsis"
                        title={player.profile_photo_url}
                      >
                        {player.profile_photo_url}
                      </a>
                      <SectionHintTip ariaHelp={player.profile_photo_url}>
                        <span className="section-hint-tip__text">
                          <code>{player.profile_photo_url}</code>
                        </span>
                      </SectionHintTip>
                    </>
                  ) : (
                    <>
                      <span className="muted">Built-in image</span>
                      <SectionHintTip ariaHelp="Default placeholder (no custom URL)">
                        <span className="section-hint-tip__text">
                          Default placeholder (no custom URL)
                        </span>
                      </SectionHintTip>
                    </>
                  )}
                </div>
              </div>
              <div className="entity-detail-hero-row">
                <span className="entity-detail-hero-row__label">Status</span>
                <span className="entity-detail-hero-row__value">
                  <StatusBadge
                    status={player.status as 'active' | 'inactive' | 'injured'}
                  />
                </span>
              </div>
              <div className="entity-detail-hero-row">
                <span className="entity-detail-hero-row__label">Slug</span>
                <span className="entity-detail-hero-row__value">
                  {player.slug}
                </span>
              </div>
            </div>
          </article>

          <section className="team-hub-section">
            <div className="team-hub-section-head">
              <div className="team-hub-section-head__lead">
                <h2 className="team-hub-section__title">
                  Career record (player profile)
                </h2>
                <SectionHintTip
                  ariaHelp={`Calculated from scorecard rows in the match log. One row per league where this player appears. Current scorecard lines: ${scorecardCount}.`}
                >
                  <span className="section-hint-tip__text">
                    Calculated from entered scorecard rows, grouped by league.
                    One row represents the player's record within that league.
                  </span>
                </SectionHintTip>
              </div>
            </div>
            <div className="table-wrap">
              <div className="table-scroll table-scroll--sticky-first">
                <table className="data-table data-table--sticky-first">
                  <thead>
                    <tr>
                      <th>League</th>
                      <th>Matches</th>
                      <th>Runs</th>
                      <th>Avg</th>
                      <th>SR</th>
                      <th>HS</th>
                      <th>Wkts</th>
                      <th>Bowl avg</th>
                      <th>Econ</th>
                      <th>Best</th>
                      <th>Ct</th>
                      <th>St</th>
                      <th>POTM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {careerByLeague.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="muted">
                          No scorecard rows yet.
                        </td>
                      </tr>
                    ) : (
                      careerByLeague.map((row) => (
                        <tr key={row.league}>
                          <td>{row.league}</td>
                          <td>{row.matches}</td>
                          <td>{row.runs}</td>
                          <td>{fmtRate(row.battingAverage)}</td>
                          <td>{fmtRate(row.strikeRate)}</td>
                          <td>{row.highestScore}</td>
                          <td>{row.wickets}</td>
                          <td>{fmtRate(row.bowlingAverage)}</td>
                          <td>{fmtRate(row.economy)}</td>
                          <td>{row.best}</td>
                          <td>{row.catches}</td>
                          <td>{row.stumpings}</td>
                          <td>{row.potm}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="team-hub-section">
            <div className="team-hub-section-head">
              <div className="team-hub-section-head__lead">
                <h2 className="team-hub-section__title">
                  Match log & scorecard lines ({scorecardCount})
                </h2>
                <SectionHintTip
                  ariaHelp="One row per fixture where this player appears on the submitted scorecard. Open the match for full detail and editing."
                >
                  <span className="section-hint-tip__text">
                    One row per fixture where this player appears on the submitted
                    scorecard. Open the match for full detail and editing.
                  </span>
                </SectionHintTip>
              </div>
            </div>
            {appearances.length === 0 ? (
              <p className="muted">
                No scorecard rows yet. Enter results from the match page (
                <strong>Result & scorecard</strong>).
              </p>
            ) : (
              <div className="table-wrap">
                <div className="table-scroll table-scroll--sticky-first match-stats-scroll">
                  <table className="data-table data-table--sticky-first match-stats-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Competition</th>
                        <th>Fixture</th>
                        <th>Side</th>
                        <th>R</th>
                        <th>BF</th>
                        <th>4s</th>
                        <th>6s</th>
                        <th>Out</th>
                        <th>Ov</th>
                        <th>M</th>
                        <th>Conc</th>
                        <th>W</th>
                        <th>Ct</th>
                        <th>St</th>
                        <th>RO</th>
                        <th>Notes</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {appearances.map((row) => {
                        const home = row.side_team_id === row.home_team_id
                        const opp = home
                          ? row.away_team_name
                          : row.home_team_name
                        const comp =
                          row.league_name && row.season_name
                            ? `${row.league_name} · ${row.season_name}`
                            : row.season_name ?? row.league_name ?? '—'
                        const when = row.match_date ?? '—'
                        return (
                          <tr key={row.stat_id}>
                            <td>{when}</td>
                            <td>{comp}</td>
                            <td>
                              <span className="muted" style={{ fontSize: '0.82rem' }}>
                                {row.home_team_name} vs {row.away_team_name}
                              </span>
                            </td>
                            <td>
                              {home ? 'Home' : 'Away'} ({opp})
                            </td>
                            <td>{row.runs}</td>
                            <td>{row.balls_faced}</td>
                            <td>{row.fours}</td>
                            <td>{row.sixes}</td>
                            <td>{row.dismissal ?? '—'}</td>
                            <td>
                              {row.overs != null ? String(row.overs) : '—'}
                            </td>
                            <td>{row.maidens}</td>
                            <td>{row.runs_conceded}</td>
                            <td>{row.wickets}</td>
                            <td>{row.catches}</td>
                            <td>{row.stumpings}</td>
                            <td>{row.run_outs}</td>
                            <td>{row.notes ?? '—'}</td>
                            <td>
                              <Link
                                to="/matches/$matchId"
                                params={{ matchId: String(row.match_id) }}
                                className="btn-ghost btn--with-icon"
                              >
                                <ClipboardList
                                  size={18}
                                  strokeWidth={2}
                                  aria-hidden
                                />
                                Match
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}
