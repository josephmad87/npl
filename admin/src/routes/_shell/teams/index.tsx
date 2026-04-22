import { useQueries } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import type { LeagueDto, SeasonDto, TeamDto } from '@/lib/api-types'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null)
  const [teamsQ, seasonsQ, leaguesQ] = useQueries({
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
    ],
  })

  const teamLeagueIds = useMemo(() => {
    const map = new Map<number, Set<number>>()
    for (const s of seasonsQ.data ?? []) {
      for (const tid of s.team_ids ?? []) {
        const bucket = map.get(tid) ?? new Set<number>()
        bucket.add(s.league_id)
        map.set(tid, bucket)
      }
    }
    return map
  }, [seasonsQ.data])
  const leagueFilteredData = useMemo(() => {
    const source = teamsQ.data ?? []
    if (selectedLeagueId == null) return source
    return source.filter((t) => teamLeagueIds.get(t.id)?.has(selectedLeagueId))
  }, [teamsQ.data, selectedLeagueId, teamLeagueIds])
  const queryFilteredData = useMemo(() => {
    const source = leagueFilteredData
    const needle = searchQuery.trim().toLowerCase()
    if (!needle) return source
    return source.filter((r) =>
      [r.name, r.short_name, r.category, r.home_ground, r.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [leagueFilteredData, searchQuery])
  const toolbarFilters = (
    <div className="catalog-filters-inline">
      <select
        className="inline-edit__control catalog-filter-select"
        value={selectedLeagueId ?? ''}
        onChange={(e) =>
          setSelectedLeagueId(e.target.value ? Number(e.target.value) : null)
        }
      >
        <option value="">All leagues</option>
        {(leaguesQ.data ?? []).map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </div>
  )

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
      {!teamsQ.isLoading &&
      !seasonsQ.isLoading &&
      !leaguesQ.isLoading &&
      !teamsQ.isError &&
      !seasonsQ.isError &&
      !leaguesQ.isError &&
      mode === 'table' ? (
        <div className="catalog-browse">
          <div className="catalog-toolbar">
            <div className="catalog-toolbar__leading">
              <ListViewModeSwitch value={mode} onChange={setMode} />
            </div>
            <input
              type="search"
              className="catalog-toolbar__search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search teams…"
              aria-label="Filter results"
            />
            <div className="catalog-toolbar__extras">{toolbarFilters}</div>
          </div>
        </div>
      ) : null}
      {teamsQ.isLoading || seasonsQ.isLoading || leaguesQ.isLoading ? (
        <p className="muted">Loading…</p>
      ) : teamsQ.isError || seasonsQ.isError || leaguesQ.isError ? (
        <p className="login-error">
          {(teamsQ.error ?? seasonsQ.error ?? leaguesQ.error)?.message}
        </p>
      ) : mode === 'cards' ? (
        <CatalogFilterGrid
          items={leagueFilteredData}
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
          toolbarExtras={toolbarFilters}
          query={searchQuery}
          onQueryChange={setSearchQuery}
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
          data={queryFilteredData}
          hideToolbar
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
