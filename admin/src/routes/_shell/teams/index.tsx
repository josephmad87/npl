import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import type { LeagueDto, SeasonDto, TeamDto } from '@/lib/api-types'
import { adminListAll, adminPost } from '@/lib/admin-client'
import { BadgeImage } from '@/components/BadgeImage'
import { EntityTable } from '@/components/EntityTable'
import { ListViewModeSwitch } from '@/components/ListViewModeSwitch'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { useListViewMode } from '@/hooks/useListViewMode'

export const Route = createFileRoute('/_shell/teams/')({
  component: TeamsPage,
})

type TeamCategoryGroup = 'mens' | 'women' | 'youth'
type TeamStatusGroup = 'active' | 'inactive' | 'archived'

const CATEGORY_GROUPS: { key: TeamCategoryGroup; label: string }[] = [
  { key: 'mens', label: 'Mens' },
  { key: 'women', label: 'Women' },
  { key: 'youth', label: 'Youth' },
]

const STATUS_GROUPS: { key: TeamStatusGroup; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'archived', label: 'Archived' },
]

function teamCategoryGroup(category: string | null | undefined): TeamCategoryGroup {
  const value = String(category ?? '').trim().toLowerCase()

  if (
    value === 'women' ||
    value === 'womens' ||
    value === 'woman' ||
    value === 'ladies' ||
    value === 'lady'
  ) {
    return 'women'
  }

  if (
    value === 'youth' ||
    value === 'youths' ||
    value === 'junior' ||
    value === 'juniors' ||
    value === 'u19' ||
    value === 'under-19' ||
    value === 'under 19'
  ) {
    return 'youth'
  }

  return 'mens'
}

function teamStatusGroup(status: string | null | undefined): TeamStatusGroup {
  const value = String(status ?? '').trim().toLowerCase()

  if (value === 'archived' || value === 'archive') return 'archived'
  if (value === 'active') return 'active'

  return 'inactive'
}

function teamSearchText(team: TeamDto): string {
  return [team.name, team.short_name, team.category, team.home_ground, team.status]
    .filter(Boolean)
    .join(' ')
}

function TeamStatusBadge({ status }: { status: string | null | undefined }) {
  const group = teamStatusGroup(status)

  if (group === 'archived') {
    return (
      <span className="team-tab-catalog__status-pill team-tab-catalog__status-pill--archived">
        Archived
      </span>
    )
  }

  return <StatusBadge status={group as 'active' | 'inactive'} />
}

function TeamCard({ team }: { team: TeamDto }) {
  return (
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
          {[team.short_name, team.category].filter(Boolean).join(' · ') || '—'}
          <br />
          {team.home_ground ?? '—'}
        </p>
      </div>
      <div className="entity-thumb-card__footer">
        <TeamStatusBadge status={team.status} />
      </div>
    </Link>
  )
}

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
    cell: ({ row }) => <TeamStatusBadge status={row.original.status} />,
  },
]

