import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import type {
  LeagueDto,
  MatchDto,
  Paginated,
  PlayerDto,
  TeamDto,
} from '@/lib/api-types'
import { adminGet, adminListAll } from '@/lib/admin-client'
import { MatchTableTeamCell } from '@/components/MatchTableTeamCell'
import { EntityTable } from '@/components/EntityTable'
import { SectionHintTip } from '@/components/SectionHintTip'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { adminRouteIconForPath } from '@/lib/adminRouteIcons'
import type { NavItem } from '@/lib/nav'
import { matchResultSummaryLine } from '@/lib/match-winner'
import { navVisibleForRole } from '@/lib/nav'
import { getSession } from '@/lib/session'

export const Route = createFileRoute('/_shell/')({
  component: DashboardHome,
})

type ModuleDef = {
  to: string
  label: string
  description: string
  roles?: NavItem['roles']
  statIndex: number
}

const MATCH_MODULE_ROLES: NavItem['roles'] = [
  'super_admin',
  'competition_manager',
  'read_only_admin',
]

const DASHBOARD_MODULES: ModuleDef[] = [
  {
    to: '/teams',
    label: 'Teams',
    description: 'Squads, badges, venues, and roster links',
    roles: ['super_admin', 'competition_manager', 'read_only_admin'],
    statIndex: 0,
  },
  {
    to: '/players',
    label: 'Players',
    description: 'Profiles, roles, and team assignments',
    roles: ['super_admin', 'competition_manager', 'read_only_admin'],
    statIndex: 1,
  },
  {
    to: '/leagues',
    label: 'Leagues',
    description: 'Competitions and seasons (rosters per season)',
    roles: ['super_admin', 'competition_manager', 'read_only_admin'],
    statIndex: 2,
  },
  {
    to: '/matches',
    label: 'Fixtures',
    description: 'Schedule, venues, and match administration',
    roles: ['super_admin', 'competition_manager', 'read_only_admin'],
    statIndex: 3,
  },
]

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

function matchTimeMs(m: MatchDto): number {
  const raw = m.match_date ?? m.start_time
  if (!raw) return 0
  const t = new Date(raw).getTime()
  return Number.isFinite(t) ? t : 0
}

