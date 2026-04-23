import { useQueries, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  CalendarPlus,
  ClipboardList,
  Eye,
  Layers,
  SquarePen,
  UserPlus,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import type {
  LeagueDto,
  MatchDto,
  PlayerDto,
  SeasonDto,
  TeamDto,
} from '@/lib/api-types'
import logoFallbackSrc from '@/assets/logo.jpeg'
import { CompetitionCategorySelect } from '@/components/CompetitionCategorySelect'
import { BackNavLink } from '@/components/BackNavLink'
import { DetailFields } from '@/components/DetailFields'
import { adminListAll, adminPatch } from '@/lib/admin-client'
import { BadgeImage } from '@/components/BadgeImage'
import { InlineEditForm } from '@/components/InlineEditForm'
import { MediaUrlField } from '@/components/MediaUrlField'
import { PageHeader } from '@/components/PageHeader'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { SectionHintTip } from '@/components/SectionHintTip'
import { StatusBadge } from '@/components/StatusBadge'
import { parseDetailRouteSearch } from '@/lib/detail-route-search'
import { resolveAdminMediaUrl } from '@/lib/media-url'
import { normalizeCompetitionCategory } from '@/lib/competitionCategories'
import { matchResultSummaryLine } from '@/lib/match-winner'

export const Route = createFileRoute('/_shell/teams/$teamId')({
  validateSearch: parseDetailRouteSearch,
  component: TeamDetailPage,
})

const STATUSES = ['active', 'inactive'] as const
type TeamDetailTab = 'profile' | 'rosters' | 'fixtures' | 'completed' | 'players'
const TEAM_TAB_ROWS = 10

function parseLines(value: string): string[] | null {
  const rows = value
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean)
  return rows.length > 0 ? rows : null
}

function formatLines(values: string[] | null | undefined): string {
  return (values ?? []).join('\n')
}

function resolveTeamHeroSrc(team: TeamDto): string {
  const cover = resolveAdminMediaUrl(team.cover_image_url)
  if (cover) return cover
  const logo = resolveAdminMediaUrl(team.logo_url)
  if (logo) return logo
  return logoFallbackSrc
}

