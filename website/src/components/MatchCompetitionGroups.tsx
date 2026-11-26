import { useState } from 'react'
import type { MatchLite, TeamLite } from '../lib/hooks'
import { MatchCard } from './MatchCard'

type Mode = 'fixture' | 'result'
type Teams = Record<number, TeamLite>

function CompetitionGroup({ name, matches, teams, mode }: {
  name: string; matches: MatchLite[]; teams: Teams; mode: Mode
}) {
  const [open, setOpen] = useState(false)
  const [limit, setLimit] = useState(5)
  return <details className="match-competition-group" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><strong>{name}</strong><span>{matches.length} {matches.length === 1 ? mode : mode + 's'}</span></summary>
    {open ? <div className="match-competition-group__body">
      <div className="results-page__grid">
        {matches.slice(0, limit).map(match => <MatchCard key={match.id} match={match} teamsMap={teams} mode={mode} />)}
      </div>
      {matches.length > limit ? <button className="league-season-results__load-more" type="button" onClick={() => setLimit(current => current + 5)}>
        Show 5 more {mode}s
      </button> : null}
    </div> : null}
  </details>
}

export function MatchCompetitionGroups({ matches, teams, mode }: { matches: MatchLite[]; teams: Teams; mode: Mode }) {
  const groups = new Map<string, MatchLite[]>()
  for (const match of matches) {
    const name = match.season?.league?.name || match.season?.name || 'Other NPL matches'
    const current = groups.get(name)
    if (current) current.push(match)
    else groups.set(name, [match])
  }
  return <div className="match-competition-groups">
    {[...groups].map(([name, group]) => <CompetitionGroup key={name} name={name} matches={group} teams={teams} mode={mode} />)}
  </div>
}
