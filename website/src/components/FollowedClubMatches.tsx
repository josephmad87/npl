import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type MatchLite, useTeamsMap } from '../lib/hooks'
import { supporterFetch } from '../lib/supporterApi'
import { MatchCard } from './MatchCard'

export function FollowedClubMatches({ account }: { account: number }) {
  const { map } = useTeamsMap()
  const matches = useQuery({
    queryKey: ['supporter', 'followed-matches', account],
    queryFn: () => supporterFetch<{ upcoming: MatchLite[]; recent: MatchLite[] }>('/supporters/followed-matches'),
    retry: 1,
  })
  const groups = [
    { title: 'Upcoming fixtures', mode: 'fixture', items: matches.data?.upcoming },
    { title: 'Recent results', mode: 'result', items: matches.data?.recent },
  ] as const
  return <section className="supporter-followed-matches" aria-labelledby="followed-clubs-title">
    <div className="live-scores-page__head">
      <h2 id="followed-clubs-title">Your clubs</h2>
      <Link to="/competition">Browse competitions</Link>
    </div>
    {matches.isLoading ? <p>Loading matches from followed clubs…</p> : null}
    {matches.isError ? <p role="alert">Could not load your matches. <button type="button" onClick={() => void matches.refetch()}>Try again</button></p> : null}
    {matches.data && !groups.some(group => group.items?.length) ? <p>Published fixtures and results from clubs you follow will appear here.</p> : null}
    {groups.map(group => group.items?.length ? <div key={group.title}>
      <h3>{group.title}</h3>
      <div className="live-scores-page__grid">{group.items.map(match => <MatchCard key={match.id} match={match} teamsMap={map} mode={group.mode} />)}</div>
    </div> : null)}
  </section>
}
