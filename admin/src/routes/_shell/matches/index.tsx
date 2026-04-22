import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import type { LeagueDto, MatchDto, SeasonDto, TeamDto } from '@/lib/api-types'
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
  season_name: string
  league_name: string
}

function formatWhen(m: MatchDto): string {
  if (m.match_date) return m.match_date
  if (m.start_time) return String(m.start_time).slice(0, 16).replace('T', ' ')
  return '—'
}

function MatchesPage() {
  const [mode, setMode] = useListViewMode('matches')
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null)
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)

  const [teamsQ, matchesQ, seasonsQ, leaguesQ] = useQueries({
    queries: [
      {
        queryKey: ['admin', 'teams'],
        queryFn: () => adminListAll<TeamDto>('/admin/teams'),
      },
      {
        queryKey: ['admin', 'matches'],
        queryFn: () => adminListAll<MatchDto>('/admin/matches'),
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

  const rows = useMemo((): MatchRow[] => {
    const seasonById = new Map(
      (seasonsQ.data ?? []).map((s) => [s.id, s] as const),
    )
    const leagueById = new Map(
      (leaguesQ.data ?? []).map((l) => [l.id, l] as const),
    )
    const teamById = new Map(
      (teamsQ.data ?? []).map((t) => [t.id, t] as const),
    )
    return (matchesQ.data ?? []).map((m) => {
      const home = teamById.get(m.home_team_id)
      const away = teamById.get(m.away_team_id)
      const season = m.season_id != null ? seasonById.get(m.season_id) : undefined
      const league =
        season != null ? leagueById.get(season.league_id) : undefined
      return {
        ...m,
        home_name: home?.name ?? `#${m.home_team_id}`,
        away_name: away?.name ?? `#${m.away_team_id}`,
        home_logo_url: home?.logo_url ?? null,
        away_logo_url: away?.logo_url ?? null,
        when_display: formatWhen(m),
        season_name: season?.name ?? '—',
        league_name: league?.name ?? '—',
      }
    })
  }, [teamsQ.data, matchesQ.data, seasonsQ.data, leaguesQ.data])

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (selectedSeasonId != null) return r.season_id === selectedSeasonId
      if (selectedLeagueId == null) return true
      const season = (seasonsQ.data ?? []).find((s) => s.id === r.season_id)
      return season?.league_id === selectedLeagueId
    })
  }, [rows, selectedLeagueId, selectedSeasonId, seasonsQ.data])

  const queryFilteredRows = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()
    if (!needle) return filteredRows
    return filteredRows.filter((r) =>
      [
        r.when_display,
        r.league_name,
        r.season_name,
        r.home_name,
        r.away_name,
        r.venue,
        r.status,
        matchResultSummaryLine(r),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [filteredRows, searchQuery])

  const seasonsForLeague = useMemo(() => {
    if (selectedLeagueId == null) return seasonsQ.data ?? []
    return (seasonsQ.data ?? []).filter((s) => s.league_id === selectedLeagueId)
  }, [selectedLeagueId, seasonsQ.data])

  const columns: ColumnDef<MatchRow, unknown>[] = [
    { accessorKey: 'when_display', header: 'When' },
    { accessorKey: 'league_name', header: 'League' },
    { accessorKey: 'season_name', header: 'Season' },
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

  const loading =
    teamsQ.isLoading || matchesQ.isLoading || seasonsQ.isLoading || leaguesQ.isLoading
  const err = teamsQ.error ?? matchesQ.error ?? seasonsQ.error ?? leaguesQ.error
  const toolbarFilters = (
    <div className="catalog-filters-inline">
      <select
        className="inline-edit__control catalog-filter-select"
        value={selectedLeagueId ?? ''}
        onChange={(e) => {
          const next = e.target.value ? Number(e.target.value) : null
          setSelectedLeagueId(next)
          setSelectedSeasonId(null)
        }}
      >
        <option value="">All leagues</option>
        {(leaguesQ.data ?? []).map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <select
        className="inline-edit__control catalog-filter-select"
        value={selectedSeasonId ?? ''}
        onChange={(e) =>
          setSelectedSeasonId(e.target.value ? Number(e.target.value) : null)
        }
      >
        <option value="">All seasons</option>
        {seasonsForLeague.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  )

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
              placeholder="Search fixtures…"
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
          items={queryFilteredRows}
          getKey={(r) => r.id}
          getSearchText={(r) =>
            [
              r.when_display,
              r.league_name,
              r.season_name,
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
          toolbarLeading={
            <ListViewModeSwitch value={mode} onChange={setMode} />
          }
          toolbarExtras={toolbarFilters}
          query={searchQuery}
          onQueryChange={setSearchQuery}
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
          data={queryFilteredRows}
          hideToolbar
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