function TeamDetailPage() {
  const { teamId } = Route.useParams()
  const tid = Number(teamId)
  const { mode } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pickLeagueId, setPickLeagueId] = useState<number | ''>('')
  const [pickSeasonId, setPickSeasonId] = useState<number | ''>('')
  const [activeTab, setActiveTab] = useState<TeamDetailTab>('profile')
  const [rosterError, setRosterError] = useState<string | null>(null)
  const [rosterBusy, setRosterBusy] = useState(false)

  const [teamsQ, seasonsQ, leaguesQ, matchesQ, playersQ] = useQueries({
    queries: [
      {
        queryKey: ['admin', 'teams'],
        queryFn: () => adminListAll<TeamDto>('/admin/teams'),
      },
      {
        queryKey: ['admin', 'seasons', 'all'],
        queryFn: () => adminListAll<SeasonDto>('/admin/seasons'),
      },
      {
        queryKey: ['admin', 'leagues'],
        queryFn: () => adminListAll<LeagueDto>('/admin/leagues'),
      },
      {
        queryKey: ['admin', 'matches', 'team', tid],
        queryFn: () =>
          adminListAll<MatchDto>(`/admin/matches?team_id=${tid}`, 100, 15),
        enabled: Number.isFinite(tid),
      },
      {
        queryKey: ['admin', 'players', 'team', tid],
        queryFn: () =>
          adminListAll<PlayerDto>(`/admin/players?team_id=${tid}`, 100, 10),
        enabled: Number.isFinite(tid),
      },
    ],
  })

  const team = teamsQ.data?.find((t) => t.id === tid)
  const isEditing = mode === 'edit'
  const [patch, setPatch] = useState<Partial<TeamDto>>({})
  const [saveError, setSaveError] = useState<string | null>(null)

  const merged: TeamDto | null =
    team ? { ...team, ...patch } : null

  const teamById = useMemo(
    () => new Map((teamsQ.data ?? []).map((t) => [t.id, t] as const)),
    [teamsQ.data],
  )

  const leagueById = useMemo(
    () => new Map((leaguesQ.data ?? []).map((l) => [l.id, l] as const)),
    [leaguesQ.data],
  )

  const seasonsWithRoster = useMemo(() => {
    if (!Number.isFinite(tid)) return []
    const rows = seasonsQ.data ?? []
    return rows
      .filter((s) => (s.team_ids ?? []).includes(tid))
      .map((s) => ({
        season: s,
        league: leagueById.get(s.league_id),
      }))
      .sort((a, b) => {
        const an = a.league?.name ?? ''
        const bn = b.league?.name ?? ''
        if (an !== bn) return an.localeCompare(bn)
        return a.season.name.localeCompare(b.season.name)
      })
  }, [seasonsQ.data, tid, leagueById])

  const seasonsAvailableToJoin = useMemo(() => {
    if (!Number.isFinite(tid)) return []
    if (pickLeagueId === '' || !Number.isFinite(Number(pickLeagueId))) {
      return []
    }
    const lid = Number(pickLeagueId)
    return (seasonsQ.data ?? []).filter(
      (s) =>
        s.league_id === lid && !(s.team_ids ?? []).includes(tid),
    )
  }, [pickLeagueId, seasonsQ.data, tid])

  const matches = useMemo(
    () => matchesQ.data ?? [],
    [matchesQ.data],
  )
  const players = useMemo(
    () => playersQ.data ?? [],
    [playersQ.data],
  )
  const completedMatches = useMemo(
    () => matches.filter((m) => m.status === 'completed'),
    [matches],
  )
  const rosterRows = seasonsWithRoster.slice(0, TEAM_TAB_ROWS)
  const fixtureRows = matches.slice(0, TEAM_TAB_ROWS)
  const completedRows = completedMatches.slice(0, TEAM_TAB_ROWS)
  const playersSorted = useMemo(
    () =>
      [...players].sort((a, b) =>
        a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' }),
      ),
    [players],
  )
  const captainSelectValue = useMemo(() => {
    const pid = merged?.captain_player_id
    if (pid != null && Number.isFinite(pid) && players.some((p) => p.id === pid)) {
      return String(pid)
    }
    const name = (merged?.captain ?? '').trim()
    if (name) {
      const hit = players.find((p) => p.full_name === name)
      if (hit) return String(hit.id)
    }
    return ''
  }, [merged?.captain_player_id, merged?.captain, players])

  const addTeamToSeasonRoster = useCallback(async () => {
    if (pickSeasonId === '' || !Number.isFinite(Number(pickSeasonId))) {
      setRosterError('Select a season.')
      return
    }
    const sid = Number(pickSeasonId)
    const season = (seasonsQ.data ?? []).find((s) => s.id === sid)
    if (!season) {
      setRosterError('Season not found.')
      return
    }
    if ((season.team_ids ?? []).includes(tid)) {
      setRosterError('This team is already on that season roster.')
      return
    }
    setRosterError(null)
    setRosterBusy(true)
    try {
      const nextIds = [...new Set([...(season.team_ids ?? []), tid])]
      await adminPatch<SeasonDto>(`/admin/seasons/${sid}`, {
        team_ids: nextIds,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'seasons'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches'] })
      setPickSeasonId('')
      setPickLeagueId('')
    } catch (e: unknown) {
      setRosterError(e instanceof Error ? e.message : 'Could not update roster')
    } finally {
      setRosterBusy(false)
    }
  }, [pickSeasonId, seasonsQ.data, tid, queryClient])

  const goView = () => {
    if (!team) return
    setPatch({})
    setSaveError(null)
    void navigate({
      to: '/teams/$teamId',
      params: { teamId: String(team.id) },
      search: {},
    })
  }

  const beginEdit = () => {
    if (!team) return
    setPatch({ category: normalizeCompetitionCategory(team.category) })
    setSaveError(null)
    void navigate({
      to: '/teams/$teamId',
      params: { teamId: String(team.id) },
      search: { mode: 'edit' },
    })
  }

  const save = async () => {
    if (!merged || !team || !Number.isFinite(tid)) return
    const name = merged.name.trim()
    if (!name) {
      setSaveError('Name is required.')
      return
    }
    try {
      await adminPatch<TeamDto>(`/admin/teams/${tid}`, {
        name: merged.name,
        slug: merged.slug,
        category: merged.category,
        short_name: merged.short_name,
        logo_url: merged.logo_url,
        cover_image_url: merged.cover_image_url ?? null,
        home_ground: merged.home_ground,
        home_ground_name: merged.home_ground_name ?? null,
        home_ground_location: merged.home_ground_location ?? null,
        home_ground_image_url: merged.home_ground_image_url ?? null,
        captain_player_id: merged.captain_player_id ?? null,
        captain: merged.captain ?? null,
        coach: merged.coach ?? null,
        coach_image_url: merged.coach_image_url ?? null,
        manager: merged.manager ?? null,
        manager_image_url: merged.manager_image_url ?? null,
        history: merged.history ?? null,
        trophies: merged.trophies ?? null,
        status: merged.status,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'teams'] })
      goView()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const loading =
    teamsQ.isLoading ||
    seasonsQ.isLoading ||
    leaguesQ.isLoading ||
    matchesQ.isLoading ||
    playersQ.isLoading
  const err =
    teamsQ.error ??
    seasonsQ.error ??
    leaguesQ.error ??
    matchesQ.error ??
    playersQ.error

  if (loading) {
    return <p className="muted">Loading…</p>
  }

  if (err) {
    return <p className="login-error">{err.message}</p>
  }

  if (!team || !merged || !Number.isFinite(tid)) {
    return (
      <>
        <PageHeader title="Team not found" />
        <p className="muted">No team with this id.</p>
        <BackNavLink to="/teams">Back to teams</BackNavLink>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={isEditing ? merged.name : team.name}
        description={
          isEditing
            ? `Slug: ${merged.slug ?? ''} · ID ${team.id}`
            : `Slug: ${team.slug} · ID ${team.id}`
        }
        descriptionAsTooltip={!isEditing}
        media={
          isEditing ? (
            <BadgeImage
              imageUrl={merged.logo_url}
              alt={`${team.name} logo`}
              size="lg"
            />
          ) : undefined
        }
        actions={
          <>
            <BackNavLink to="/teams">Teams</BackNavLink>
            {!isEditing ? (
              <button
                type="button"
                className="btn-primary btn--with-icon"
                onClick={beginEdit}
              >
                <SquarePen size={18} strokeWidth={2} aria-hidden />
                Edit team
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
              id: 'name',
              label: 'Name',
              control: (
                <input
                  id="name"
                  className="inline-edit__control"
                  value={merged.name}
                  onChange={(e) =>
                    setPatch((p) => ({ ...p, name: e.target.value }))
                  }
                />
              ),
            },
            {
              id: 'short_name',
              label: 'Short name',
              control: (
                <input
                  id="short_name"
                  className="inline-edit__control"
                  value={merged.short_name ?? ''}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      short_name: e.target.value || null,
                    }))
                  }
                />
              ),
            },
            {
              id: 'logo_url',
              label: 'Team badge (image)',
              control: (
                <MediaUrlField
                  id="logo_url"
                  uploadKind="teams"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  value={merged.logo_url}
                  onChange={(next) =>
                    setPatch((p) => ({ ...p, logo_url: next }))
                  }
                />
              ),
            },
            {
              id: 'cover_image_url',
              label: 'Cover / hero (image)',
              control: (
                <MediaUrlField
                  id="cover_image_url"
                  uploadKind="teams"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  value={merged.cover_image_url ?? null}
                  onChange={(next) =>
                    setPatch((p) => ({ ...p, cover_image_url: next }))
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
              id: 'home_venue',
              label: 'Home ground',
              control: (
                <input
                  id="home_venue"
                  className="inline-edit__control"
                  value={
                    (merged.home_ground_name ?? merged.home_ground) ?? ''
                  }
                  onChange={(e) => {
                    const v = e.target.value.trim() || null
                    setPatch((p) => ({
                      ...p,
                      home_ground: v,
                      home_ground_name: v,
                    }))
                  }}
                />
              ),
            },
            {
              id: 'home_ground_location',
              label: 'Home ground location',
              control: (
                <input
                  id="home_ground_location"
                  className="inline-edit__control"
                  value={merged.home_ground_location ?? ''}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      home_ground_location: e.target.value || null,
                    }))
                  }
                />
              ),
            },
            {
              id: 'home_ground_image_url',
              label: 'Home ground image',
              control: (
                <MediaUrlField
                  id="home_ground_image_url"
                  uploadKind="teams"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  value={merged.home_ground_image_url ?? null}
                  onChange={(next) =>
                    setPatch((p) => ({ ...p, home_ground_image_url: next }))
                  }
                />
              ),
            },
            {
              id: 'captain_player',
              label: 'Captain',
              control: (
                <select
                  id="captain_player"
                  className="inline-edit__control"
                  value={captainSelectValue}
                  onChange={(e) => {
                    const v = e.target.value
                    if (!v) {
                      setPatch((p) => ({
                        ...p,
                        captain_player_id: null,
                        captain: null,
                      }))
                      return
                    }
                    const id = Number(v)
                    const pl = playersSorted.find((x) => x.id === id)
                    setPatch((p) => ({
                      ...p,
                      captain_player_id: id,
                      captain: pl?.full_name ?? null,
                    }))
                  }}
                >
                  <option value="">None</option>
                  {playersSorted.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              ),
            },
            {
              id: 'coach',
              label: 'Coach name',
              control: (
                <input
                  id="coach"
                  className="inline-edit__control"
                  value={merged.coach ?? ''}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      coach: e.target.value.trim() || null,
                    }))
                  }
                />
              ),
            },
            {
              id: 'coach_image_url',
              label: 'Coach photo',
              control: (
                <MediaUrlField
                  id="coach_image_url"
                  uploadKind="teams"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  value={merged.coach_image_url ?? null}
                  onChange={(next) =>
                    setPatch((p) => ({ ...p, coach_image_url: next }))
                  }
                />
              ),
            },
            {
              id: 'manager',
              label: 'Manager name',
              control: (
                <input
                  id="manager"
                  className="inline-edit__control"
                  value={merged.manager ?? ''}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      manager: e.target.value.trim() || null,
                    }))
                  }
                />
              ),
            },
            {
              id: 'manager_image_url',
              label: 'Manager photo',
              control: (
                <MediaUrlField
                  id="manager_image_url"
                  uploadKind="teams"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  value={merged.manager_image_url ?? null}
                  onChange={(next) =>
                    setPatch((p) => ({ ...p, manager_image_url: next }))
                  }
                />
              ),
            },
            {
              id: 'history',
              label: 'Team history',
              control: (
                <textarea
                  id="history"
                  className="inline-edit__control"
                  rows={5}
                  value={merged.history ?? ''}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      history: e.target.value || null,
                    }))
                  }
                />
              ),
            },
            {
              id: 'trophies',
              label: 'Team trophies (one per line)',
              control: (
                <textarea
                  id="trophies"
                  className="inline-edit__control"
                  rows={4}
                  value={formatLines(merged.trophies)}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      trophies: parseLines(e.target.value),
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
            className="entity-detail-hero entity-detail-hero--team"
            aria-label={`${team.name} profile banner`}
          >
            <div className="entity-detail-hero__media entity-detail-hero__media--logo">
              <img
                src={resolveTeamHeroSrc(team)}
                alt=""
                loading="eager"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.src = logoFallbackSrc
                }}
              />
            </div>
            <div className="entity-detail-hero__body">
              <div className="entity-detail-hero-row">
                <span className="entity-detail-hero-row__label">Short name</span>
                <span className="entity-detail-hero-row__value">
                  {team.short_name ?? '—'}
                </span>
              </div>
              <div className="entity-detail-hero-row">
                <span className="entity-detail-hero-row__label">Logo</span>
                <div className="entity-detail-hero-row__value entity-detail-hero-row__value--inline">
                  {team.logo_url ? (
                    <>
                      <a
                        href={team.logo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="entity-detail-hero-row__link entity-detail-hero-row__link--ellipsis"
                        title={team.logo_url}
                      >
                        {team.logo_url}
                      </a>
                      <SectionHintTip ariaHelp={team.logo_url}>
                        <span className="section-hint-tip__text">
                          <code>{team.logo_url}</code>
                        </span>
                      </SectionHintTip>
                    </>
                  ) : (
                    <>
                      <span className="muted">Built-in badge</span>
                      <SectionHintTip ariaHelp="Default NPL badge (no custom URL)">
                        <span className="section-hint-tip__text">
                          Default NPL badge (no custom URL)
                        </span>
                      </SectionHintTip>
                    </>
                  )}
                </div>
              </div>
              <div className="entity-detail-hero-row">
                <span className="entity-detail-hero-row__label">Category</span>
                <span className="entity-detail-hero-row__value">
                  {team.category}
                </span>
              </div>
            </div>
          </article>

          <section className="team-hub-section">
            <h2 className="team-hub-section__title">Quick links</h2>
            <div className="team-hub-section__links">
              <Link
                to="/matches/new"
                className="btn-ghost btn--with-icon"
              >
                <CalendarPlus size={18} strokeWidth={2} aria-hidden />
                New fixture
              </Link>
              <Link to="/players/new" className="btn-ghost btn--with-icon">
                <UserPlus size={18} strokeWidth={2} aria-hidden />
                New player
              </Link>
            </div>
          </section>

          <section className="team-hub-section">
            <div className="dashboard-match-panel__tabs" role="tablist" aria-label="Team detail sections">
              <button
                type="button"
                className={`dashboard-match-panel__tab${activeTab === 'profile' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('profile')}
                role="tab"
                aria-selected={activeTab === 'profile'}
              >
                Team profile
              </button>
              <button
                type="button"
                className={`dashboard-match-panel__tab${activeTab === 'rosters' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('rosters')}
                role="tab"
                aria-selected={activeTab === 'rosters'}
              >
                Leagues & season rosters
              </button>
              <button
                type="button"
                className={`dashboard-match-panel__tab${activeTab === 'fixtures' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('fixtures')}
                role="tab"
                aria-selected={activeTab === 'fixtures'}
              >
                Fixtures & results
              </button>
              <button
                type="button"
                className={`dashboard-match-panel__tab${activeTab === 'completed' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('completed')}
                role="tab"
                aria-selected={activeTab === 'completed'}
              >
                Completed results ({completedMatches.length})
              </button>
              <button
                type="button"
                className={`dashboard-match-panel__tab${activeTab === 'players' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('players')}
                role="tab"
                aria-selected={activeTab === 'players'}
              >
                Players ({players.length})
              </button>
            </div>
          </section>

          {activeTab === 'profile' ? (
            <section className="team-hub-section">
              <div className="team-hub-section-head">
                <div className="team-hub-section-head__lead">
                  <h2 className="team-hub-section__title">Team profile</h2>
                  <SectionHintTip ariaHelp="Venue, staff, history, and status. Use Edit team to change these fields.">
                    <span className="section-hint-tip__text">
                      Venue, staff, history, and status. Use{' '}
                      <strong>Edit team</strong> to change these fields.
                    </span>
                  </SectionHintTip>
                </div>
              </div>
              <DetailFields
                items={[
                  {
                    label: 'Captain',
                    value: team.captain ?? '—',
                  },
                  {
                    label: 'Coach',
                    value: (
                      <span className="table-cell-with-badge">
                        {team.coach_image_url ? (
                          <PlayerAvatar
                            profilePhotoUrl={team.coach_image_url}
                            alt=""
                            size="sm"
                          />
                        ) : null}
                        <span>{team.coach ?? '—'}</span>
                      </span>
                    ),
                  },
                  {
                    label: 'Manager',
                    value: (
                      <span className="table-cell-with-badge">
                        {team.manager_image_url ? (
                          <PlayerAvatar
                            profilePhotoUrl={team.manager_image_url}
                            alt=""
                            size="sm"
                          />
                        ) : null}
                        <span>{team.manager ?? '—'}</span>
                      </span>
                    ),
                  },
                  {
                    label: 'Home ground',
                    value: (team.home_ground_name ?? team.home_ground) ?? '—',
                  },
                  {
                    label: 'Ground location',
                    value: team.home_ground_location ?? '—',
                  },
                  {
                    label: 'Home ground image',
                    value:
                      team.home_ground_image_url != null &&
                      team.home_ground_image_url.trim() !== '' ? (
                        <span className="table-cell-with-badge">
                          <BadgeImage
                            imageUrl={team.home_ground_image_url}
                            alt=""
                            size="sm"
                          />
                          <a
                            href={team.home_ground_image_url}
                            target="_blank"
                            rel="noreferrer"
                            className="entity-detail-hero-row__link entity-detail-hero-row__link--ellipsis"
                          >
                            {team.home_ground_image_url}
                          </a>
                        </span>
                      ) : (
                        '—'
                      ),
                  },
                  {
                    label: 'History',
                    value:
                      team.history != null && team.history.trim() !== '' ? (
                        <span style={{ whiteSpace: 'pre-wrap' }}>{team.history}</span>
                      ) : (
                        '—'
                      ),
                  },
                  {
                    label: 'Trophies',
                    value:
                      (team.trophies ?? []).length > 0
                        ? team.trophies?.join(' • ')
                        : '—',
                  },
                  {
                    label: 'Team photos',
                    value:
                      (team.team_photo_urls ?? []).length > 0
                        ? `${team.team_photo_urls?.length ?? 0} URL(s)`
                        : '—',
                  },
                  {
                    label: 'Status',
                    value: (
                      <StatusBadge status={team.status as 'active' | 'inactive'} />
                    ),
                  },
                ]}
              />
            </section>
          ) : null}

          {activeTab === 'rosters' ? (
            <section className="team-hub-section">
            <div className="team-hub-section-head">
              <div className="team-hub-section-head__lead">
                <h2 className="team-hub-section__title">
                  Leagues & season rosters
                </h2>
                <SectionHintTip
                  ariaHelp="Teams enter a competition by being added to a season roster under a league. Open a season to edit the full roster, or add this team below."
                >
                  <span className="section-hint-tip__text">
                    Teams enter a competition by being added to a{' '}
                    <strong>season roster</strong> under a league. Open a season
                    to edit the full roster, or add this team below.
                  </span>
                </SectionHintTip>
              </div>
            </div>
            {seasonsWithRoster.length === 0 ? (
              <p className="muted">Not on any season roster yet.</p>
            ) : (
              <div className="table-wrap">
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>League</th>
                        <th>Season</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {rosterRows.map(({ season, league }) => (
                        <tr key={season.id}>
                          <td>
                            {league ? (
                              <Link
                                to="/leagues/$leagueId"
                                params={{ leagueId: String(league.id) }}
                              >
                                {league.name}
                              </Link>
                            ) : (
                              `League #${season.league_id}`
                            )}
                          </td>
                          <td>
                            <Link
                              to="/leagues/$leagueId/seasons/$seasonId"
                              params={{
                                leagueId: String(season.league_id),
                                seasonId: String(season.id),
                              }}
                            >
                              {season.name}
                            </Link>
                          </td>
                          <td>
                            <StatusBadge
                              status={
                                season.status as
                                  | 'upcoming'
                                  | 'active'
                                  | 'completed'
                                  | 'archived'
                              }
                            />
                          </td>
                          <td>
                            <Link
                              to="/leagues/$leagueId/seasons"
                              params={{ leagueId: String(season.league_id) }}
                              className="btn-ghost btn--with-icon"
                            >
                              <Layers size={18} strokeWidth={2} aria-hidden />
                              All seasons
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="team-hub-add-roster">
              <h3 className="team-hub-add-roster__title">Add team to a season</h3>
              {rosterError ? (
                <p className="login-error">{rosterError}</p>
              ) : null}
              <div className="team-hub-add-roster__row">
                <label className="team-hub-add-roster__field">
                  <span>League</span>
                  <select
                    className="inline-edit__control"
                    value={pickLeagueId === '' ? '' : String(pickLeagueId)}
                    onChange={(e) =>
                      {
                        setPickLeagueId(
                          e.target.value === '' ? '' : Number(e.target.value),
                        )
                        setPickSeasonId('')
                      }
                    }
                  >
                    <option value="">— Select league —</option>
                    {(leaguesQ.data ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="team-hub-add-roster__field">
                  <span>Season (without this team)</span>
                  <select
                    className="inline-edit__control"
                    value={pickSeasonId === '' ? '' : String(pickSeasonId)}
                    onChange={(e) =>
                      setPickSeasonId(
                        e.target.value === '' ? '' : Number(e.target.value),
                      )
                    }
                    disabled={seasonsAvailableToJoin.length === 0}
                  >
                    <option value="">
                      {pickLeagueId === ''
                        ? '— Pick a league first —'
                        : seasonsAvailableToJoin.length === 0
                          ? '— No open seasons in this league —'
                          : '— Select season —'}
                    </option>
                    {seasonsAvailableToJoin.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn-primary btn--with-icon"
                  disabled={
                    rosterBusy ||
                    pickSeasonId === '' ||
                    !Number.isFinite(Number(pickSeasonId))
                  }
                  onClick={() => void addTeamToSeasonRoster()}
                >
                  <UserPlus size={18} strokeWidth={2} aria-hidden />
                  {rosterBusy ? 'Saving…' : 'Add to roster'}
                </button>
              </div>
            </div>
            </section>
          ) : null}

          {activeTab === 'fixtures' ? (
            <section className="team-hub-section">
            <div className="team-hub-section-head">
              <div className="team-hub-section-head__lead">
                <h2 className="team-hub-section__title">Fixtures & results</h2>
                <SectionHintTip ariaHelp="Matches where this team is home or away (most recent first).">
                  <span className="section-hint-tip__text">
                    Matches where this team is home or away (most recent first).
                  </span>
                </SectionHintTip>
              </div>
            </div>
            {matches.length === 0 ? (
              <p className="muted">No fixtures yet.</p>
            ) : (
              <div className="table-wrap">
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Opponent</th>
                        <th>H/A</th>
                        <th>Venue</th>
                        <th>Status</th>
                        <th>Result</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {fixtureRows.map((m) => {
                        const home = m.home_team_id === tid
                        const oppId = home ? m.away_team_id : m.home_team_id
                        const oppName =
                          teamById.get(oppId)?.name ?? `#${oppId}`
                        const when =
                          m.match_date ??
                          (m.start_time
                            ? String(m.start_time).slice(0, 16).replace('T', ' ')
                            : '—')
                        let resultCell: ReactNode = '—'
                        if (m.status === 'completed' && m.result) {
                          const w = m.result.winning_team_id
                          const summary = matchResultSummaryLine(m)
                          let tag: ReactNode
                          if (w === tid) {
                            tag = (
                              <span className="team-hub-win">
                                <span aria-hidden title="Winner">
                                  🏆
                                </span>{' '}
                                W
                              </span>
                            )
                          } else if (w != null && w !== tid) {
                            tag = <span className="team-hub-loss">L</span>
                          } else {
                            tag = <span className="muted">NR / tie</span>
                          }
                          resultCell =
                            summary != null ? (
                              <span>
                                {tag}
                                <div
                                  className="muted"
                                  style={{ fontSize: '0.82rem' }}
                                >
                                  {summary}
                                </div>
                              </span>
                            ) : (
                              tag
                            )
                        }
                        return (
                          <tr key={m.id}>
                            <td>{when}</td>
                            <td>
                              <span className="table-cell-with-badge">
                                <BadgeImage
                                  imageUrl={teamById.get(oppId)?.logo_url}
                                  alt=""
                                  size="sm"
                                />
                                <span>{oppName}</span>
                              </span>
                            </td>
                            <td>{home ? 'Home' : 'Away'}</td>
                            <td>{m.venue ?? '—'}</td>
                            <td>
                              <StatusBadge
                                status={
                                  m.status as
                                    | 'scheduled'
                                    | 'live'
                                    | 'completed'
                                    | 'postponed'
                                    | 'abandoned'
                                    | 'cancelled'
                                }
                              />
                            </td>
                            <td>{resultCell}</td>
                            <td>
                              <Link
                                to="/matches/$matchId"
                                params={{ matchId: String(m.id) }}
                                className="btn-ghost btn--with-icon"
                              >
                                <ClipboardList
                                  size={18}
                                  strokeWidth={2}
                                  aria-hidden
                                />
                                Open
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
          ) : null}

          {activeTab === 'completed' ? (
            <section className="team-hub-section">
            <h2 className="team-hub-section__title">
              Completed results ({completedMatches.length})
            </h2>
            {completedMatches.length === 0 ? (
              <p className="muted">No completed matches yet.</p>
            ) : (
              <div className="table-wrap">
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Opponent</th>
                        <th>Outcome</th>
                        <th>Summary</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {completedRows.map((m) => {
                        const home = m.home_team_id === tid
                        const oppId = home ? m.away_team_id : m.home_team_id
                        const oppName =
                          teamById.get(oppId)?.name ?? `#${oppId}`
                        const when = m.match_date ?? '—'
                        const w = m.result?.winning_team_id
                        const outcome =
                          w === tid ? (
                            <span>
                              <span aria-hidden title="Winner">
                                🏆
                              </span>{' '}
                              Win
                            </span>
                          ) : w != null ? (
                            'Loss'
                          ) : (
                            'No result / tie'
                          )
                        const summaryLine = matchResultSummaryLine(m)
                        return (
                          <tr key={m.id}>
                            <td>{when}</td>
                            <td>
                              <Link
                                to="/teams/$teamId"
                                params={{ teamId: String(oppId) }}
                              >
                                {oppName}
                              </Link>
                            </td>
                            <td>{outcome}</td>
                            <td>{summaryLine ?? '—'}</td>
                            <td>
                              <Link
                                to="/matches/$matchId"
                                params={{ matchId: String(m.id) }}
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
          ) : null}

          {activeTab === 'players' ? (
            <section className="team-hub-section">
            <h2 className="team-hub-section__title">
              Players ({players.length})
            </h2>
            {players.length === 0 ? (
              <p className="muted">
                No players assigned to this squad.{' '}
                <Link to="/players/new" className="btn-ghost btn--with-icon">
                  <UserPlus size={18} strokeWidth={2} aria-hidden />
                  Create player
                </Link>
              </p>
            ) : (
              <div className="table-wrap">
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Role</th>
                        <th>#</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {playersSorted.map((p) => {
                        const isCaptain =
                          (team.captain_player_id != null &&
                            p.id === team.captain_player_id) ||
                          (team.captain_player_id == null &&
                            (team.captain ?? '').trim() === p.full_name)
                        return (
                        <tr key={p.id}>
                          <td>
                            <div
                              className={
                                isCaptain
                                  ? 'team-hub-player-cell team-hub-player-cell--captain'
                                  : 'team-hub-player-cell'
                              }
                            >
                              {isCaptain ? (
                                <span
                                  className="team-hub-player-ribbon"
                                  aria-label="Captain"
                                >
                                  Captain
                                </span>
                              ) : null}
                              <Link
                                to="/players/$playerId"
                                params={{ playerId: String(p.id) }}
                                className="team-hub-player-link table-cell-with-badge"
                              >
                                <PlayerAvatar
                                  profilePhotoUrl={p.profile_photo_url}
                                  alt=""
                                  size="sm"
                                />
                                <span>{p.full_name}</span>
                              </Link>
                            </div>
                          </td>
                          <td>{p.role ?? '—'}</td>
                          <td>{p.jersey_number ?? '—'}</td>
                          <td>
                            <StatusBadge
                              status={
                                p.status as 'active' | 'inactive' | 'injured'
                              }
                            />
                          </td>
                          <td>
                            <Link
                              to="/players/$playerId"
                              params={{ playerId: String(p.id) }}
                              className="btn-ghost btn--with-icon"
                            >
                              <Eye size={18} strokeWidth={2} aria-hidden />
                              View
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
          ) : null}
        </>
      )}
    </>
  )
}
