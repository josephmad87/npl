import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { EmptyState } from './EmptyState'
import { ErrorNotice } from './ErrorNotice'
import { MatchCarousel } from './MatchCarousel'
import { Spinner } from './Spinner'
import type { MatchLite, TeamLite } from '../lib/hooks'
import { useTeamsMap } from '../lib/hooks'
import { fetchAllPaginatedList } from '../lib/publicApi'
import { sortFixturesByDateAsc } from '../lib/sortFixtures'

type FixturesListingProps = Readonly<{
  category?: string
}>

export function FixturesListing({ category }: FixturesListingProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('')
  const { map: teamsMap } = useTeamsMap()

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

  const teamOptions = useMemo(
    () =>
      [...(teamsQ.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [teamsQ.data],
  )

  const fixtures = useMemo(
    () => sortFixturesByDateAsc(fixturesQ.data ?? []),
    [fixturesQ.data],
  )

  const isLoading = fixturesQ.isLoading || teamsQ.isLoading
  const isError = fixturesQ.isError || teamsQ.isError

  const teamFilter = (
    <label className="fixtures-listing__filter">
      <span className="fixtures-listing__filter-label">Team</span>
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
    <>
      {isLoading ? <Spinner label="Loading fixtures…" /> : null}
      {isError ? <ErrorNotice message="Could not load fixtures." /> : null}

      {!isLoading && !isError && fixtures.length === 0 ? (
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

      {!isLoading && !isError && fixtures.length > 0 ? (
        <section
          className="fixtures-carousel-section"
          aria-label="Upcoming fixtures"
        >
          <p className="fixtures-listing__count muted">
            {fixtures.length} upcoming fixture{fixtures.length === 1 ? '' : 's'}{' '}
            — nearest first; scroll sideways to see more
          </p>
          <MatchCarousel
            matches={fixtures}
            teamsMap={teamsMap}
            mode="fixture"
            showHeader={false}
            layout="fixtures-page"
            filterSlot={teamFilter}
          />
        </section>
      ) : null}
    </>
  )
}
