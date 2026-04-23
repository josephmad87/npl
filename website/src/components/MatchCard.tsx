import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { formatMatchDate, toTimeShort } from '../lib/formatters'
import { matchResultSummaryLine, matchWinnerSide } from '../lib/match-result'
import { resolveMediaUrl } from '../lib/publicApi'
import type { MatchLite, TeamLite } from '../lib/hooks'
import nplLogoUrl from '../assets/logo.jpeg'

function TeamLogoBadge({ logoUrl }: { logoUrl: string | null }) {
  const initial = resolveMediaUrl(logoUrl) ?? nplLogoUrl
  const [src, setSrc] = useState(initial)
  return (
    <img
      className="ui-match-card__badge ui-match-card__badge--lg"
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setSrc(nplLogoUrl)}
    />
  )
}

function matchStatusPillClass(status: string | undefined): string {
  const s = (status ?? 'scheduled').toLowerCase()
  if (s === 'completed') return 'ui-match-card__status-pill--completed'
  if (s === 'live') return 'ui-match-card__status-pill--live'
  if (s === 'postponed' || s === 'abandoned' || s === 'cancelled') {
    return 'ui-match-card__status-pill--inactive'
  }
  return 'ui-match-card__status-pill--scheduled'
}

function formatStatusLabel(status: string | undefined): string {
  return (status ?? 'scheduled').replaceAll('_', ' ').toUpperCase()
}

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
  const homeName = home?.name ?? `Team ${match.home_team_id}`
  const awayName = away?.name ?? `Team ${match.away_team_id}`
  const winner = matchWinnerSide(match)
  const scoreline = matchResultSummaryLine(match)
  const showScore =
    mode === 'result' && scoreline != null && scoreline.length > 0

  return (
    <Link
      to="/matches/$matchId"
      params={{ matchId: String(match.id) }}
      className={`ui-match-card ui-match-card--duo ui-match-card--${mode}`}
    >
      <div className="ui-match-card__media">
        <span
          className={`ui-match-card__badge-wrap${
            winner === 'home' ? ' ui-match-card__badge-wrap--winner' : ''
          }`}
          aria-label={winner === 'home' ? 'Winner' : undefined}
        >
          <TeamLogoBadge key={`${match.id}-home`} logoUrl={home?.logo_url ?? null} />
          {winner === 'home' ? (
            <span className="ui-match-card__cup" aria-hidden title="Winner">
              🏆
            </span>
          ) : null}
        </span>
        <span className="ui-match-card__vs">vs</span>
        <span
          className={`ui-match-card__badge-wrap${
            winner === 'away' ? ' ui-match-card__badge-wrap--winner' : ''
          }`}
          aria-label={winner === 'away' ? 'Winner' : undefined}
        >
          <TeamLogoBadge key={`${match.id}-away`} logoUrl={away?.logo_url ?? null} />
          {winner === 'away' ? (
            <span className="ui-match-card__cup" aria-hidden title="Winner">
              🏆
            </span>
          ) : null}
        </span>
      </div>
      <div className="ui-match-card__body">
        <h3 className="ui-match-card__title">
          {homeName} vs {awayName}
        </h3>
        <p className="ui-match-card__meta">
          {formatMatchDate(match.match_date)}
          {match.start_time ? ` • ${toTimeShort(match.start_time)}` : ''}
          <br />
          {match.venue ?? 'Venue TBC'}
          {showScore ? (
            <>
              <br />
              <span className="ui-match-card__scoreline">{scoreline}</span>
            </>
          ) : null}
        </p>
      </div>
      <div className="ui-match-card__footer">
        <span
          className={`ui-match-card__status-pill ${matchStatusPillClass(match.status)}`}
        >
          {formatStatusLabel(match.status)}
        </span>
      </div>
    </Link>
  )
}
