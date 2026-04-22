import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import type { PlayerDto, TeamDto } from '@/lib/api-types'
import { adminListAll } from '@/lib/admin-client'
import { BadgeImage } from '@/components/BadgeImage'
import { CatalogFilterGrid } from '@/components/CatalogFilterGrid'
import { EntityTable } from '@/components/EntityTable'
import { ListViewModeSwitch } from '@/components/ListViewModeSwitch'
import { PageHeader } from '@/components/PageHeader'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { StatusBadge } from '@/components/StatusBadge'
import { useListViewMode } from '@/hooks/useListViewMode'

export const Route = createFileRoute('/_shell/players/')({
  component: PlayersPage,
})

type PlayerRow = PlayerDto & {
  team_name: string
  team_logo_url: string | null
}

function PlayersPage() {
  const [mode, setMode] = useListViewMode('players')
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [teamsQ, playersQ] = useQueries({
    queries: [
      {
        queryKey: ['admin', 'teams'],
        queryFn: () => adminListAll<TeamDto>('/admin/teams'),
      },
      {
        queryKey: ['admin', 'players'],
        queryFn: () => adminListAll<PlayerDto>('/admin/players'),
      },
    ],
  })

  const rows = useMemo((): PlayerRow[] => {
    const teamById = new Map(
      (teamsQ.data ?? []).map((t) => [t.id, t] as const),
    )
    return (playersQ.data ?? []).map((p) => {
      const team = teamById.get(p.team_id)
      return {
        ...p,
        team_name: team?.name ?? `#${p.team_id}`,
        team_logo_url: team?.logo_url ?? null,
      }
    })
  }, [teamsQ.data, playersQ.data])
  const teamFilteredRows = useMemo(() => {
    if (selectedTeamId == null) return rows
    return rows.filter((r) => r.team_id === selectedTeamId)
  }, [rows, selectedTeamId])
  const queryFilteredRows = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()
    if (!needle) return teamFilteredRows
    return teamFilteredRows.filter((r) =>
      [
        r.full_name,
        r.team_name,
        r.category,
        r.role,
        String(r.jersey_number ?? ''),
        r.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [teamFilteredRows, searchQuery])
  const toolbarFilters = (
    <div className="catalog-filters-inline">
      <select
        className="inline-edit__control catalog-filter-select"
        value={selectedTeamId ?? ''}
        onChange={(e) =>
          setSelectedTeamId(e.target.value ? Number(e.target.value) : null)
        }
      >
        <option value="">All teams</option>
        {(teamsQ.data ?? []).map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  )

  const columns: ColumnDef<PlayerRow, unknown>[] = [
    {
      accessorKey: 'full_name',
      header: 'Player',
      cell: ({ row }) => (
        <span className="table-cell-with-badge">
          <PlayerAvatar
            profilePhotoUrl={row.original.profile_photo_url}
            alt=""
            size="sm"
          />
          <span>{row.original.full_name}</span>
        </span>
      ),
    },
    {
      accessorKey: 'team_name',
      header: 'Team',
      cell: ({ row }) => (
        <span className="table-cell-with-badge">
          <BadgeImage imageUrl={row.original.team_logo_url} alt="" size="sm" />
          <span>{row.original.team_name}</span>
        </span>
      ),
    },
    { accessorKey: 'category', header: 'Category' },
    { accessorKey: 'role', header: 'Role' },
    { accessorKey: 'jersey_number', header: '#' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => (
        <StatusBadge status={getValue() as 'active' | 'inactive' | 'injured'} />
      ),
    },
  ]

  const loading = teamsQ.isLoading || playersQ.isLoading
  const err = teamsQ.error ?? playersQ.error

  return (
    <>
      <PageHeader
        title="Players"
        descriptionAsTooltip
        description="GET /admin/players with team names from GET /admin/teams."
        actions={
          <Link to="/players/new" className="btn-primary btn--with-icon">
            <Plus size={18} strokeWidth={2} aria-hidden />
            New player
          </Link>
        }
      />
      {!loading && !err && mode === 'table' ? (
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
              placeholder="Search players…"
              aria-label="Filter results"
            />
            <div className="catalog-toolbar__extras">{toolbarFilters}</div>
          </div>
        </div>
      ) : null}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : err ? (
        <p className="login-error">{err.message}</p>
      ) : mode === 'cards' ? (
        <CatalogFilterGrid
          items={teamFilteredRows}
          getKey={(r) => r.id}
          getSearchText={(r) =>
            [
              r.full_name,
              r.team_name,
              r.category,
              r.role,
              String(r.jersey_number ?? ''),
              r.status,
            ]
              .filter(Boolean)
              .join(' ')
          }
          searchPlaceholder="Search players…"
          toolbarLeading={
            <ListViewModeSwitch value={mode} onChange={setMode} />
          }
          toolbarExtras={toolbarFilters}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          renderCard={(p) => (
            <Link
              to="/players/$playerId"
              params={{ playerId: String(p.id) }}
              className="entity-thumb-card entity-thumb-card--player"
            >
              <div className="entity-thumb-card__media entity-thumb-card__media--player">
                <PlayerAvatar
                  profilePhotoUrl={p.profile_photo_url}
                  alt=""
                  size="lg"
                />
              </div>
              <div className="entity-thumb-card__body">
                <h3 className="entity-thumb-card__title">{p.full_name}</h3>
                <p className="entity-thumb-card__meta muted">
                  <span className="table-cell-with-badge">
                    <BadgeImage imageUrl={p.team_logo_url} alt="" size="sm" />
                    <span>{p.team_name}</span>
                  </span>
                  <br />
                  {[p.role, p.category].filter(Boolean).join(' · ') || '—'}
                  {p.jersey_number != null ? ` · #${p.jersey_number}` : ''}
                </p>
              </div>
              <div className="entity-thumb-card__footer">
                <StatusBadge
                  status={p.status as 'active' | 'inactive' | 'injured'}
                />
              </div>
            </Link>
          )}
        />
      ) : (
        <EntityTable
          columns={columns}
          data={queryFilteredRows}
          hideToolbar
          onRowClick={(row) =>
            void navigate({
              to: '/players/$playerId',
              params: { playerId: String(row.id) },
            })
          }
        />
      )}
    </>
  )
}
