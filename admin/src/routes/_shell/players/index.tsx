import { useMemo } from 'react'
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
      {!loading && !err ? (
        <div className="catalog-page-toolbar">
          <ListViewModeSwitch value={mode} onChange={setMode} />
        </div>
      ) : null}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : err ? (
        <p className="login-error">{err.message}</p>
      ) : mode === 'cards' ? (
        <CatalogFilterGrid
          items={rows}
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
          data={rows}
          globalFilterPlaceholder="Search players…"
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
