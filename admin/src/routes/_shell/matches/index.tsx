import { useMemo, useState } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import type { LeagueDto, MatchDto, SeasonDto, TeamDto } from '@/lib/api-types'
import { adminListAll, adminPost } from '@/lib/admin-client'
import { invalidateCompetitionDataQueries } from '@/lib/invalidate-competition-data'
import { BadgeImage } from '@/components/BadgeImage'
import { MatchTableTeamCell } from '@/components/MatchTableTeamCell'
import { EntityTable } from '@/components/EntityTable'
import { ListViewModeSwitch } from '@/components/ListViewModeSwitch'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { useListViewMode } from '@/hooks/useListViewMode'
import { matchResultSummaryLine, matchWinnerSide } from '@/lib/match-winner'

type MatchStatusTab = 'active' | 'completed' | 'other'

type MatchListRouteSearch = {
  statusTab?: MatchStatusTab
  leagueId?: number | null
  seasonId?: number | null
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (
    typeof value === 'string' &&
    value.trim() !== '' &&
    !Number.isNaN(Number(value))
  ) {
    return Number(value)
  }

  return null
}

function parseMatchListRouteSearch(
  raw: Record<string, unknown>,
): MatchListRouteSearch {
  const statusTab = raw.statusTab

  return {
    statusTab:
      statusTab === 'completed'
        ? 'completed'
        : statusTab === 'other'
          ? 'other'
          : statusTab === 'active'
            ? 'active'
            : undefined,
    leagueId: readNumber(raw.leagueId),
    seasonId: readNumber(raw.seasonId),
  }
}