function DashboardHome() {
  const session = getSession()
  const navigate = useNavigate()
  const showMatchTables = navVisibleForRole(
    {
      to: '/matches',
      label: 'Fixtures & matches',
      roles: MATCH_MODULE_ROLES,
    },
    session?.role,
  )
  const queries = useQueries({
    queries: [
      {
        queryKey: ['admin', 'totals', 'teamsActive'],
        queryFn: () =>
          adminGet<Paginated<TeamDto>>(
            '/admin/teams?page=1&page_size=1&status=active',
          ).then((r) => r.total),
      },
      {
        queryKey: ['admin', 'totals', 'players'],
        queryFn: () =>
          adminGet<Paginated<PlayerDto>>('/admin/players?page=1&page_size=1').then(
            (r) => r.total,
          ),
      },
      {
        queryKey: ['admin', 'totals', 'leagues'],
        queryFn: () =>
          adminGet<Paginated<LeagueDto>>('/admin/leagues?page=1&page_size=1').then(
            (r) => r.total,
          ),
      },
      {
        queryKey: ['admin', 'totals', 'matches'],
        queryFn: () =>
          adminGet<Paginated<MatchDto>>('/admin/matches?page=1&page_size=1').then(
            (r) => r.total,
          ),
      },
      {
        queryKey: ['admin', 'teams'],
        queryFn: () => adminListAll<TeamDto>('/admin/teams'),
        enabled: showMatchTables,
      },
      {
        queryKey: ['admin', 'matches'],
        queryFn: () => adminListAll<MatchDto>('/admin/matches'),
        enabled: showMatchTables,
      },
    ],
  })

  const loading = queries.some((q) => q.isLoading)
  const err = queries.find((q) => q.isError)?.error

  const teamsActive = queries[0].data as number | undefined
  const players = queries[1].data as number | undefined
  const leagues = queries[2].data as number | undefined
  const matchesTotal = queries[3].data as number | undefined
  const teamsData = queries[4].data as TeamDto[] | undefined
  const matchesData = queries[5].data as MatchDto[] | undefined
  const stats = [teamsActive, players, leagues, matchesTotal]

  const matchRows = useMemo((): MatchRow[] => {
    const teams = teamsData
    const matches = matchesData
    const teamById = new Map((teams ?? []).map((t) => [t.id, t] as const))
    return (matches ?? []).map((m) => {
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
  }, [teamsData, matchesData])

  const fixtureRows = useMemo(() => {
    const rows = matchRows.filter((m) => m.status !== 'completed')
    return [...rows].sort((a, b) => matchTimeMs(a) - matchTimeMs(b))
  }, [matchRows])

  const resultRows = useMemo(() => {
    const rows = matchRows.filter((m) => m.status === 'completed')
    return [...rows].sort((a, b) => matchTimeMs(b) - matchTimeMs(a))
  }, [matchRows])

  const fixtureColumns: ColumnDef<MatchRow, unknown>[] = [
    { accessorKey: 'when_display', header: 'When' },
    {
      accessorKey: 'home_name',
      header: 'Home',
      cell: ({ row }) => <MatchTableTeamCell side="home" row={row.original} />,
    },
    {
      accessorKey: 'away_name',
      header: 'Away',
      cell: ({ row }) => <MatchTableTeamCell side="away" row={row.original} />,
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

  const resultColumns: ColumnDef<MatchRow, unknown>[] = [
    { accessorKey: 'when_display', header: 'When' },
    {
      accessorKey: 'home_name',
      header: 'Home',
      cell: ({ row }) => <MatchTableTeamCell side="home" row={row.original} />,
    },
    {
      accessorKey: 'away_name',
      header: 'Away',
      cell: ({ row }) => <MatchTableTeamCell side="away" row={row.original} />,
    },
    {
      id: 'result_summary',
      header: 'Result',
      cell: ({ row }) => {
        const m = row.original
        const r = m.result
        const line = matchResultSummaryLine(m)
        const display = line ?? (r ? 'Recorded' : '—')
        return <span className="muted">{display}</span>
      },
    },
    { accessorKey: 'venue', header: 'Venue' },
  ]
  const [matchTab, setMatchTab] = useState<'fixtures' | 'results'>('fixtures')
  const showingFixtures = matchTab === 'fixtures'

  const visibleModules = DASHBOARD_MODULES.filter((m) =>
    navVisibleForRole({ to: m.to, label: m.label, roles: m.roles }, session?.role),
  )

  let body: ReactNode
  if (loading) {
    body = <p className="muted">Loading…</p>
  } else if (err) {
    body = <p className="login-error">{err.message}</p>
  } else {
    body = (
      <>
        <h2 className="dashboard-section-title dashboard-section-title--first">
          Competition workspace
        </h2>
        <div className="dashboard-module-grid">
          {visibleModules.map((m) => {
            const stat = stats[m.statIndex]
            const ModIcon = adminRouteIconForPath(m.to)
            return (
              <Link
                key={m.to}
                to={m.to}
                className="dashboard-module-card"
              >
                <span className="dashboard-module-card__glyph" aria-hidden>
                  <ModIcon size={20} strokeWidth={2} />
                </span>
                <div>
                  <h3 className="dashboard-module-card__title">{m.label}</h3>
                  <p className="dashboard-module-card__desc">{m.description}</p>
                </div>
                {typeof stat === 'number' ? (
                  <div className="dashboard-module-card__stat">{stat}</div>
                ) : (
                  <span className="dashboard-module-card__stat-placeholder">
                    —
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {showMatchTables ? (
          <section className="team-hub-section dashboard-match-panel">
            <div className="dashboard-match-panel__tabs" role="tablist" aria-label="Match views">
              <button
                type="button"
                role="tab"
                aria-selected={showingFixtures}
                className={`dashboard-match-panel__tab${showingFixtures ? ' is-active' : ''}`}
                onClick={() => setMatchTab('fixtures')}
              >
                Fixtures
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!showingFixtures}
                className={`dashboard-match-panel__tab${!showingFixtures ? ' is-active' : ''}`}
                onClick={() => setMatchTab('results')}
              >
                Results
              </button>
            </div>
            <div className="team-hub-section-head">
              <div className="team-hub-section-head__lead">
                <h2 className="team-hub-section__title">
                  {showingFixtures ? 'Fixtures' : 'Results'}
                </h2>
                {showingFixtures ? (
                  <SectionHintTip
                    ariaHelp="Upcoming and in-progress matches (everything not yet marked completed). Click a row to open the match hub."
                  >
                    <span className="section-hint-tip__text">
                      Upcoming and in-progress matches (everything not yet marked{' '}
                      <strong>completed</strong>). Click a row to open the match hub.
                    </span>
                  </SectionHintTip>
                ) : (
                  <SectionHintTip
                    ariaHelp="Completed fixtures with score line or margin when the API has stored a MatchResult."
                  >
                    <span className="section-hint-tip__text">
                      Completed fixtures with score line or margin when the API has
                      stored a <strong>MatchResult</strong>.
                    </span>
                  </SectionHintTip>
                )}
              </div>
              <Link to="/matches" className="btn-ghost btn--with-icon">
                {showingFixtures ? 'All fixtures' : 'All matches'}
                <ChevronRight size={18} strokeWidth={2} aria-hidden />
              </Link>
            </div>
            <EntityTable
              columns={showingFixtures ? fixtureColumns : resultColumns}
              data={showingFixtures ? fixtureRows : resultRows}
              globalFilterPlaceholder={
                showingFixtures ? 'Search fixtures…' : 'Search results…'
              }
              onRowClick={(row) =>
                void navigate({
                  to: '/matches/$matchId',
                  params: { matchId: String(row.id) },
                })
              }
            />
          </section>
        ) : null}
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Overview"
        descriptionAsTooltip
        description="Competition shortcuts, live fixtures and results from GET /admin/matches, and module counts (page_size=1 totals)."
      />
      {body}
    </>
  )
}
