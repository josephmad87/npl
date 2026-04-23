import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { EmptyState } from './EmptyState'
import { ErrorNotice } from './ErrorNotice'
import { LeagueHeroBar } from './LeagueHeroBar'
import { LeagueStatsPanel } from './LeagueStatsPanel'
import { MatchCard } from './MatchCard'
import { PageHero } from './PageHero'
import { SectionHeader } from './SectionHeader'
import { Spinner } from './Spinner'
import { formatCategoryLabel } from '../lib/formatters'
import {
  computeSeasonStandings,
  formatRunsOversLine,
  formatStandingsNrr,
  sortStandingsDesc,
} from '../lib/leagueSeasonAggregates'
import { type LeagueLite, type MatchLite, useTeamsMap } from '../lib/hooks'
import { extractList, fetchJson } from '../lib/publicApi'

type LeagueDetail = {
  id: number
  name: string
  slug: string
  category: string | null
  banner_url: string | null
  logo_url: string | null
  status: string
  description: string | null
  seasons: Array<{
    id: number
    name: string
    slug: string
    start_date: string | null
    end_date: string | null
    status: string
  }>
}

type SeasonDetail = {
  id: number
  name: string
  slug: string
  status: string
  start_date: string | null
  end_date: string | null
  team_ids: number[]
}

