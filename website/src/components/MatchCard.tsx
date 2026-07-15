import { useState } from 'react'
import { formatMatchDate, toTimeShort } from '../lib/formatters'
import { matchSeoPath } from '../lib/matchUrls'
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
import nplLogoUrl from '../assets/logo.png'

function TeamLogoBadge({
  logoUrl,
  variant = 'default',
  isWinner = false,
}: {
  logoUrl: string | null
  variant?: 'default' | 'round'
  isWinner?: boolean
}) {
  const initial = resolveMediaUrl(logoUrl) ?? nplLogoUrl
  const [src, setSrc] = useState(initial)

  return (
    <span
      className={[
        'ui-match-card__logo-wrap',
        variant === 'round' ? 'ui-match-card__logo-wrap--round' : '',
        isWinner ? 'ui-match-card__logo-wrap--winner' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className="ui-match-card__logo"
        onError={() => setSrc(nplLogoUrl)}
      />
      {isWinner ? (
        <span
          className="ui-match-card__winner-cup"
          aria-hidden
          title="Winner"
        >
          🏆
        </span>
      ) : null}
    </span>
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
    return <span>—</span>
  }

  const hasOvers = parts.some((p) => scoreOversFromFragment(p) != null)

  return (
    <span className="ui-match-card__innings-lines">
      <span>
        {parts.map((p, i) => (
          <span key={`${p}-${i}`}>
            {i > 0 ? ' & ' : null}
            {scoreRunsDisplayPart(p)}
          </span>
        ))}
      </span>

      {hasOvers ? (
        <span className="ui-match-card__innings-overs">
          {parts.map((p, i) => {
            const overs = scoreOversFromFragment(p)
            if (overs == null) return null

            return (
              <span key={`${p}-${i}`}>
                {i > 0 ? ' & ' : null}
                ({overs})
              </span>
            )
          })}
        </span>
      ) : null}
    </span>
  )
}

function matchTeamLogo(
  match: MatchLite,
  side: 'home' | 'away',
  team: TeamLite | undefined,
): string | null {
  const m = match as MatchLite & {
    home_team?: { logo_url?: string | null } | null
    away_team?: { logo_url?: string | null } | null
    home_logo_url?: string | null
    away_logo_url?: string | null
    home_team_logo_url?: string | null
    away_team_logo_url?: string | null
  }

  if (side === 'home') {
    return (
      team?.logo_url ??
      m.home_team?.logo_url ??
      m.home_logo_url ??
      m.home_team_logo_url ??
      null
    )
  }

  return (
    team?.logo_url ??
    m.away_team?.logo_url ??
    m.away_logo_url ??
    m.away_team_logo_url ??
    null
  )
}

export function ResultMatchCard({
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
  const scoreboard = buildInningScoreboard(match)
  const headline = matchResultHeadline(match, { homeName, awayName })
  const competitionLine = matchCompetitionLine(match)

  const matchWithSeason = match as MatchLite & {
    season?: {
      name?: string | null
      league?: {
        name?: string | null
      } | null
    } | null
    season_name?: string | null
    league_name?: string | null
  }

  const leagueLine =
    matchWithSeason.season?.league?.name ??
    matchWithSeason.league_name ??
    competitionLine

  const seasonLine =
    matchWithSeason.season?.name ??
    matchWithSeason.season_name ??
    ''

  const resultWithPlayer = match.result as
    | {
        player_of_match_name?: string | null
        player_of_match_player_name?: string | null
        player_of_match?: string | null
      }
    | null
    | undefined

  const playerOfMatch =
    resultWithPlayer?.player_of_match_name ??
    resultWithPlayer?.player_of_match_player_name ??
    resultWithPlayer?.player_of_match ??
    null

  return (
    <a
      href={matchSeoPath({
        ...match,
        home_name: homeName,
        away_name: awayName,
      })}
      className="ui-match-card ui-match-card--result-sheet ui-match-card--result-redesign"
      aria-label={`${homeName} vs ${awayName}, open match centre`}
    >
      <div className="ui-match-card__result-grid">
        <div className="ui-match-card__result-teams-panel">
          <div className="ui-match-card__result-teams-row">
            <div
              className={
                winner === 'home'
                  ? 'ui-match-card__team-col ui-match-card__team-col--accent'
                  : 'ui-match-card__team-col'
              }
            >
             <TeamLogoBadge
  logoUrl={homeLogoUrl}
  isWinner={winner === 'home'}
/>
              <span className="ui-match-card__team-name">
                {homeName.toUpperCase()}
              </span>
            </div>

            <span className="ui-match-card__vs">VS</span>

            <div
              className={
                winner === 'away'
                  ? 'ui-match-card__team-col ui-match-card__team-col--accent'
                  : 'ui-match-card__team-col'
              }
            >
             <TeamLogoBadge
  logoUrl={awayLogoUrl}
  isWinner={winner === 'away'}
/>
              <span className="ui-match-card__team-name">
                {awayName.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="ui-match-card__result-fixture-info">
            <p className="ui-match-card__competition ui-match-card__competition--fixture">
              {(leagueLine || 'NPL match').toUpperCase()}
            </p>

            {seasonLine ? (
              <p className="ui-match-card__season-line">
                {seasonLine.toUpperCase()}
              </p>
            ) : null}

            <p className="ui-match-card__meta">
              {formatMatchDate(match.match_date)}
              {match.start_time ? ` • ${toTimeShort(match.start_time)}` : ''}
              <br />
              {match.venue ?? 'Venue TBC'}
            </p>
          </div>
        </div>

        <div className="ui-match-card__result-summary-panel">
          <p className="ui-match-card__result-label">Result</p>

          <h3 className="ui-match-card__headline">{headline}</h3>

          {scoreboard.merged ? (
            <p className="ui-match-card__merged-score">{scoreboard.merged}</p>
          ) : (
            <div className="ui-match-card__result-score-pair">
              <InningsLines parts={scoreboard.homeLines} />
              <InningsLines parts={scoreboard.awayLines} />
            </div>
          )}

          {playerOfMatch ? (
            <p className="ui-match-card__player-of-match">
              <span>Player of the match</span>
              <strong>{playerOfMatch}</strong>
            </p>
          ) : null}

          <span className="ui-match-card__match-centre-button">
            Match centre
          </span>
        </div>
      </div>
    </a>
  )
}

export function MatchCard({
  match,
  teamsMap,
  mode = 'fixture',
  compact = false,
}: {
  match: MatchLite
  teamsMap: Record<number, TeamLite | undefined>
  mode?: 'fixture' | 'result'
  compact?: boolean
}) {
 const home = teamsMap[match.home_team_id]
const away = teamsMap[match.away_team_id]
const homeName = home?.name ?? match.home_name ?? match.home_team_name ?? `Team ${match.home_team_id}`
const awayName = away?.name ?? match.away_name ?? match.away_team_name ?? `Team ${match.away_team_id}`
const homeLogoUrl = matchTeamLogo(match, 'home', home)
const awayLogoUrl = matchTeamLogo(match, 'away', away)

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
  const competitionLine = matchCompetitionLine(match)

  const seasonLine =
    (
      match as MatchLite & {
        season?: { name?: string | null } | null
        season_name?: string | null
      }
    ).season?.name ??
    (
      match as MatchLite & {
        season_name?: string | null
      }
    ).season_name ??
    competitionLine

  return (
    <a
      href={matchSeoPath({
        ...match,
        home_name: homeName,
        away_name: awayName,
      })}
      className={`ui-match-card ui-match-card--duo${compact ? ' ui-match-card--compact' : ''}`}
      aria-label={`${homeName} vs ${awayName}, open match centre`}
    >
      <div className="ui-match-card__media entity-thumb-card__media--duo">
        <TeamLogoBadge
          logoUrl={home?.logo_url ?? null}
          isWinner={winner === 'home'}
        />
        <span className="ui-match-card__vs">vs</span>
        <TeamLogoBadge
          logoUrl={away?.logo_url ?? null}
          isWinner={winner === 'away'}
        />
      </div>

      <div className="ui-match-card__body">
        <p className="ui-match-card__competition ui-match-card__competition--fixture">
          {(seasonLine || 'NPL fixture').toUpperCase()}
        </p>

        <h3 className="ui-match-card__title">
          {homeName} vs {awayName}
        </h3>

        <p className="ui-match-card__meta">
          {formatMatchDate(match.match_date)}
          {match.start_time ? ` • ${toTimeShort(match.start_time)}` : ''}
          <br />
          {match.venue ?? 'Venue TBC'}
        </p>

        {showScore && scoreline ? (
          <p className="ui-match-card__scoreline">{scoreline}</p>
        ) : null}
      </div>

      <div className="ui-match-card__footer">
        <span
          className={`ui-match-card__status-pill ${matchStatusPillClass(
            match.status,
          )}`}
        >
          {formatStatusLabel(match.status)}
        </span>
      </div>
    </a>
  )
}
