import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { EmptyState } from './EmptyState'
import { ErrorNotice } from './ErrorNotice'
import { MatchCarousel } from './MatchCarousel'
import { SectionHeader } from './SectionHeader'
import { Spinner } from './Spinner'
import type { MatchLite, TeamLite } from '../lib/hooks'
import { useTeamsMap } from '../lib/hooks'
import { fetchAllPaginatedList } from '../lib/publicApi'
import { sortFixturesByDateAsc } from '../lib/sortFixtures'

type FixturesListingProps = Readonly<{
  category?: string
}>

const LATEST_RESULTS_LIMIT = 10

function resultsLinkForCategory(category?: string): string {
  if (category === 'mens') return '/mens/results'
  if (category === 'women') return '/women/results'
  if (category === 'youth') return '/youth/results'
  return '/results'
}

export function FixturesListing({ category }: FixturesListingProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('')
  const { map: teamsMap } = useTeamsMap()
  const resultsLink = resultsLinkForCategory(category)

  const teamsQ = useQuery({
    queryKey: ['fixtures-filter-teams', category ?? 'all'],
    queryFn: () =>
      fetchAllPaginatedList<TeamLite>((page) => {
        const p = new URLSearchParams()
        p.set('page', String(page))
        p.set('page_size', '100')
        if (category) p.set('category', category)
        return `/public/teams?${p.toString()}`
      }),
    retry: 1,
  })

  const fixturesQ = useQuery({
    queryKey: ['fixtures-listing', category ?? 'all', selectedTeamId],
    queryFn: () =>
      fetchAllPaginatedList<MatchLite>((page) => {
        const p = new URLSearchParams()
        p.set('page', String(page))
        p.set('page_size', '100')
        if (category) p.set('category', category)
        if (selectedTeamId !== '') p.set('team_id', String(selectedTeamId))
        return `/public/fixtures?${p.toString()}`
      }),
    retry: 1,
  })

  const resultsQ = useQuery({
    queryKey: ['fixtures-page-results', category ?? 'all', selectedTeamId],
    queryFn: () =>
      fetchAllPaginatedList<MatchLite>(
        (page) => {
          const p = new URLSearchParams()
          p.set('page', String(page))
          p.set('page_size', String(LATEST_RESULTS_LIMIT))
          if (category) p.set('category', category)
          if (selectedTeamId !== '') p.set('team_id', String(selectedTeamId))
          return `/public/results?${p.toString()}`
        },
        1,
      ),
    retry: 1,
  })

  const teamOptions = useMemo(
    () =>
      [...(teamsQ.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [teamsQ.data],
  )

  const fixtures = useMemo(
    () => sortFixturesByDateAsc(fixturesQ.data ?? []),
    [fixturesQ.data],
  )

  const latestResults = resultsQ.data ?? []

  const fixturesLoading = fixturesQ.isLoading || teamsQ.isLoading
  const fixturesError = fixturesQ.isError || teamsQ.isError

  const teamFilter = (
    <label className="fixtures-listing__filter">
      <span className="fixtures-listing__filter-label">Filter by team</span>
      <select
        className="fixtures-listing__select"
        value={selectedTeamId === '' ? '' : String(selectedTeamId)}
        onChange={(e) => {
          const v = e.target.value
          setSelectedTeamId(v === '' ? '' : Number(v))
        }}
        disabled={teamsQ.isLoading}
      >
        <option value="">All teams</option>
        {teamOptions.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="fixtures-listing">
      <section
        className="fixtures-listing__section fixtures-carousel-section"
        aria-label="Upcoming fixtures"
      >
        <header className="fixtures-listing__header">
          <div className="fixtures-listing__heading">
            <h2 className="fixtures-listing__title">Upcoming Fixtures</h2>
            {!fixturesLoading && !fixturesError && fixtures.length > 0 ? (
              <p className="fixtures-listing__subtitle">
                {fixtures.length} scheduled — nearest first · scroll for more
              </p>
            ) : null}
          </div>
        </header>

        {fixturesLoading ? <Spinner label="Loading fixtures…" /> : null}
        {fixturesError ? <ErrorNotice message="Could not load fixtures." /> : null}

        {!fixturesLoading && !fixturesError && fixtures.length === 0 ? (
          <>
            <div className="fixtures-listing__filters">{teamFilter}</div>
            <EmptyState
              title="No fixtures to show"
              description={
                selectedTeamId !== ''
                  ? 'Try another team or view all teams.'
                  : 'Check back when the schedule is published, or browse another competition.'
              }
            />
          </>
        ) : null}

        {!fixturesLoading && !fixturesError && fixtures.length > 0 ? (
          <MatchCarousel
            matches={fixtures}
            teamsMap={teamsMap}
            mode="fixture"
            showHeader={false}
            layout="fixtures-page"
            filterSlot={teamFilter}
          />
        ) : null}
      </section>

      <section
        className="fixtures-listing__section fixtures-results-section home-match-carousel-section home-match-carousel-section--category-results"
        aria-label="Latest results"
      >
        {resultsQ.isLoading ? <Spinner label="Loading latest results…" /> : null}
        {resultsQ.isError ? (
          <ErrorNotice message="Could not load latest results." />
        ) : null}

        {!resultsQ.isLoading && !resultsQ.isError && latestResults.length === 0 ? (
          <>
            <SectionHeader title="Latest Results" linkTo={resultsLink} />
            <EmptyState
              title="No results yet"
              description="Completed matches will appear here once results are published."
            />
          </>
        ) : null}

        {!resultsQ.isLoading && !resultsQ.isError && latestResults.length > 0 ? (
          <MatchCarousel
            title="Latest Results"
            linkTo={resultsLink}
            matches={latestResults}
            teamsMap={teamsMap}
            mode="result"
          />
        ) : null}
      </section>
    </div>
  )
}