export function LeagueSeasonHub({
  leagueSlug,
  onLeagueSlugChange,
  showDescription = true,
  seasonSlugFromRoute,
  onSeasonSlugNavigate,
}: {
  leagueSlug: string
  onLeagueSlugChange: (slug: string) => void
  showDescription?: boolean
  /** When on a `/leagues/.../seasons/...` URL, drives the season picker from the path. */
  seasonSlugFromRoute?: string
  /** If set, season dropdown updates the app route instead of only local state. */
  onSeasonSlugNavigate?: (seasonSlug: string) => void
}) {
  const { map: teamsMap } = useTeamsMap()
  const [selectedSeasonSlug, setSelectedSeasonSlug] = useState<string | null>(null)
  const [section, setSection] = useState<'results' | 'stats' | 'standings'>('results')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['league-detail', leagueSlug],
    queryFn: () => fetchJson<LeagueDetail>(`/public/leagues/${leagueSlug}`),
    enabled: Boolean(leagueSlug),
    retry: 1,
  })

  const seasons = useMemo(() => data?.seasons ?? [], [data?.seasons])
  const activeSeasonSlug = useMemo(() => {
    if (seasonSlugFromRoute && seasons.some((s) => s.slug === seasonSlugFromRoute)) {
      return seasonSlugFromRoute
    }
    if (selectedSeasonSlug && seasons.some((s) => s.slug === selectedSeasonSlug)) {
      return selectedSeasonSlug
    }
    return seasons[0]?.slug ?? ''
  }, [seasons, selectedSeasonSlug, seasonSlugFromRoute])

  const leaguesListQ = useQuery({
    queryKey: ['league-picker', data?.category ?? 'all'],
    queryFn: async () => {
      const cat = data?.category
      const suffix = cat
        ? `&category=${encodeURIComponent(cat)}`
        : ''
      return extractList<LeagueLite>(
        await fetchJson<unknown>(`/public/leagues?page=1&page_size=100${suffix}`),
      )
    },
    enabled: Boolean(data),
    retry: 1,
  })

  const leagueOptions = useMemo(() => {
    const list = leaguesListQ.data ?? []
    const bySlug = new Map(list.map((l) => [l.slug, l] as const))
    if (data && !bySlug.has(data.slug)) {
      bySlug.set(data.slug, {
        id: data.id,
        name: data.name,
        slug: data.slug,
        category: data.category,
      })
    }
    return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [leaguesListQ.data, data])

  const seasonDetailQ = useQuery({
    queryKey: ['league-page-season', leagueSlug, activeSeasonSlug],
    queryFn: () => fetchJson<SeasonDetail>(`/public/leagues/${leagueSlug}/seasons/${activeSeasonSlug}`),
    enabled: Boolean(leagueSlug && activeSeasonSlug),
    retry: 1,
  })

  const seasonId = seasonDetailQ.data?.id
  const teamIds = useMemo(
    () => seasonDetailQ.data?.team_ids ?? [],
    [seasonDetailQ.data],
  )

  const resultsQ = useQuery({
    queryKey: ['league-page-results', seasonId],
    queryFn: async () =>
      extractList<MatchLite>(
        await fetchJson<unknown>(`/public/results?page=1&page_size=100&season_id=${seasonId}`),
      ),
    enabled: seasonId != null && seasonId > 0,
    retry: 1,
  })

  const resultMatches = useMemo(() => resultsQ.data ?? [], [resultsQ.data])
  const standingsRows = useMemo(() => {
    if (teamIds.length === 0) return []
    return sortStandingsDesc(computeSeasonStandings(resultMatches, teamIds))
  }, [resultMatches, teamIds])

  if (!leagueSlug) {
    return null
  }

  return (
    <>
      {data && seasons.length > 0 ? (
        <LeagueHeroBar
          seasons={seasons}
          leagues={leagueOptions}
          selectedSeasonSlug={activeSeasonSlug}
          selectedLeagueSlug={leagueSlug}
          onSeasonSlugChange={(s) => {
            if (onSeasonSlugNavigate) {
              onSeasonSlugNavigate(s)
            } else {
              setSelectedSeasonSlug(s)
            }
          }}
          onLeagueSlugChange={onLeagueSlugChange}
          section={section}
          onSectionChange={setSection}
          disabled={isLoading}
        />
      ) : data && seasons.length === 0 ? (
        <PageHero
          variant="siteLogo"
          title={data.name}
          subtitle={`${formatCategoryLabel(data.category)} • ${data.status}`}
        />
      ) : null}
      <main className="container">
        <section className="menu-page">
          {isLoading ? <Spinner label="Loading league..." /> : null}
          {isError ? <ErrorNotice message="Could not load league details." /> : null}
          {data ? (
            <>
              {showDescription ? (
                <p className="menu-page-copy">
                  {data.description ?? 'League overview coming soon.'}
                </p>
              ) : null}

              {seasons.length === 0 ? (
                <EmptyState title="No seasons in this league yet" />
              ) : seasonDetailQ.isError ? (
                <ErrorNotice message="Could not load the selected season." />
              ) : !seasonId || seasonDetailQ.isLoading ? (
                <Spinner label="Loading season..." />
              ) : section === 'results' ? (
                resultsQ.isLoading ? (
                  <Spinner label="Loading results..." />
                ) : resultMatches.length === 0 ? (
                  <EmptyState title="No results for this season yet" />
                ) : (
                  <div className="league-season-results">
                    <div className="league-season-results__list">
                      {resultMatches.map((match) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          teamsMap={teamsMap}
                          mode="result"
                        />
                      ))}
                    </div>
                  </div>
                )
              ) : section === 'standings' ? (
                resultsQ.isLoading ? (
                  <Spinner label="Loading standings..." />
                ) : (
                  <>
                    <SectionHeader title="Standings" />
                    {standingsRows.length === 0 ? (
                      <EmptyState title="No completed matches in this season yet" />
                    ) : (
                      <div className="league-standings-wrap">
                        <div className="league-standings-panel">
                          <div className="league-standings-scroll" role="region" aria-label="Points table">
                            <table className="league-standings-table">
                              <thead>
                                <tr>
                                  <th>Pos</th>
                                  <th>Team</th>
                                  <th>Mat</th>
                                  <th>Won</th>
                                  <th>Lost</th>
                                  <th>Tied</th>
                                  <th>NR</th>
                                  <th>NRR</th>
                                  <th>For</th>
                                  <th>Against</th>
                                  <th>Pts</th>
                                </tr>
                              </thead>
                              <tbody>
                                {standingsRows.map((row, idx) => {
                                  const t = teamsMap[row.teamId]
                                  return (
                                    <tr key={row.teamId}>
                                      <td>{idx + 1}</td>
                                      <td className="league-standings-table__team">
                                        {t?.name ?? `Team #${row.teamId}`}
                                      </td>
                                      <td>{row.played}</td>
                                      <td>{row.won}</td>
                                      <td>{row.lost}</td>
                                      <td>{row.tied}</td>
                                      <td>{row.nr}</td>
                                      <td>{formatStandingsNrr(row.nrr)}</td>
                                      <td className="league-standings-table__ro">
                                        {formatRunsOversLine(row.runsFor, row.ballsFaced)}
                                      </td>
                                      <td className="league-standings-table__ro">
                                        {formatRunsOversLine(row.runsAgainst, row.ballsBowled)}
                                      </td>
                                      <td className="league-standings-table__pts">{row.points}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <p className="league-standings-footnote muted small">
                          Points: 2 for a win, 1 for a tie. For, Against, and NRR come from published
                          scorecard lines. NR (no result) will appear when those fixtures are included
                          in the results feed.
                        </p>
                      </div>
                    )}
                  </>
                )
              ) : resultsQ.isLoading ? (
                <Spinner label="Loading match statistics..." />
              ) : (
                <div className="league-season-stats">
                  <LeagueStatsPanel
                    resultMatches={resultMatches}
                    teamIds={teamIds}
                    teamsMap={teamsMap}
                  />
                </div>
              )}
            </>
          ) : null}
        </section>
      </main>
    </>
  )
}
