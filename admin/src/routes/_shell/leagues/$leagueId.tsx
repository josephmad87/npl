import { useQueries, useQueryClient } from '@tanstack/react-query'
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { CalendarDays, Plus, SquarePen } from 'lucide-react'
import { useState } from 'react'
import type { LeagueDto, SeasonDto } from '@/lib/api-types'
import { adminListAll, adminPatch } from '@/lib/admin-client'
import { BadgeImage, resolveBadgeSrc } from '@/components/BadgeImage'
import { BackNavLink } from '@/components/BackNavLink'
import { EntityTable } from '@/components/EntityTable'
import { InlineEditForm } from '@/components/InlineEditForm'
import { MediaUrlField } from '@/components/MediaUrlField'
import { PageHeader } from '@/components/PageHeader'
import { SectionHintTip } from '@/components/SectionHintTip'
import { StatusBadge } from '@/components/StatusBadge'
import { parseDetailRouteSearch } from '@/lib/detail-route-search'

export const Route = createFileRoute('/_shell/leagues/$leagueId')({
  validateSearch: parseDetailRouteSearch,
  component: LeagueDetailPage,
})

const SEASON_STATUSES = ['upcoming', 'active', 'completed', 'archived'] as const

const seasonColumns: ColumnDef<SeasonDto, unknown>[] = [
  { accessorKey: 'name', header: 'Season' },
  { accessorKey: 'slug', header: 'Slug' },
  { accessorKey: 'start_date', header: 'Start' },
  { accessorKey: 'end_date', header: 'End' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => (
      <StatusBadge
        status={getValue() as (typeof SEASON_STATUSES)[number]}
      />
    ),
  },
  {
    id: 'teams',
    header: 'Teams',
    cell: ({ row }) => row.original.team_ids?.length ?? 0,
  },
]

