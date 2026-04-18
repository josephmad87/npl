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

function fmtNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return String(n)
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

  const teamOptions = teamsQ.data ?? []
  const appearances = perfQ.data ?? []
  const mp = player.matches_played ?? 0
  const scorecardCount = appearances.length

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
                  ariaHelp={`Totals stored on the player row. Scorecard appearances (${scorecardCount}) come from entered match results; they may differ from matches played (${mp}) until stats are aligned.`}
                >
                  <span className="section-hint-tip__text">
                    Totals stored on the player row.{' '}
                    <strong>Scorecard appearances</strong> ({scorecardCount})
                    come from entered match results; they may differ from{' '}
                    <strong>matches played</strong> ({mp}) until stats are
                    aligned.
                  </span>
                </SectionHintTip>
              </div>
            </div>
            <div className="table-wrap">
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Matches (record)</th>
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
                    <tr>
                      <td>{mp}</td>
                      <td>{fmtNum(player.runs_scored)}</td>
                      <td>{fmtNum(player.batting_average ?? undefined)}</td>
                      <td>{fmtNum(player.strike_rate ?? undefined)}</td>
                      <td>{fmtNum(player.highest_score ?? undefined)}</td>
                      <td>{fmtNum(player.wickets_taken)}</td>
                      <td>{fmtNum(player.bowling_average ?? undefined)}</td>
                      <td>{fmtNum(player.economy_rate ?? undefined)}</td>
                      <td>{player.best_bowling ?? '—'}</td>
                      <td>{fmtNum(player.catches)}</td>
                      <td>{fmtNum(player.stumpings)}</td>
                      <td>{fmtNum(player.player_of_match_awards)}</td>
                    </tr>
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
                <div className="table-scroll match-stats-scroll">
                  <table className="data-table match-stats-table">
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
