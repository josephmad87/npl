import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { EmptyState } from './components/EmptyState'
import { ErrorNotice } from './components/ErrorNotice'
import { LiveMatchCard } from './components/LiveMatchCard'
import { PageHero } from './components/PageHero'
import { Spinner } from './components/Spinner'
import { MatchCard } from './components/MatchCard'
import { fetchAllPaginatedList, fetchJson } from './lib/publicApi'
import { type MatchLite, useTeamsMap } from './lib/hooks'
import { isUpcomingFixture } from './lib/matchday'
import { managedSection, useSitePageContent } from './lib/siteContent'

function isLiveMatch(match: MatchLite): boolean {
  return String(match.status ?? '').toLowerCase() === 'live'
}

export default function LiveScoresPage() {
  const { map: teamsMap } = useTeamsMap()
  const contentQ = useSitePageContent('live')
  const liveContent = managedSection(contentQ.data, 'live-matches', 'Live Matches')

  const fixturesQ = useQuery({
    queryKey: ['public-live-fixtures'],
    queryFn: () =>
      fetchAllPaginatedList<MatchLite>((page) =>
        `/public/fixtures?page=${page}&page_size=100`,
      ),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    retry: 1,
  })
  const resultsQ = useQuery({
    queryKey: ['public-live-recent-results'],
    queryFn: () => fetchJson<{ items: MatchLite[] }>('/public/results?page_size=3'),
    refetchInterval: 30_000,
    retry: 1,
  })
  const upcoming = (fixturesQ.data ?? []).filter(match => isUpcomingFixture(match)).slice(0, 3)
  const recent = resultsQ.data?.items ?? []

  const liveMatches = useMemo(
    () => (fixturesQ.data ?? []).filter(isLiveMatch),
    [fixturesQ.data],
  )

  return (
    <>
      <PageHero
        variant="siteLogo"
        title={contentQ.data?.title || 'Live Scores'}
        subtitle={contentQ.data?.subtitle || 'Follow every live NPL match from one matchday hub.'}
      />

      <main className="container">
        <section className="menu-page live-scores-page">
          <div className="live-scores-page__head">
            <div>
              <h2>{liveContent.heading}</h2>
            </div>
            {liveMatches.length ? <span>{liveMatches.length} live</span> : null}
          </div>

          {fixturesQ.isLoading ? <Spinner label="Loading live scores…" /> : null}

          {fixturesQ.isError ? (
            <>
              <ErrorNotice message="Could not refresh live scores. Any displayed matches may be out of date." />
              <button type="button" onClick={() => void fixturesQ.refetch()} disabled={fixturesQ.isFetching}>Try again</button>
            </>
          ) : null}

          {!fixturesQ.isLoading && !fixturesQ.isError && liveMatches.length === 0 ? (
            <EmptyState
              title="No live matches right now"
              description={upcoming.length ? undefined : 'No upcoming fixtures have been confirmed.'}
            />
          ) : null}
          {upcoming.length ? <section className="live-scores-page__group" aria-labelledby="live-upcoming">
            <div className="live-scores-page__head"><h2 id="live-upcoming">Coming up</h2><Link to="/fixtures">All fixtures</Link></div>
            <div className="live-scores-page__grid">{upcoming.map(match => <MatchCard key={match.id} match={match} teamsMap={teamsMap} mode="fixture" />)}</div>
          </section> : null}
          {recent.length ? <section className="live-scores-page__group" aria-labelledby="live-recent">
            <div className="live-scores-page__head"><h2 id="live-recent">Recent results</h2><Link to="/results">All results</Link></div>
            <div className="live-scores-page__grid">{recent.map(match => <MatchCard key={match.id} match={match} teamsMap={teamsMap} mode="result" />)}</div>
          </section> : null}

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
