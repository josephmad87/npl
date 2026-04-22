import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import type { LeagueDto, SeasonDto } from '@/lib/api-types'
import { adminListAll } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { BadgeImage } from '@/components/BadgeImage'
import { CatalogFilterGrid } from '@/components/CatalogFilterGrid'
import { EntityTable } from '@/components/EntityTable'
import { ListViewModeSwitch } from '@/components/ListViewModeSwitch'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { useListViewMode } from '@/hooks/useListViewMode'

export const Route = createFileRoute('/_shell/leagues/$leagueId/seasons/')({
  component: SeasonsIndexPage,
})

type SeasonStatus = 'upcoming' | 'active' | 'completed' | 'archived'

const columns: ColumnDef<SeasonDto, unknown>[] = [
  { accessorKey: 'name', header: 'Season' },
  { accessorKey: 'slug', header: 'Slug' },
  { accessorKey: 'start_date', header: 'Start' },
  { accessorKey: 'end_date', header: 'End' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => (
      <StatusBadge status={getValue() as SeasonStatus} />
    ),
  },
  {
    id: 'teams',
    header: 'Teams',
    cell: ({ row }) => (row.original.team_ids?.length ?? 0),
  },
]

function SeasonsIndexPage() {
  const [mode, setMode] = useListViewMode('league-seasons')
  const { leagueId } = Route.useParams()
  const lid = Number(leagueId)
  const navigate = useNavigate()

  const leaguesQ = useQuery({
    queryKey: ['admin', 'leagues'],
    queryFn: () => adminListAll<LeagueDto>('/admin/leagues'),
  })
  const seasonsQ = useQuery({
    queryKey: ['admin', 'seasons', lid],
    queryFn: () =>
      adminListAll<SeasonDto>(`/admin/seasons?league_id=${lid}`),
    enabled: Number.isFinite(lid),
  })

  const league = leaguesQ.data?.find((l) => l.id === lid)
  const loading = leaguesQ.isLoading || seasonsQ.isLoading
  const err = leaguesQ.error ?? seasonsQ.error
  const seasons = seasonsQ.data ?? []

  if (!Number.isFinite(lid)) {
    return <p className="login-error">Invalid league.</p>
  }

  return (
    <>
      <PageHeader
        title={league ? `Seasons — ${league.name}` : 'Seasons'}
        descriptionAsTooltip
        description="GET /admin/seasons?league_id=… — roster and fixtures are scoped to each season."
        media={
          league ? (
            <BadgeImage
              imageUrl={league.logo_url}
              alt={`${league.name} logo`}
              size="lg"
            />
          ) : undefined
        }
        actions={
          <BackNavLink
            to="/leagues/$leagueId"
            params={{ leagueId: String(lid) }}
          >
            League
          </BackNavLink>
        }
      />
      {!loading && !err && league ? (
        <div
          className={
            mode === 'cards'
              ? 'catalog-page-toolbar'
              : 'catalog-page-toolbar catalog-page-toolbar--split'
          }
        >
          {mode !== 'cards' ? (
            <ListViewModeSwitch value={mode} onChange={setMode} />
          ) : null}
          <Link
            to="/leagues/$leagueId/seasons/new"
            params={{ leagueId: String(lid) }}
            className="btn-primary btn--with-icon"
          >
            <Plus size={18} strokeWidth={2} aria-hidden />
            Add season
          </Link>
        </div>
      ) : null}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : err ? (
        <p className="login-error">{err.message}</p>
      ) : !league ? (
        <p className="login-error">League not found.</p>
      ) : mode === 'cards' ? (
        <CatalogFilterGrid
          items={seasons}
          getKey={(s) => s.id}
          getSearchText={(s) =>
            [
              s.name,
              s.slug,
              s.start_date,
              s.end_date,
              s.status,
              String(s.team_ids?.length ?? 0),
            ]
              .filter(Boolean)
              .join(' ')
          }
          searchPlaceholder="Search seasons…"
          toolbarLeading={
            <ListViewModeSwitch value={mode} onChange={setMode} />
          }
          renderCard={(s) => (
            <Link
              to="/leagues/$leagueId/seasons/$seasonId"
              params={{ leagueId: String(lid), seasonId: String(s.id) }}
              className="entity-thumb-card"
            >
              <div className="entity-thumb-card__media">
                <BadgeImage imageUrl={league.logo_url} alt="" size="lg" />
              </div>
              <div className="entity-thumb-card__body">
                <h3 className="entity-thumb-card__title">{s.name}</h3>
                <p className="entity-thumb-card__meta muted">
                  {s.slug}
                  <br />
                  {[s.start_date, s.end_date].filter(Boolean).join(' → ') || '—'}
                  <br />
                  {s.team_ids?.length ?? 0} team
                  {(s.team_ids?.length ?? 0) === 1 ? '' : 's'} on roster
                </p>
              </div>
              <div className="entity-thumb-card__footer">
                <StatusBadge status={s.status as SeasonStatus} />
              </div>
            </Link>
          )}
        />
      ) : (
        <EntityTable
          columns={columns}
          data={seasons}
          globalFilterPlaceholder="Search seasons…"
          onRowClick={(row) =>
            void navigate({
              to: '/leagues/$leagueId/seasons/$seasonId',
              params: { leagueId: String(lid), seasonId: String(row.id) },
            })
          }
        />
      )}
    </>
  )
}
