import type { Fixture, Team } from '../lib/feed'
import { useLiveMatch } from '../lib/match-data'
import { MatchCard } from './match-card'

export function LiveMatchCard({ match, teams, featured = false }: { match: Fixture; teams: Team[]; featured?: boolean }) {
  const live = useLiveMatch(match.id, true)
  return <MatchCard match={match} teams={teams} featured={featured} live={live.data}
    updatedAt={live.checkedAt} delayed={Boolean(live.error)} />
}