function TeamsPage() {
  const [mode, setMode] = useListViewMode('teams')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [activeCategory, setActiveCategory] = useState<TeamCategoryGroup>('mens')
  const [activeStatus, setActiveStatus] = useState<TeamStatusGroup>('active')

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

    for (const season of seasonsQ.data ?? []) {
      for (const teamId of season.team_ids ?? []) {
        const bucket = map.get(teamId) ?? new Set<number>()
        bucket.add(season.league_id)
        map.set(teamId, bucket)
      }
    }

    return map
  }, [seasonsQ.data])

  const leagueFilteredData = useMemo(() => {
    const source = teamsQ.data ?? []

    if (selectedLeagueId == null) return source

    return source.filter((team) => teamLeagueIds.get(team.id)?.has(selectedLeagueId))
  }, [selectedLeagueId, teamLeagueIds, teamsQ.data])

  const queryFilteredData = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()

    if (!needle) return leagueFilteredData

    return leagueFilteredData.filter((team) =>
      teamSearchText(team).toLowerCase().includes(needle),
    )
  }, [leagueFilteredData, searchQuery])

  const categoryCounts = useMemo(
    () =>
      CATEGORY_GROUPS.reduce<Record<TeamCategoryGroup, number>>(
        (acc, category) => {
          acc[category.key] = queryFilteredData.filter(
            (team) => teamCategoryGroup(team.category) === category.key,
          ).length
          return acc
        },
        { mens: 0, women: 0, youth: 0 },
      ),
    [queryFilteredData],
  )

  const categoryFilteredData = useMemo(
    () =>
      queryFilteredData.filter(
        (team) => teamCategoryGroup(team.category) === activeCategory,
      ),
    [activeCategory, queryFilteredData],
  )

  const statusCounts = useMemo(
    () =>
      STATUS_GROUPS.reduce<Record<TeamStatusGroup, number>>(
        (acc, status) => {
          acc[status.key] = categoryFilteredData.filter(
            (team) => teamStatusGroup(team.status) === status.key,
          ).length
          return acc
        },
        { active: 0, inactive: 0, archived: 0 },
      ),
    [categoryFilteredData],
  )

  const tabFilteredData = useMemo(
    () =>
      categoryFilteredData
        .filter((team) => teamStatusGroup(team.status) === activeStatus)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [activeStatus, categoryFilteredData],
  )

  const selectedTeamIds = useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([, selected]) => selected)
        .map(([id]) => Number(id))
        .filter((id) => Number.isFinite(id)),
    [rowSelection],
  )

  const toolbarFilters = (
    <div className="catalog-filters-inline">
      <select
        className="inline-edit__control catalog-filter-select"
        value={selectedLeagueId ?? ''}
        onChange={(event) =>
          setSelectedLeagueId(event.target.value ? Number(event.target.value) : null)
        }
      >
        <option value="">All leagues</option>
        {(leaguesQ.data ?? []).map((league) => (
          <option key={league.id} value={league.id}>
            {league.name}
          </option>
        ))}
      </select>
    </div>
  )

  const renderToolbar = (
    <div className="catalog-browse">
      <div className="catalog-toolbar">
        <div className="catalog-toolbar__leading">
          <ListViewModeSwitch value={mode} onChange={setMode} />
        </div>
        <input
          type="search"
          className="catalog-toolbar__search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search teams…"
          aria-label="Filter results"
        />
        <div className="catalog-toolbar__extras">{toolbarFilters}</div>
      </div>
    </div>
  )

  const renderTabs = (
    <div className="team-tab-catalog">
      <div className="team-tab-catalog__tabs" aria-label="Team categories">
        {CATEGORY_GROUPS.map((category) => (
          <button
            key={category.key}
            type="button"
            className={activeCategory === category.key ? 'is-active' : ''}
            onClick={() => {
              setActiveCategory(category.key)
              setRowSelection({})
            }}
          >
            {category.label} <span>({categoryCounts[category.key]})</span>
          </button>
        ))}
      </div>

      <div className="team-tab-catalog__tabs" aria-label="Team statuses">
        {STATUS_GROUPS.map((status) => (
          <button
            key={status.key}
            type="button"
            className={activeStatus === status.key ? 'is-active' : ''}
            onClick={() => {
              setActiveStatus(status.key)
              setRowSelection({})
            }}
          >
            {status.label} <span>({statusCounts[status.key]})</span>
          </button>
        ))}
      </div>
    </div>
  )

  const bulkArchive = async () => {
    if (selectedTeamIds.length === 0) return

    const names = tabFilteredData
      .filter((team) => selectedTeamIds.includes(team.id))
      .map((team) => team.name)
      .join(', ')

    if (
      !confirm(
        `Archive ${selectedTeamIds.length} team(s)? They will be hidden from the public site.\n\n${names}`,
      )
    ) {
      return
    }

    try {
      await adminPost('/admin/teams/bulk-archive', { team_ids: selectedTeamIds })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'teams'] })
      setRowSelection({})
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Bulk archive failed')
    }
  }

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

      {teamsQ.isLoading || seasonsQ.isLoading || leaguesQ.isLoading ? (
        <p className="muted">Loading…</p>
      ) : teamsQ.isError || seasonsQ.isError || leaguesQ.isError ? (
        <p className="login-error">
          {(teamsQ.error ?? seasonsQ.error ?? leaguesQ.error)?.message}
        </p>
      ) : mode === 'cards' ? (
        <>
          {renderToolbar}
          {renderTabs}

          {tabFilteredData.length === 0 ? (
            <p className="team-tab-catalog__empty muted">
              No teams match this category and status.
            </p>
          ) : (
            <div className="team-tab-catalog__cards">
              {tabFilteredData.map((team) => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {renderToolbar}
          {renderTabs}

          <EntityTable
            columns={columns}
            data={tabFilteredData}
            hideToolbar
            enableRowSelection
            getRowId={(row) => String(row.id)}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            bulkActions={
              <button
                type="button"
                className="btn-ghost"
                onClick={() => void bulkArchive()}
              >
                Archive selected
              </button>
            }
            onRowClick={(row) =>
              void navigate({
                to: '/teams/$teamId',
                params: { teamId: String(row.id) },
              })
            }
          />
        </>
      )}
    </>
  )
}
