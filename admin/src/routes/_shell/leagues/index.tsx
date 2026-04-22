import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import type { LeagueDto } from '@/lib/api-types'
import { adminListAll } from '@/lib/admin-client'
import { BadgeImage } from '@/components/BadgeImage'
import { CatalogFilterGrid } from '@/components/CatalogFilterGrid'
import { EntityTable } from '@/components/EntityTable'
import { ListViewModeSwitch } from '@/components/ListViewModeSwitch'
import { PageHeader } from '@/components/PageHeader'
import { useListViewMode } from '@/hooks/useListViewMode'

export const Route = createFileRoute('/_shell/leagues/')({
  component: LeaguesPage,
})

const columns: ColumnDef<LeagueDto, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'League',
    cell: ({ row }) => (
      <span className="table-cell-with-badge">
        <BadgeImage imageUrl={row.original.logo_url} alt="" size="sm" />
        <span>{row.original.name}</span>
      </span>
    ),
  },
  { accessorKey: 'slug', header: 'Slug' },
  { accessorKey: 'category', header: 'Category' },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ getValue }) => {
      const v = getValue() as string | null
      if (!v) return '—'
      return v.length > 48 ? `${v.slice(0, 48)}…` : v
    },
  },
]

function LeaguesPage() {
  const [mode, setMode] = useListViewMode('leagues')
  const navigate = useNavigate()
  const q = useQuery({
    queryKey: ['admin', 'leagues'],
    queryFn: () => adminListAll<LeagueDto>('/admin/leagues'),
  })

  const data = q.data ?? []

  return (
    <>
      <PageHeader
        title="Leagues"
        descriptionAsTooltip
        description="Competitions (e.g. NPL Premier). Add seasons under each league — rosters and fixtures are per season."
        actions={
          <Link to="/leagues/new" className="btn-primary btn--with-icon">
            <Plus size={18} strokeWidth={2} aria-hidden />
            New league
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
            [r.name, r.slug, r.category, r.description].filter(Boolean).join(' ')
          }
          searchPlaceholder="Search leagues…"
          toolbarLeading={
            <ListViewModeSwitch value={mode} onChange={setMode} />
          }
          renderCard={(league) => (
            <Link
              to="/leagues/$leagueId"
              params={{ leagueId: String(league.id) }}
              className="entity-thumb-card entity-thumb-card--league"
            >
              <div className="entity-thumb-card__media entity-thumb-card__media--league">
                <BadgeImage imageUrl={league.logo_url} alt="" size="lg" />
              </div>
              <div className="entity-thumb-card__body">
                <h3 className="entity-thumb-card__title">{league.name}</h3>
                <p className="entity-thumb-card__meta muted">
                  {league.slug}
                  {league.category ? (
                    <>
                      <br />
                      {league.category}
                    </>
                  ) : null}
                </p>
              </div>
              <div className="entity-thumb-card__footer">
                <span className="entity-thumb-card__link-hint">
                  Open league hub
                </span>
              </div>
            </Link>
          )}
        />
      ) : (
        <EntityTable
          columns={columns}
          data={data}
          globalFilterPlaceholder="Search leagues…"
          onRowClick={(row) =>
            void navigate({
              to: '/leagues/$leagueId',
              params: { leagueId: String(row.id) },
            })
          }
        />
      )}
    </>
  )
}
