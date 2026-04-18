import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import type { MatchDto, TeamDto } from '@/lib/api-types'
import { adminListAll } from '@/lib/admin-client'
import { BadgeImage } from '@/components/BadgeImage'
import { MatchTableTeamCell } from '@/components/MatchTableTeamCell'
import { CatalogFilterGrid } from '@/components/CatalogFilterGrid'
import { EntityTable } from '@/components/EntityTable'
import { ListViewModeSwitch } from '@/components/ListViewModeSwitch'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { useListViewMode } from '@/hooks/useListViewMode'
import { matchResultSummaryLine, matchWinnerSide } from '@/lib/match-winner'

export const Route = createFileRoute('/_shell/matches/')({
  component: MatchesPage,
})

type MatchRow = MatchDto & {
  home_name: string
  away_name: string
  home_logo_url: string | null
  away_logo_url: string | null
  when_display: string
}

function formatWhen(m: MatchDto): string {
  if (m.match_date) return m.match_date
  if (m.start_time) return String(m.start_time).slice(0, 16).replace('T', ' ')
  return '—'
}

function MatchesPage() {
  const [mode, setMode] = useListViewMode('matches')
  const navigate = useNavigate()
  const [teamsQ, matchesQ] = useQueries({
    queries: [
      {
        queryKey: ['admin', 'teams'],
        queryFn: () => adminListAll<TeamDto>('/admin/teams'),
      },
      {
        queryKey: ['admin', 'matches'],
        queryFn: () => adminListAll<MatchDto>('/admin/matches'),
      },
    ],
  })

  const rows = useMemo((): MatchRow[] => {
    const teamById = new Map(
      (teamsQ.data ?? []).map((t) => [t.id, t] as const),
    )
    return (matchesQ.data ?? []).map((m) => {
      const home = teamById.get(m.home_team_id)
      const away = teamById.get(m.away_team_id)
      return {
        ...m,
        home_name: home?.name ?? `#${m.home_team_id}`,
        away_name: away?.name ?? `#${m.away_team_id}`,
        home_logo_url: home?.logo_url ?? null,
        away_logo_url: away?.logo_url ?? null,
        when_display: formatWhen(m),
      }
    })
  }, [teamsQ.data, matchesQ.data])

  const columns: ColumnDef<MatchRow, unknown>[] = [
    { accessorKey: 'when_display', header: 'When' },
    {
      accessorKey: 'home_name',
      header: 'Home',
      cell: ({ row }) => (
        <MatchTableTeamCell side="home" row={row.original} />
      ),
    },
    {
      accessorKey: 'away_name',
      header: 'Away',
      cell: ({ row }) => (
        <MatchTableTeamCell side="away" row={row.original} />
      ),
    },
    {
      id: 'scoreline',
      header: 'Score',
      cell: ({ row }) => {
        const line = matchResultSummaryLine(row.original)
        return line ? (
          <span className="muted">{line}</span>
        ) : (
          <span className="muted">—</span>
        )
      },
    },
    { accessorKey: 'venue', header: 'Venue' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => (
        <StatusBadge
          status={
            getValue() as
              | 'scheduled'
              | 'live'
              | 'completed'
              | 'postponed'
              | 'abandoned'
              | 'cancelled'
          }
        />
      ),
    },
  ]

  const loading = teamsQ.isLoading || matchesQ.isLoading
  const err = teamsQ.error ?? matchesQ.error

  return (
    <>
      <PageHeader
        title="Fixtures & matches"
        descriptionAsTooltip
        description="GET /admin/matches with team names resolved from GET /admin/teams."
        actions={
          <Link to="/matches/new" className="btn-primary btn--with-icon">
            <Plus size={18} strokeWidth={2} aria-hidden />
            New fixture
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
              r.when_display,
              r.home_name,
              r.away_name,
              r.venue,
              r.status,
              matchResultSummaryLine(r),
            ]
              .filter(Boolean)
              .join(' ')
          }
          searchPlaceholder="Search fixtures…"
          renderCard={(m) => {
            const winner = matchWinnerSide(m)
            const scoreline = matchResultSummaryLine(m)
            return (
              <Link
                to="/matches/$matchId"
                params={{ matchId: String(m.id) }}
                className="entity-thumb-card"
              >
                <div className="entity-thumb-card__media entity-thumb-card__media--duo">
                  <span
                    className={`entity-thumb-card__badge-wrap${winner === 'home' ? ' entity-thumb-card__badge-wrap--winner' : ''}`}
                    aria-label={winner === 'home' ? 'Winner' : undefined}
                  >
                    <BadgeImage imageUrl={m.home_logo_url} alt="" size="lg" />
                    {winner === 'home' ? (
                      <span
                        className="entity-thumb-card__winner-cup"
                        aria-hidden
                        title="Winner"
                      >
                        🏆
                      </span>
                    ) : null}
                  </span>
                  <span className="entity-thumb-card__vs">vs</span>
                  <span
                    className={`entity-thumb-card__badge-wrap${winner === 'away' ? ' entity-thumb-card__badge-wrap--winner' : ''}`}
                    aria-label={winner === 'away' ? 'Winner' : undefined}
                  >
                    <BadgeImage imageUrl={m.away_logo_url} alt="" size="lg" />
                    {winner === 'away' ? (
                      <span
                        className="entity-thumb-card__winner-cup"
                        aria-hidden
                        title="Winner"
                      >
                        🏆
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="entity-thumb-card__body">
                  <h3 className="entity-thumb-card__title">
                    {m.home_name} vs {m.away_name}
                  </h3>
                  <p className="entity-thumb-card__meta muted">
                    {m.when_display}
                    <br />
                    {m.venue ?? '—'}
                    {scoreline ? (
                      <>
                        <br />
                        <span className="entity-thumb-card__scoreline">
                          {scoreline}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="entity-thumb-card__footer">
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
                </div>
              </Link>
            )
          }}
        />
      ) : (
        <EntityTable
          columns={columns}
          data={rows}
          globalFilterPlaceholder="Search fixtures…"
          onRowClick={(row) =>
            void navigate({
              to: '/matches/$matchId',
              params: { matchId: String(row.id) },
            })
          }
        />
      )}
    </>
  )
}
