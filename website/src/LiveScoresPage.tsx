import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { EmptyState } from './components/EmptyState'
import { ErrorNotice } from './components/ErrorNotice'
import { LiveMatchCard } from './components/LiveMatchCard'
import { PageHero } from './components/PageHero'
import { Spinner } from './components/Spinner'
import { fetchAllPaginatedList } from './lib/publicApi'
import { useTeamsMap } from './lib/hooks'

type LiveFixture = {
  id: number
  status?: string | null
  category?: string | null
  match_date?: string | null
  start_time?: string | null
  venue?: string | null
  home_team_id: number
  away_team_id: number
}

function isLiveMatch(match: LiveFixture): boolean {
  return String(match.status ?? '').toLowerCase() === 'live'
}

export default function LiveScoresPage() {
  const { map: teamsMap } = useTeamsMap()

  const fixturesQ = useQuery({
    queryKey: ['public-live-fixtures'],
    queryFn: () =>
      fetchAllPaginatedList<LiveFixture>((page) =>
        `/public/fixtures?page=${page}&page_size=100`,
      ),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    retry: 1,
  })

  const liveMatches = useMemo(
    () => (fixturesQ.data ?? []).filter(isLiveMatch),
    [fixturesQ.data],
  )

  return (
    <>
      <PageHero
        variant="siteLogo"
        title="Live Scores"
        subtitle="Follow every live NPL match from one matchday hub."
      />

      <main className="container">
        <section className="menu-page live-scores-page">
          <div className="live-scores-page__head">
            <div>
              <p className="live-score-panel__eyebrow">Ball-by-ball updates</p>
              <h1>Live matches</h1>
            </div>
            <span>{liveMatches.length} live</span>
          </div>

          {fixturesQ.isLoading ? <Spinner label="Loading live scores…" /> : null}

          {fixturesQ.isError ? (
            <ErrorNotice message="Could not load live scores." />
          ) : null}

          {!fixturesQ.isLoading && !fixturesQ.isError && liveMatches.length === 0 ? (
            <EmptyState
              title="No live matches right now"
              description="When scorers start ball-by-ball scoring, live matches will appear here automatically."
            />
          ) : null}

          {liveMatches.length > 0 ? (
            <div className="live-scores-page__grid">
              {liveMatches.map((match) => (
                <LiveMatchCard key={match.id} match={match} teamsMap={teamsMap} />
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </>
  )
}