export const Route = createFileRoute('/_shell/matches/')({
  validateSearch: parseMatchListRouteSearch,
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

type MatchGroup = {
  key: string
  leagueName: string
  seasonName: string
  rows: MatchRow[]
}

const STATUS_TABS: readonly {
  id: MatchStatusTab
  label: string
}[] = [
  { id: 'active', label: 'Scheduled / Live' },
  { id: 'completed', label: 'Completed' },
  { id: 'other', label: 'Other' },
]

function formatWhen(m: MatchDto): string {
  if (m.match_date) return m.match_date
  if (m.start_time) return String(m.start_time).slice(0, 16).replace('T', ' ')
  return '—'
}

function statusTabForMatch(status: string): MatchStatusTab {
  if (status === 'completed') return 'completed'
  if (status === 'scheduled' || status === 'live') return 'active'
  return 'other'
}

function sortRowsForTab(
  a: MatchRow,
  b: MatchRow,
  statusTab: MatchStatusTab,
): number {
  const av = a.match_date ?? a.start_time ?? ''
  const bv = b.match_date ?? b.start_time ?? ''

  if (statusTab === 'completed' || statusTab === 'other') {
    return String(bv).localeCompare(String(av)) || b.id - a.id
  }

  return String(av).localeCompare(String(bv)) || a.id - b.id
}

function MatchesPage() {
  const routeSearch = Route.useSearch()
  const statusTab = routeSearch.statusTab ?? 'active'
  const selectedLeagueId = routeSearch.leagueId ?? null
  const selectedSeasonId = routeSearch.seasonId ?? null

  const [mode, setMode] = useListViewMode('matches')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const matchListSearch = useMemo(
    () => ({
      statusTab,
      leagueId: selectedLeagueId,
      seasonId: selectedSeasonId,
    }),
    [statusTab, selectedLeagueId, selectedSeasonId],
  )

  const updateListSearch = (next: Partial<MatchListRouteSearch>) => {
    void navigate({
      to: '/matches',
      search: {
        statusTab: next.statusTab ?? statusTab,
        leagueId:
          Object.prototype.hasOwnProperty.call(next, 'leagueId')
            ? (next.leagueId ?? null)
            : selectedLeagueId,
        seasonId:
          Object.prototype.hasOwnProperty.call(next, 'seasonId')
            ? (next.seasonId ?? null)
            : selectedSeasonId,
      },
    })
  }

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

  const tabBaseRows = useMemo(() => {
    return rows.filter((r) => {
      if (selectedSeasonId != null) return r.season_id === selectedSeasonId

      if (selectedLeagueId == null) return true

      const season = (seasonsQ.data ?? []).find((s) => s.id === r.season_id)
      return season?.league_id === selectedLeagueId
    })
  }, [rows, selectedLeagueId, selectedSeasonId, seasonsQ.data])

  const tabCounts = useMemo(() => {
    return {
      active: tabBaseRows.filter((r) => statusTabForMatch(r.status) === 'active')
        .length,
      completed: tabBaseRows.filter(
        (r) => statusTabForMatch(r.status) === 'completed',
      ).length,
      other: tabBaseRows.filter((r) => statusTabForMatch(r.status) === 'other')
        .length,
    }
  }, [tabBaseRows])

  const filteredRows = useMemo(() => {
    return tabBaseRows.filter((r) => statusTabForMatch(r.status) === statusTab)
  }, [tabBaseRows, statusTab])

  const queryFilteredRows = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()

    const sorted = [...filteredRows].sort((a, b) =>
      sortRowsForTab(a, b, statusTab),
    )

    if (!needle) return sorted

    return sorted.filter((r) =>
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
  }, [filteredRows, searchQuery, statusTab])

  const groupedRows = useMemo((): MatchGroup[] => {
    const groups = new Map<string, MatchGroup>()

    for (const row of queryFilteredRows) {
      const key = `${row.league_name}::${row.season_name}::${row.season_id ?? 'none'}`

      const existing = groups.get(key)

      if (existing) {
        existing.rows.push(row)
        continue
      }

      groups.set(key, {
        key,
        leagueName: row.league_name,
        seasonName: row.season_name,
        rows: [row],
      })
    }

    return [...groups.values()].sort(
      (a, b) =>
        a.leagueName.localeCompare(b.leagueName) ||
        a.seasonName.localeCompare(b.seasonName),
    )
  }, [queryFilteredRows])

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
          updateListSearch({
            leagueId: next,
            seasonId: null,
          })
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
          updateListSearch({
            seasonId: e.target.value ? Number(e.target.value) : null,
          })
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

  const selectedMatchIds = useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([, selected]) => selected)
        .map(([id]) => Number(id))
        .filter((id) => Number.isFinite(id)),
    [rowSelection],
  )

  const bulkCancel = async () => {
    if (selectedMatchIds.length === 0) return

    const selected = queryFilteredRows.filter((m) =>
      selectedMatchIds.includes(m.id),
    )
    const completedCount = selected.filter((m) => m.status === 'completed').length
    let msg = `Cancel ${selectedMatchIds.length} fixture(s)? They will be removed from standings.`

    if (completedCount > 0) {
      msg += `\n\n${completedCount} completed match(es) will also update player career stats.`
    }

    if (!confirm(msg)) return

    try {
      await adminPost('/admin/matches/bulk-cancel', {
        match_ids: selectedMatchIds,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches'] })
      await invalidateCompetitionDataQueries(queryClient)
      setRowSelection({})
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Bulk cancel failed')
    }
  }

  const renderMatchCard = (m: MatchRow) => {
    const winner = matchWinnerSide(m)
    const scoreline = matchResultSummaryLine(m)

    return (
      <Link
        key={m.id}
        to="/matches/$matchId"
        params={{ matchId: String(m.id) }}
        search={matchListSearch}
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
            {m.league_name} — {m.season_name}
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
  }

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
        <div className="catalog-browse">
          <div
            className="dashboard-match-panel__tabs"
            role="tablist"
            aria-label="Fixture status"
          >
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`dashboard-match-panel__tab${statusTab === tab.id ? ' is-active' : ''}`}
                role="tab"
                aria-selected={statusTab === tab.id}
                onClick={() =>
                  updateListSearch({
                    statusTab: tab.id,
                  })
                }
              >
                {tab.label}
                <span className="muted"> ({tabCounts[tab.id]})</span>
              </button>
            ))}
          </div>

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
      ) : groupedRows.length === 0 ? (
        <p className="muted">No fixtures match this tab and filters.</p>
      ) : mode === 'cards' ? (
        <div className="match-admin-groups">
          {groupedRows.map((group) => (
            <section key={group.key} className="team-hub-section">
              <div className="team-hub-section-head">
                <div className="team-hub-section-head__lead">
                  <h2 className="team-hub-section__title">
                    {group.leagueName}
                  </h2>
                  <p className="muted">
                    {group.seasonName} · {group.rows.length} fixture
                    {group.rows.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <div className="catalog-card-grid">
                {group.rows.map(renderMatchCard)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="match-admin-groups">
          {groupedRows.map((group) => (
            <section key={group.key} className="team-hub-section">
              <div className="team-hub-section-head">
                <div className="team-hub-section-head__lead">
                  <h2 className="team-hub-section__title">
                    {group.leagueName}
                  </h2>
                  <p className="muted">
                    {group.seasonName} · {group.rows.length} fixture
                    {group.rows.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <EntityTable
                columns={columns}
                data={group.rows}
                hideToolbar
                enableRowSelection
                getRowId={(row) => String(row.id)}
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
                bulkActions={
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => void bulkCancel()}
                  >
                    Cancel selected
                  </button>
                }
                onRowClick={(row) =>
                  void navigate({
                    to: '/matches/$matchId',
                    params: { matchId: String(row.id) },
                    search: matchListSearch,
                  })
                }
              />
            </section>
          ))}
        </div>
      )}
    </>
  )
}
