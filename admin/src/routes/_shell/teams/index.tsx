import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import type { TeamDto } from '@/lib/api-types'
import { adminListAll } from '@/lib/admin-client'
import { BadgeImage } from '@/components/BadgeImage'
import { CatalogFilterGrid } from '@/components/CatalogFilterGrid'
import { EntityTable } from '@/components/EntityTable'
import { ListViewModeSwitch } from '@/components/ListViewModeSwitch'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { useListViewMode } from '@/hooks/useListViewMode'

export const Route = createFileRoute('/_shell/teams/')({
  component: TeamsPage,
})

const columns: ColumnDef<TeamDto, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Team',
    cell: ({ row }) => (
      <span className="table-cell-with-badge">
        <BadgeImage imageUrl={row.original.logo_url} alt="" size="sm" />
        <span>{row.original.name}</span>
      </span>
    ),
  },
  { accessorKey: 'short_name', header: 'Short' },
  { accessorKey: 'category', header: 'Category' },
  { accessorKey: 'home_ground', header: 'Home ground' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => {
      const v = getValue() as string
      return <StatusBadge status={v as 'active' | 'inactive'} />
    },
  },
]

function TeamsPage() {
  const [mode, setMode] = useListViewMode('teams')
  const navigate = useNavigate()
  const q = useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: () => adminListAll<TeamDto>('/admin/teams'),
  })

  const data = q.data ?? []

  return (
    <>
      <PageHeader
        title="Teams"
        descriptionAsTooltip
        description="Data from GET /admin/teams (SRS §4.2)."
        actions={
          <Link to="/teams/new" className="btn-primary btn--with-icon">
            <Plus size={18} strokeWidth={2} aria-hidden />
            New team
          </Link>
        }
      />
      {!q.isLoading && !q.isError && mode !== 'cards' ? (
        <div className="catalog-page-toolbar">
          <ListViewModeSwitch value={mode} onChange={setMode} />
        </div>
      ) : null}
      {q.isLoading ? (
        <p className="muted">Loading…</p>
      ) : q.isError ? (
        <p className="login-error">{q.error.message}</p>
      ) : mode === 'cards' ? (
        <CatalogFilterGrid
          items={data}
          getKey={(r) => r.id}
          getSearchText={(r) =>
            [r.name, r.short_name, r.category, r.home_ground, r.status]
              .filter(Boolean)
              .join(' ')
          }
          searchPlaceholder="Search teams…"
          toolbarLeading={
            <ListViewModeSwitch value={mode} onChange={setMode} />
          }
          renderCard={(team) => (
            <Link
              to="/teams/$teamId"
              params={{ teamId: String(team.id) }}
              className="entity-thumb-card entity-thumb-card--team"
            >
              <div className="entity-thumb-card__media entity-thumb-card__media--team">
                <BadgeImage imageUrl={team.logo_url} alt="" size="lg" />
              </div>
              <div className="entity-thumb-card__body">
                <h3 className="entity-thumb-card__title">{team.name}</h3>
                <p className="entity-thumb-card__meta muted">
                  {[team.short_name, team.category].filter(Boolean).join(' · ') ||
                    '—'}
                  <br />
                  {team.home_ground ?? '—'}
                </p>
              </div>
              <div className="entity-thumb-card__footer">
                <StatusBadge status={team.status as 'active' | 'inactive'} />
              </div>
            </Link>
          )}
        />
      ) : (
        <EntityTable
          columns={columns}
          data={data}
          globalFilterPlaceholder="Search teams…"
          onRowClick={(row) =>
            void navigate({
              to: '/teams/$teamId',
              params: { teamId: String(row.id) },
            })
          }
        />
      )}
    </>
  )
}
