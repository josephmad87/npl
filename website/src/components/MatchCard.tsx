import { Link } from '@tanstack/react-router'
import { formatMatchDate, toTimeShort } from '../lib/formatters'
import { resolveMediaUrl } from '../lib/publicApi'
import type { MatchLite, TeamLite } from '../lib/hooks'

export function MatchCard({
  match,
  teamsMap,
  mode = 'fixture',
}: {
  match: MatchLite
  teamsMap: Record<number, TeamLite>
  mode?: 'fixture' | 'result'
}) {
  const home = teamsMap[match.home_team_id]
  const away = teamsMap[match.away_team_id]
  const hero = resolveMediaUrl(match.cover_image_url)
  const score = match.result?.score_summary ?? match.result?.innings_breakdown ?? null

  return (
    <Link to="/matches/$matchId" params={{ matchId: String(match.id) }} className={`ui-match-card ui-match-card--${mode}`}>
      {hero ? <img src={hero} alt="Match cover" /> : null}
      <div className="ui-match-card-body">
        <p className="ui-match-card-status">{match.status ?? 'scheduled'}</p>
        <h3>
          {home?.short_name ?? home?.name ?? `Team ${match.home_team_id}`} vs{' '}
          {away?.short_name ?? away?.name ?? `Team ${match.away_team_id}`}
        </h3>
        <p>
          {formatMatchDate(match.match_date)} • {toTimeShort(match.start_time)} • {match.venue ?? 'Venue TBC'}
        </p>
        {mode === 'result' && score ? <p className="ui-match-card-score">{score}</p> : null}
      </div>
    </Link>
  )
}