function LeagueDetailPage() {
  const { leagueId } = Route.useParams()
  const lid = Number(leagueId)
  const { mode } = Route.useSearch()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  /** Child file routes live under `leagues/$leagueId/seasons/*` and require an outlet on the parent. */
  const isSeasonsBranch = /\/leagues\/[^/]+\/seasons(?:\/|$)/.test(
    pathname,
  )
  const queryClient = useQueryClient()
  const [listQ, seasonsQ] = useQueries({
    queries: [
      {
        queryKey: ['admin', 'leagues'],
        queryFn: () => adminListAll<LeagueDto>('/admin/leagues'),
      },
      {
        queryKey: ['admin', 'seasons', lid],
        queryFn: () =>
          adminListAll<SeasonDto>(`/admin/seasons?league_id=${lid}`),
        enabled: Number.isFinite(lid) && !isSeasonsBranch,
      },
    ],
  })
  const league = listQ.data?.find((l) => l.id === lid)
  const isEditing = mode === 'edit'
  const [patch, setPatch] = useState<Partial<LeagueDto>>({})
  const [saveError, setSaveError] = useState<string | null>(null)

  const merged: LeagueDto | null =
    league ? { ...league, ...patch } : null

  const goView = () => {
    if (!league) return
    setPatch({})
    setSaveError(null)
    void navigate({
      to: '/leagues/$leagueId',
      params: { leagueId: String(league.id) },
      search: {},
    })
  }

  const beginEdit = () => {
    if (!league) return
    setPatch({})
    setSaveError(null)
    void navigate({
      to: '/leagues/$leagueId',
      params: { leagueId: String(league.id) },
      search: { mode: 'edit' },
    })
  }

  const save = async () => {
    if (!merged || !league) return
    const name = merged.name.trim()
    if (!name) {
      setSaveError('Name is required.')
      return
    }
    try {
      await adminPatch<LeagueDto>(`/admin/leagues/${lid}`, {
        name: merged.name,
        slug: merged.slug,
        category: merged.category,
        description: merged.description,
        logo_url: merged.logo_url,
        banner_url: merged.banner_url,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'leagues'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'seasons'] })
      goView()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  if (!Number.isFinite(lid)) {
    return <p className="login-error">Invalid league.</p>
  }

  if (isSeasonsBranch) {
    return <Outlet />
  }

  if (listQ.isLoading || seasonsQ.isLoading) {
    return <p className="muted">Loading…</p>
  }
  if (listQ.isError) {
    return <p className="login-error">{listQ.error.message}</p>
  }
  if (!league || !merged) {
    return (
      <>
        <PageHeader title="League not found" />
        <BackNavLink to="/leagues">Back to leagues</BackNavLink>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={isEditing ? merged.name : league.name}
        description={`Slug: ${(isEditing ? merged.slug : league.slug) ?? ''} · ID ${league.id}`}
        descriptionAsTooltip={!isEditing}
        media={
          isEditing ? (
            <BadgeImage
              imageUrl={merged.logo_url}
              alt={`${league.name} logo`}
              size="lg"
            />
          ) : undefined
        }
        actions={
          <>
            <BackNavLink to="/leagues">Leagues</BackNavLink>
            <Link
              to="/leagues/$leagueId/seasons"
              params={{ leagueId: String(league.id) }}
              className="btn-ghost btn--with-icon"
            >
              <CalendarDays size={18} strokeWidth={2} aria-hidden />
              Seasons page
            </Link>
            {!isEditing ? (
              <button
                type="button"
                className="btn-primary btn--with-icon"
                onClick={beginEdit}
              >
                <SquarePen size={18} strokeWidth={2} aria-hidden />
                Edit league
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
              id: 'description',
              label: 'Description',
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
              id: 'logo_url',
              label: 'Logo (image)',
              control: (
                <MediaUrlField
                  id="logo_url"
                  uploadKind="leagues"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  value={merged.logo_url}
                  onChange={(next) =>
                    setPatch((p) => ({ ...p, logo_url: next }))
                  }
                />
              ),
            },
            {
              id: 'banner_url',
              label: 'Banner (image)',
              control: (
                <MediaUrlField
                  id="banner_url"
                  uploadKind="leagues"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  value={merged.banner_url}
                  onChange={(next) =>
                    setPatch((p) => ({ ...p, banner_url: next }))
                  }
                />
              ),
            },
          ]}
        />
      ) : (
        <>
          <article
            className="entity-detail-hero"
            aria-label={`${league.name} profile summary`}
          >
            <div className="entity-detail-hero__media entity-detail-hero__media--badge">
              <img
                src={resolveBadgeSrc(league.logo_url)}
                alt=""
                loading="eager"
                decoding="async"
              />
            </div>
            <div className="entity-detail-hero__body">
              <div className="entity-detail-hero-row">
                <span className="entity-detail-hero-row__label">Slug</span>
                <span className="entity-detail-hero-row__value">
                  {league.slug}
                </span>
              </div>
              <div className="entity-detail-hero-row">
                <span className="entity-detail-hero-row__label">Category</span>
                <span className="entity-detail-hero-row__value">
                  {league.category}
                </span>
              </div>
              <div className="entity-detail-hero-row">
                <span className="entity-detail-hero-row__label">Description</span>
                <div className="entity-detail-hero-row__value entity-detail-hero-row__value--inline">
                  {league.description ? (
                    league.description.length > 110 ? (
                      <>
                        <span className="muted">
                          {`${league.description.slice(0, 107)}…`}
                        </span>
                        <SectionHintTip ariaHelp={league.description}>
                          <span className="section-hint-tip__text">
                            {league.description}
                          </span>
                        </SectionHintTip>
                      </>
                    ) : (
                      <span>{league.description}</span>
                    )
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>
              </div>
              <div className="entity-detail-hero-row">
                <span className="entity-detail-hero-row__label">Logo</span>
                <div className="entity-detail-hero-row__value entity-detail-hero-row__value--inline">
                  {league.logo_url ? (
                    <>
                      <a
                        href={league.logo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="entity-detail-hero-row__link entity-detail-hero-row__link--ellipsis"
                        title={league.logo_url}
                      >
                        {league.logo_url}
                      </a>
                      <SectionHintTip ariaHelp={league.logo_url}>
                        <span className="section-hint-tip__text">
                          <code>{league.logo_url}</code>
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
                <span className="entity-detail-hero-row__label">Banner</span>
                <div className="entity-detail-hero-row__value entity-detail-hero-row__value--inline">
                  {league.banner_url ? (
                    <>
                      <a
                        href={league.banner_url}
                        target="_blank"
                        rel="noreferrer"
                        className="entity-detail-hero-row__link entity-detail-hero-row__link--ellipsis"
                        title={league.banner_url}
                      >
                        {league.banner_url}
                      </a>
                      <SectionHintTip ariaHelp={league.banner_url}>
                        <span className="section-hint-tip__text">
                          <code>{league.banner_url}</code>
                        </span>
                      </SectionHintTip>
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>
              </div>
            </div>
          </article>

          <section className="team-hub-section">
            <div className="team-hub-section-head">
              <div className="team-hub-section-head__lead">
                <h2 className="team-hub-section__title">Seasons</h2>
                <SectionHintTip
                  ariaHelp="Rosters and fixtures are scoped per season. Click a row to open season detail."
                >
                  <span className="section-hint-tip__text">
                    Rosters and fixtures are scoped per season. Click a row to
                    open season detail.
                  </span>
                </SectionHintTip>
              </div>
              <Link
                to="/leagues/$leagueId/seasons/new"
                params={{ leagueId: String(league.id) }}
                className="btn-primary btn--with-icon"
              >
                <Plus size={18} strokeWidth={2} aria-hidden />
                Add season
              </Link>
            </div>
            {seasonsQ.isError ? (
              <p className="login-error">{seasonsQ.error.message}</p>
            ) : (
              <EntityTable
                columns={seasonColumns}
                data={seasonsQ.data ?? []}
                globalFilterPlaceholder="Search seasons…"
                onRowClick={(row) =>
                  void navigate({
                    to: '/leagues/$leagueId/seasons/$seasonId',
                    params: {
                      leagueId: String(lid),
                      seasonId: String(row.id),
                    },
                  })
                }
              />
            )}
          </section>
        </>
      )}
    </>
  )
}
