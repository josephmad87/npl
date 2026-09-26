import { useState, type CSSProperties } from 'react'
import { formatMatchDate, toTimeShort } from '../lib/formatters'
import { matchSeoPath } from '../lib/matchUrls'
import { publicDisplayMatchStatus } from '../lib/matchStatus'
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
import nplLogoUrl from '../assets/logo-optimized.png'
import { ResponsiveImage } from './ResponsiveImage'

type MatchWithTeamExtras = MatchLite & {
  title?: string | null
  fixture_stage?: string | null
  home_name?: string | null
  away_name?: string | null
  home_team_placeholder?: string | null
  away_team_placeholder?: string | null
  home_team_name?: string | null
  away_team_name?: string | null
  home_logo_url?: string | null
  away_logo_url?: string | null
  home_team_logo_url?: string | null
  away_team_logo_url?: string | null
  home_team?: {
    name?: string | null
    logo_url?: string | null
  } | null
  away_team?: {
    name?: string | null
    logo_url?: string | null
  } | null
  season?: {
    name?: string | null
    slug?: string | null
    league?: {
      name?: string | null
      slug?: string | null
    } | null
  } | null
  season_name?: string | null
  league_name?: string | null
  result?: {
    player_of_match_name?: string | null
    player_of_match_player_name?: string | null
    player_of_match?: string | null
  } | null
  live_score_summary?: string | null
  live_status_line?: string | null
  live_match_cta?: string | null
}

function matchTeamName(
  match: MatchLite,
  side: 'home' | 'away',
  team: TeamLite | undefined,
): string {
  const m = match as MatchWithTeamExtras
  const fallbackId = side === 'home' ? match.home_team_id : match.away_team_id

  if (side === 'home') {
    return (
      m.home_team_placeholder ??
      team?.name ??
      m.home_team?.name ??
      m.home_name ??
      m.home_team_name ??
      `Team ${fallbackId}`
    )
  }

  return (
    m.away_team_placeholder ??
    team?.name ??
    m.away_team?.name ??
    m.away_name ??
    m.away_team_name ??
    `Team ${fallbackId}`
  )
}

function matchTeamLogo(
  match: MatchLite,
  side: 'home' | 'away',
  team: TeamLite | undefined,
): string | null {
  const m = match as MatchWithTeamExtras

  if (side === 'home') {
    if (m.home_team_placeholder) return null
    return (
      team?.logo_url ??
      m.home_team?.logo_url ??
      m.home_logo_url ??
      m.home_team_logo_url ??
      null
    )
  }

  if (m.away_team_placeholder) return null
  return (
    team?.logo_url ??
    m.away_team?.logo_url ??
    m.away_logo_url ??
    m.away_team_logo_url ??
    null
  )
}

type CrestPresentation = {
  scale: number
  translateX: number
  translateY: number
}

const DEFAULT_CREST_PRESENTATION: CrestPresentation = {
  scale: 0.76,
  translateX: 0,
  translateY: 0,
}

/**
 * Uploaded club marks are a mixture of tightly cropped transparent PNGs and
 * older JPGs with uneven white borders. Measure the visible artwork itself so
 * the mark, rather than the file canvas, is centered inside the round crest.
 */
