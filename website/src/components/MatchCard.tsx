import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { formatMatchDate, formatMatchDateTimeForResultCard, toTimeShort } from '../lib/formatters'
import {
  buildInningScoreboard,
  matchCompetitionLine,
  matchResultHeadline,
  matchResultSummaryLine,
  matchWinnerSide,
  scoreOversFromFragment,
  scoreRunsDisplayPart,
} from '../lib/match-result'
import { resolveMediaUrl } from '../lib/publicApi'
import type { MatchLite, TeamLite } from '../lib/hooks'
import nplLogoUrl from '../assets/logo.jpeg'

function TeamLogoBadge({
  logoUrl,
  variant = 'default',
}: {
  logoUrl: string | null
  variant?: 'default' | 'round'
}) {
  const initial = resolveMediaUrl(logoUrl) ?? nplLogoUrl
  const [src, setSrc] = useState(initial)
  return (
    <img
      className={
        variant === 'round'
          ? 'ui-match-card__badge ui-match-card__badge--round'
          : 'ui-match-card__badge ui-match-card__badge--lg'
      }
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

function InningsLines({ parts }: { parts: string[] }) {
  if (parts.length === 0) {
    return <span className="ui-match-card__score-empty">—</span>
  }
  const hasOvers = parts.some((p) => scoreOversFromFragment(p) != null)
  return (
    <div className="ui-match-card__innings-stack">
      <div className="ui-match-card__score-runs">
        {parts.map((p, i) => (
          <span key={i}>
            {i > 0 ? <span className="ui-match-card__amp"> & </span> : null}
            <span className="ui-match-card__runs-num">{scoreRunsDisplayPart(p)}</span>
          </span>
        ))}
      </div>
      {hasOvers ? (
        <div className="ui-match-card__score-overs">
          {parts.map((p, i) => {
            const o = scoreOversFromFragment(p)
            if (o == null) return null
            return (
              <span key={i} className="ui-match-card__overs-chunk">
                ({o})
              </span>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function ResultMatchCard({
  match,
  homeName,
  awayName,
  home,
  away,
}: {
  match: MatchLite
  homeName: string
  awayName: string
  home: TeamLite | undefined
  away: TeamLite | undefined
}) {
  const winner = matchWinnerSide(match)
  const sb = buildInningScoreboard(match)
  const headline = matchResultHeadline(match)
  const comp = matchCompetitionLine(match)
  const toss = match.toss_info?.trim()

  return (
    <Link
      to="/matches/$matchId"
      params={{ matchId: String(match.id) }}
      className="ui-match-card ui-match-card--result-sheet"
      aria-label={`${homeName} vs ${awayName}, ${headline}, open match centre`}
    >
      <div className="ui-match-card__result-grid">
        <div className="ui-match-card__scoreboard" aria-label="Scoreboard">
          <div
            className={
              winner === 'home'
                ? 'ui-match-card__team-col ui-match-card__team-col--accent'
                : 'ui-match-card__team-col'
            }
          >
            <div className="ui-match-card__team-brand">
              <TeamLogoBadge logoUrl={home?.logo_url ?? null} variant="round" />
              <span className="ui-match-card__team-nick">{homeName.toUpperCase()}</span>
            </div>
            {!sb.merged ? <InningsLines parts={sb.homeLines} /> : null}
          </div>
          <div className="ui-match-card__vs-rail" aria-hidden="true">
            <span className="ui-match-card__vs-rail-line" />
            <span className="ui-match-card__vs-rail-text">VS</span>
            <span className="ui-match-card__vs-rail-line" />
          </div>
          <div
            className={
              winner === 'away'
                ? 'ui-match-card__team-col ui-match-card__team-col--accent'
                : 'ui-match-card__team-col'
            }
          >
            <div className="ui-match-card__team-brand">
              <TeamLogoBadge logoUrl={away?.logo_url ?? null} variant="round" />
              <span className="ui-match-card__team-nick">{awayName.toUpperCase()}</span>
            </div>
            {!sb.merged ? <InningsLines parts={sb.awayLines} /> : null}
          </div>
          {sb.merged ? (
            <p className="ui-match-card__score-merged">{sb.merged}</p>
          ) : null}
        </div>
        <div className="ui-match-card__result-aside">
          <p className="ui-match-card__comp-line">{comp.toUpperCase()}</p>
          <p
            className="ui-match-card__datetime"
            title={`${formatMatchDate(match.match_date)}${match.start_time ? ` • ${toTimeShort(match.start_time)}` : ''}`}
          >
            {formatMatchDateTimeForResultCard(match)}
          </p>
          <p className="ui-match-card__venue-line" title={match.venue ?? 'Venue TBC'}>
            {match.venue ?? 'Venue TBC'}
          </p>
          <p className="ui-match-card__headline">{headline}</p>
          {toss ? <p className="ui-match-card__toss">{toss.toUpperCase()}</p> : null}
          <span className="ui-match-card__cta">Match centre</span>
        </div>
      </div>
    </Link>
  )
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

  if (mode === 'result') {
    return (
      <ResultMatchCard
        match={match}
        homeName={homeName}
        awayName={awayName}
        home={home}
        away={away}
      />
    )
  }

  const winner = matchWinnerSide(match)
  const scoreline = matchResultSummaryLine(match)
  const showScore = scoreline != null && scoreline.length > 0

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
          <TeamLogoBadge logoUrl={home?.logo_url ?? null} />
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
          <TeamLogoBadge logoUrl={away?.logo_url ?? null} />
          {winner === 'away' ? (
            <span className="ui-match-card__cup" aria-hidden title="Winner">
              🏆
            </span>
          ) : null}
        </span>
      </div>
      <div className="ui-match-card__body">
        <h3
          className="ui-match-card__title"
          title={`${homeName} vs ${awayName}`}
        >
          {homeName} vs {awayName}
        </h3>
        <div className="ui-match-card__meta">
          <span
            className="ui-match-card__meta-date"
            title={`${formatMatchDate(match.match_date)}${match.start_time ? ` • ${toTimeShort(match.start_time)}` : ''}`}
          >
            {formatMatchDate(match.match_date)}
            {match.start_time ? ` • ${toTimeShort(match.start_time)}` : ''}
          </span>
          <span
            className="ui-match-card__venue"
            title={match.venue ?? 'Venue TBC'}
          >
            {match.venue ?? 'Venue TBC'}
          </span>
          {showScore && scoreline ? (
            <span className="ui-match-card__scoreline" title={scoreline}>
              {scoreline}
            </span>
          ) : null}
        </div>
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
