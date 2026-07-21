import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { fetchJson, resolveMediaUrl } from '../lib/publicApi'
import type { LiveScoreState, LiveInningsSummary } from './LiveScorePanel'

type TeamLookup = Record<
  number,
  | {
      name?: string | null
      logo_url?: string | null
    }
  | undefined
>

type LiveMatchLite = {
  id: number
  status?: string | null
  category?: string | null
  match_date?: string | null
  start_time?: string | null
  venue?: string | null
  home_team_id: number
  away_team_id: number
}

function latestSummary(state: LiveScoreState | undefined): LiveInningsSummary | null {
  const summaries = state?.summaries ?? []
  if (summaries.length === 0) return null

  const current = state?.current_innings
  return summaries.find((summary) => summary.innings === current) ?? summaries[summaries.length - 1] ?? null
}

function teamInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function scoreLine(summary: LiveInningsSummary | null): string {
  if (!summary) return 'Live score starting soon'
  return `${summary.runs}/${summary.wickets} after ${summary.overs_label} overs`
}

function liveTimeLabel(match: LiveMatchLite): string {
  const raw = match.start_time ?? match.match_date ?? ''
  if (!raw) return 'Time TBC'
  if (raw.length <= 10) return raw
  return raw.slice(0, 16).replace('T', ' ')
}

function TeamBadge({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const src = resolveMediaUrl(logoUrl)

  return (
    <span className="live-match-card__team-badge">
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <span>{teamInitials(name)}</span>}
    </span>
  )
}

export function LiveMatchCard({
  match,
  teamsMap,
  compact = false,
}: {
  match: LiveMatchLite
  teamsMap: TeamLookup
  compact?: boolean
}) {
  const liveQ = useQuery({
    queryKey: ['public-live-score-card', match.id],
    queryFn: () => fetchJson<LiveScoreState>(`/public/matches/${match.id}/live`),
    enabled: Number.isFinite(match.id),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    retry: 1,
  })

  const home = teamsMap[match.home_team_id]
  const away = teamsMap[match.away_team_id]
  const homeName = home?.name ?? `Team ${match.home_team_id}`
  const awayName = away?.name ?? `Team ${match.away_team_id}`
  const summary = latestSummary(liveQ.data)

  const battingTeamName = useMemo(() => {
    if (!summary) return null
    if (summary.batting_team_id === match.home_team_id) return homeName
    if (summary.batting_team_id === match.away_team_id) return awayName
    return `Team ${summary.batting_team_id}`
  }, [awayName, homeName, match.away_team_id, match.home_team_id, summary])

  return (
    <Link
      to="/matches/$matchId"
      params={{ matchId: String(match.id) }}
      className={`live-match-card${compact ? ' live-match-card--compact' : ''}`}
    >
      <div className="live-match-card__topline">
        <span className="live-match-card__live-dot">LIVE</span>
        <span>{liveTimeLabel(match)}</span>
      </div>

      <div className="live-match-card__teams">
        <TeamBadge name={homeName} logoUrl={home?.logo_url ?? null} />
        <div>
          <strong>{homeName}</strong>
          <span>vs</span>
          <strong>{awayName}</strong>
        </div>
        <TeamBadge name={awayName} logoUrl={away?.logo_url ?? null} />
      </div>

      <div className="live-match-card__score">
        <span>{battingTeamName ?? 'Current score'}</span>
        <strong>{liveQ.isLoading ? 'Loading…' : scoreLine(summary)}</strong>
      </div>

      {summary?.last_six?.length ? (
        <div className="live-match-card__balls">
          {summary.last_six.map((ball, index) => (
            <span key={`${ball}-${index}`}>{ball}</span>
          ))}
        </div>
      ) : null}

      <p className="live-match-card__venue">{match.venue || 'Venue TBC'}</p>
    </Link>
  )
}