function measureCrestPresentation(image: HTMLImageElement): CrestPresentation | null {
  const { naturalWidth, naturalHeight } = image
  if (!naturalWidth || !naturalHeight || typeof document === 'undefined') {
    return null
  }

  try {
    const longestEdge = Math.max(naturalWidth, naturalHeight)
    const sampleScale = Math.min(1, 192 / longestEdge)
    const width = Math.max(1, Math.round(naturalWidth * sampleScale))
    const height = Math.max(1, Math.round(naturalHeight * sampleScale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null

    context.drawImage(image, 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height).data
    const pixelOffset = (x: number, y: number) => (y * width + x) * 4
    const isNearlyWhite = (offset: number) =>
      pixels[offset + 3] > 230 &&
      pixels[offset] > 245 &&
      pixels[offset + 1] > 245 &&
      pixels[offset + 2] > 245

    const corners = [
      pixelOffset(0, 0),
      pixelOffset(width - 1, 0),
      pixelOffset(0, height - 1),
      pixelOffset(width - 1, height - 1),
    ]
    const hasWhiteBackdrop = corners.filter(isNearlyWhite).length >= 3

    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = pixelOffset(x, y)
        const isVisible =
          pixels[offset + 3] > 20 &&
          (!hasWhiteBackdrop || !isNearlyWhite(offset))
        if (!isVisible) continue

        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }

    if (maxX < minX || maxY < minY) return null

    const renderedWidth = (naturalWidth / longestEdge) * 100
    const renderedHeight = (naturalHeight / longestEdge) * 100
    const visibleWidth = ((maxX - minX + 1) / width) * renderedWidth
    const visibleHeight = ((maxY - minY + 1) / height) * renderedHeight
    const visibleCentreX =
      (100 - renderedWidth) / 2 + ((minX + maxX + 1) / (2 * width)) * renderedWidth
    const visibleCentreY =
      (100 - renderedHeight) / 2 + ((minY + maxY + 1) / (2 * height)) * renderedHeight
    const scale = Math.min(2.5, Math.max(0.72, 76 / Math.max(visibleWidth, visibleHeight)))

    return {
      scale,
      translateX: -(visibleCentreX - 50) * scale,
      translateY: -(visibleCentreY - 50) * scale,
    }
  } catch {
    // Keep the consistent default scale when a remote image cannot be sampled.
    return null
  }
}

function TeamLogoBadge({
  logoUrl,
  variant = 'default',
  isWinner = false,
}: {
  logoUrl: string | null
  variant?: 'default' | 'round'
  isWinner?: boolean
}) {
  const src = resolveMediaUrl(logoUrl) ?? nplLogoUrl
  const [crestPresentation, setCrestPresentation] = useState(DEFAULT_CREST_PRESENTATION)
  const crestStyle = {
    '--team-crest-scale': crestPresentation.scale,
    '--team-crest-translate-x': `${crestPresentation.translateX}%`,
    '--team-crest-translate-y': `${crestPresentation.translateY}%`,
  } as CSSProperties

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
      <span className="ui-match-card__crest">
        <ResponsiveImage
          src={src}
          alt=""
          className="ui-match-card__logo"
          style={crestStyle}
          widths={[64, 96, 128]}
          sizes="64px"
          fallbackWidth={96}
          onLoad={(event) => {
            const measured = measureCrestPresentation(event.currentTarget)
            if (!measured) return
            setCrestPresentation((current) =>
              Math.abs(current.scale - measured.scale) < 0.01 &&
              Math.abs(current.translateX - measured.translateX) < 0.01 &&
              Math.abs(current.translateY - measured.translateY) < 0.01
                ? current
                : measured,
            )
          }}
          onError={(event) => {
            event.currentTarget.onerror = null
            event.currentTarget.src = nplLogoUrl
          }}
        />
      </span>

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
  const matchWithExtras = match as MatchWithTeamExtras

  const leagueLine =
    matchWithExtras.season?.league?.name ??
    matchWithExtras.league_name ??
    competitionLine

  const seasonLine =
    matchWithExtras.season?.name ??
    matchWithExtras.season_name ??
    ''

  const playerOfMatch =
    matchWithExtras.result?.player_of_match_name ??
    matchWithExtras.result?.player_of_match_player_name ??
    matchWithExtras.result?.player_of_match ??
    null

  const homeLogoUrl = matchTeamLogo(match, 'home', home)
  const awayLogoUrl = matchTeamLogo(match, 'away', away)

  return (
    <a
      href={matchSeoPath({
        ...matchWithExtras,
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
                variant="round"
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
                variant="round"
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
  const homeName = matchTeamName(match, 'home', home)
  const awayName = matchTeamName(match, 'away', away)
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
  const displayStatus = publicDisplayMatchStatus(match.status, match.match_date)
  const winner = matchWinnerSide(match)
  const scoreline = matchResultSummaryLine(match)
  const competitionLine = matchCompetitionLine(match)
  const matchWithExtras = match as MatchWithTeamExtras
  const liveScoreSummary = matchWithExtras.live_score_summary?.trim() ?? ''
  const liveStatusLine = matchWithExtras.live_status_line?.trim() ?? ''
  const showLiveScore = displayStatus === 'live' && liveScoreSummary.length > 0
  const showScore = !showLiveScore && scoreline != null && scoreline.length > 0

  const seasonLine =
    matchWithExtras.season?.name ??
    matchWithExtras.season_name ??
    competitionLine
  const fixtureStage = matchWithExtras.title?.trim() ?? ''

  return (
    <a
      href={matchSeoPath({
        ...matchWithExtras,
        home_name: homeName,
        away_name: awayName,
      })}
      className={`ui-match-card ui-match-card--duo${
        compact ? ' ui-match-card--compact' : ''
      }`}
      aria-label={`${homeName} vs ${awayName}, open match centre`}
    >
      <div className="ui-match-card__media entity-thumb-card__media--duo">
        <TeamLogoBadge
          logoUrl={homeLogoUrl}
          isWinner={winner === 'home'}
        />

        <span className="ui-match-card__vs">vs</span>

        <TeamLogoBadge
          logoUrl={awayLogoUrl}
          isWinner={winner === 'away'}
        />
      </div>

      <div className="ui-match-card__body">
        {fixtureStage ? (
          <p className="ui-match-card__competition ui-match-card__competition--fixture">
            {fixtureStage.toUpperCase()}
          </p>
        ) : null}
        <p className="ui-match-card__competition ui-match-card__competition--fixture">
          {(seasonLine || 'NPL fixture').toUpperCase()}
        </p>

        <h3 className="ui-match-card__title ui-match-card__title--stacked">
          <span className="ui-match-card__team-line">{homeName}</span>
          <span className="ui-match-card__versus">vs</span>
          <span className="ui-match-card__team-line">{awayName}</span>
        </h3>

        <p className="ui-match-card__meta">
          <span className="ui-match-card__meta-date">
            {formatMatchDate(match.match_date)}
            {match.start_time ? ` • ${toTimeShort(match.start_time)}` : ''}
          </span>
          <span className="ui-match-card__venue ui-match-card__venue--wrap">
            {match.venue ?? 'Venue TBC'}
          </span>
        </p>

        {showLiveScore ? (
          <div className="ui-match-card__live-summary">
            <strong>{liveScoreSummary}</strong>
            {liveStatusLine ? <span>{liveStatusLine}</span> : null}
          </div>
        ) : null}

        {showScore && scoreline ? (
          <p className="ui-match-card__scoreline">{scoreline}</p>
        ) : null}
      </div>

      <div className="ui-match-card__footer">
        <span
          className={`ui-match-card__status-pill ${matchStatusPillClass(
  displayStatus,
)}`}
        >
          {formatStatusLabel(displayStatus)}
        </span>
        {showLiveScore ? (
          <span className="ui-match-card__live-cta">
            {matchWithExtras.live_match_cta?.trim() || 'Live scorecard'}
          </span>
        ) : null}
      </div>
    </a>
  )
}
