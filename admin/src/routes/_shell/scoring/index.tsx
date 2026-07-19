import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { PlayCircle } from 'lucide-react'
import { useMemo } from 'react'
import type { MatchDto, Paginated, TeamDto } from '@/lib/api-types'
import { adminGet } from '@/lib/admin-client'
import { apiFetch } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'

export const Route = createFileRoute('/_shell/scoring/')({
  component: ScoringDashboardPage,
})

async function publicListAll<T>(path: string): Promise<T[]> {
  const items: T[] = []
  let page = 1

  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    const res = await apiFetch<Paginated<T>>(
      `${path}${sep}page=${page}&page_size=100`,
    )

    items.push(...res.items)

    if (page >= res.pages) break
    page += 1
  }

  return items
}

function matchWhen(match: MatchDto): string {
  if (match.match_date) return match.match_date
  if (match.start_time) return String(match.start_time).slice(0, 16).replace('T', ' ')
  return '—'
}

function ScoringDashboardPage() {
  const matchesQ = useQuery({
    queryKey: ['admin', 'scorer', 'matches'],
    queryFn: () => adminGet<MatchDto[]>('/admin/scorer/matches'),
    refetchInterval: 15000,
    retry: 1,
  })

  const teamsQ = useQuery({
    queryKey: ['public', 'teams', 'all-for-scoring'],
    queryFn: () => publicListAll<TeamDto>('/public/teams?include_inactive=true'),
    retry: 1,
  })

  const teamById = useMemo(
    () => new Map((teamsQ.data ?? []).map((team) => [team.id, team] as const)),
    [teamsQ.data],
  )

  const rows = matchesQ.data ?? []

  return (
    <>
      <PageHeader
        title="Live scoring"
        description="Assigned matches ready for ball-by-ball scoring."
      />

      {matchesQ.isLoading ? <p className="muted">Loading assigned matches…</p> : null}
      {matchesQ.isError ? <p className="login-error">{matchesQ.error.message}</p> : null}

      {!matchesQ.isLoading && !matchesQ.isError && rows.length === 0 ? (
        <p className="muted">No assigned matches are available for scoring.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="catalog-card-grid">
          {rows.map((match) => {
            const home = teamById.get(match.home_team_id)
            const away = teamById.get(match.away_team_id)
            const homeName = home?.name ?? `Team ${match.home_team_id}`
            const awayName = away?.name ?? `Team ${match.away_team_id}`

            return (
              <Link
                key={match.id}
                to="/scoring/$matchId"
                params={{ matchId: String(match.id) }}
                className="entity-thumb-card"
              >
                <div className="entity-thumb-card__body">
                  <h3 className="entity-thumb-card__title">
                    {homeName} vs {awayName}
                  </h3>
                  <p className="entity-thumb-card__meta muted">
                    {matchWhen(match)}
                    <br />
                    {match.season
                      ? `${match.season.league.name} — ${match.season.name}`
                      : 'No season'}
                    <br />
                    {match.venue ?? '—'}
                  </p>
                </div>
                <div className="entity-thumb-card__footer">
                  <StatusBadge
                    status={
                      match.status as
                        | 'scheduled'
                        | 'live'
                        | 'completed'
                        | 'postponed'
                        | 'abandoned'
                        | 'cancelled'
                    }
                  />
                  <span className="btn-ghost btn--with-icon">
                    <PlayCircle size={18} strokeWidth={2} aria-hidden />
                    Score
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      ) : null}
    </>
  )
}
