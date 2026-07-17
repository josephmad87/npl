import { useMemo, useState } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import type { PlayerDto, TeamDto } from '@/lib/api-types'
import { adminListAll, adminPost } from '@/lib/admin-client'
import { BadgeImage } from '@/components/BadgeImage'
import { EntityTable } from '@/components/EntityTable'
import { ListViewModeSwitch } from '@/components/ListViewModeSwitch'
import { PageHeader } from '@/components/PageHeader'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { StatusBadge } from '@/components/StatusBadge'
import { useListViewMode } from '@/hooks/useListViewMode'

export const Route = createFileRoute('/_shell/players/')({
  component: PlayersPage,
})

type PlayerCategoryGroup = 'mens' | 'women' | 'youth'
type PlayerStatusGroup = 'active' | 'inactive'

type PlayerRow = PlayerDto & {
  team_name: string
  team_logo_url: string | null
  team_category: string | null
  team_status: string | null
}

const CATEGORY_GROUPS: { key: PlayerCategoryGroup; label: string }[] = [
  { key: 'mens', label: 'Mens' },
  { key: 'women', label: 'Women' },
  { key: 'youth', label: 'Youth' },
]

const STATUS_GROUPS: { key: PlayerStatusGroup; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
]

function playerCategoryGroup(
  category: string | null | undefined,
): PlayerCategoryGroup {
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

function playerStatusGroup(status: string | null | undefined): PlayerStatusGroup {
  const value = String(status ?? '').trim().toLowerCase()

  return value === 'active' ? 'active' : 'inactive'
}

function playerSearchText(player: PlayerRow): string {
  return [
    player.full_name,
    player.team_name,
    player.team_category,
    player.category,
    player.role,
    String(player.jersey_number ?? ''),
    player.status,
  ]
    .filter(Boolean)
    .join(' ')
}

function PlayerCard({ player }: { player: PlayerRow }) {
  return (
    <Link
      to="/players/$playerId"
      params={{ playerId: String(player.id) }}
      className="entity-thumb-card entity-thumb-card--player"
    >
      <div className="entity-thumb-card__media entity-thumb-card__media--player">
        <PlayerAvatar
          profilePhotoUrl={player.profile_photo_url}
          alt=""
          size="lg"
        />
      </div>
      <div className="entity-thumb-card__body">
        <h3 className="entity-thumb-card__title">{player.full_name}</h3>
        <p className="entity-thumb-card__meta muted">
          <span className="table-cell-with-badge">
            <BadgeImage imageUrl={player.team_logo_url} alt="" size="sm" />
            <span>{player.team_name}</span>
          </span>
          <br />
          {[player.role, player.category].filter(Boolean).join(' · ') || '—'}
          {player.jersey_number != null ? ` · #${player.jersey_number}` : ''}
        </p>
      </div>
      <div className="entity-thumb-card__footer">
        <StatusBadge
          status={player.status as 'active' | 'inactive' | 'injured'}
        />
      </div>
    </Link>
  )
}

function PlayersPage() {
  const [mode, setMode] = useListViewMode('players')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [activeCategory, setActiveCategory] =
    useState<PlayerCategoryGroup>('mens')
  const [activeStatus, setActiveStatus] = useState<PlayerStatusGroup>('active')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

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
      (teamsQ.data ?? []).map((team) => [team.id, team] as const),
    )

    return (playersQ.data ?? []).map((player) => {
      const team = teamById.get(player.team_id)

      return {
        ...player,
        team_name: team?.name ?? `#${player.team_id}`,
        team_logo_url: team?.logo_url ?? null,
        team_category: team?.category ?? player.category ?? null,
        team_status: team?.status ?? null,
      }
    })
  }, [playersQ.data, teamsQ.data])

  const queryFilteredRows = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()

    if (!needle) return rows

    return rows.filter((player) =>
      playerSearchText(player).toLowerCase().includes(needle),
    )
  }, [rows, searchQuery])

  const categoryCounts = useMemo(
    () =>
      CATEGORY_GROUPS.reduce<Record<PlayerCategoryGroup, number>>(
        (acc, category) => {
          acc[category.key] = queryFilteredRows.filter(
            (player) =>
              playerCategoryGroup(player.team_category ?? player.category) ===
              category.key,
          ).length
          return acc
        },
        { mens: 0, women: 0, youth: 0 },
      ),
    [queryFilteredRows],
  )

  const categoryFilteredRows = useMemo(
    () =>
      queryFilteredRows.filter(
        (player) =>
          playerCategoryGroup(player.team_category ?? player.category) ===
          activeCategory,
      ),
    [activeCategory, queryFilteredRows],
  )

  const categoryTeams = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>()

    for (const player of categoryFilteredRows) {
      map.set(player.team_id, {
        id: player.team_id,
        name: player.team_name,
      })
    }

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [categoryFilteredRows])

  const teamFilteredRows = useMemo(() => {
    if (selectedTeamId == null) return categoryFilteredRows

    return categoryFilteredRows.filter((player) => player.team_id === selectedTeamId)
  }, [categoryFilteredRows, selectedTeamId])

  const statusCounts = useMemo(
    () =>
      STATUS_GROUPS.reduce<Record<PlayerStatusGroup, number>>(
        (acc, status) => {
          acc[status.key] = teamFilteredRows.filter(
            (player) => playerStatusGroup(player.status) === status.key,
          ).length
          return acc
        },
        { active: 0, inactive: 0 },
      ),
    [teamFilteredRows],
  )

  const tabFilteredRows = useMemo(
    () =>
      teamFilteredRows
        .filter((player) => playerStatusGroup(player.status) === activeStatus)
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [activeStatus, teamFilteredRows],
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

  const selectedPlayerIds = useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([, selected]) => selected)
        .map(([id]) => Number(id))
        .filter((id) => Number.isFinite(id)),
    [rowSelection],
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
          placeholder="Search players…"
          aria-label="Filter results"
        />
      </div>
    </div>
  )

  const renderTabs = (
    <div className="player-tab-catalog">
      <div className="player-tab-catalog__tabs" aria-label="Player categories">
        {CATEGORY_GROUPS.map((category) => (
          <button
            key={category.key}
            type="button"
            className={activeCategory === category.key ? 'is-active' : ''}
            onClick={() => {
              setActiveCategory(category.key)
              setSelectedTeamId(null)
              setRowSelection({})
            }}
          >
            {category.label} <span>({categoryCounts[category.key]})</span>
          </button>
        ))}
      </div>

      <div className="player-tab-catalog__team-row">
        <label>
          <span>Team</span>
          <select
            value={selectedTeamId ?? ''}
            onChange={(event) => {
              setSelectedTeamId(
                event.target.value ? Number(event.target.value) : null,
              )
              setRowSelection({})
            }}
          >
            <option value="">All teams</option>
            {categoryTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="player-tab-catalog__tabs" aria-label="Player statuses">
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

  const bulkSetStatus = async (status: 'active' | 'inactive') => {
    if (selectedPlayerIds.length === 0) return

    const label = status === 'inactive' ? 'inactive' : 'active'

    if (
      !confirm(
        `Mark ${selectedPlayerIds.length} selected player(s) as ${label}?`,
      )
    ) {
      return
    }

    try {
      await adminPost('/admin/players/bulk-status', {
        player_ids: selectedPlayerIds,
        status,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'players'] })
      setRowSelection({})
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Bulk update failed')
    }
  }

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

      {loading ? (
        <p className="muted">Loading…</p>
      ) : err ? (
        <p className="login-error">{err.message}</p>
      ) : mode === 'cards' ? (
        <>
          {renderToolbar}
          {renderTabs}

          {tabFilteredRows.length === 0 ? (
            <p className="player-tab-catalog__empty muted">
              No players match this category, team and status.
            </p>
          ) : (
            <div className="player-tab-catalog__cards">
              {tabFilteredRows.map((player) => (
                <PlayerCard key={player.id} player={player} />
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
            data={tabFilteredRows}
            hideToolbar
            enableRowSelection
            getRowId={(row) => String(row.id)}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            bulkActions={
              <>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => void bulkSetStatus('inactive')}
                >
                  Mark inactive
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => void bulkSetStatus('active')}
                >
                  Mark active
                </button>
              </>
            }
            onRowClick={(row) =>
              void navigate({
                to: '/players/$playerId',
                params: { playerId: String(row.id) },
              })
            }
          />
        </>
      )}
    </>
  )
}
