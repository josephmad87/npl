import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '../lib/publicApi'

export type LiveBallEvent = {
  id: number
  match_id: number
  innings: number
  over_number: number
  ball_number: number
  batting_team_id: number
  bowling_team_id: number
  striker_player_id: number
  non_striker_player_id: number | null
  bowler_player_id: number
  runs_batter: number
  runs_extras: number
  extras_type: string | null
  is_legal_delivery: boolean
  wicket_type: string | null
  wicket_player_id: number | null
  dismissal_text: string | null
  notes: string | null
  sequence_number: number
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

export type LiveInningsSummary = {
  innings: number
  batting_team_id: number
  bowling_team_id: number
  runs: number
  wickets: number
  legal_balls: number
  overs_label: string
  last_six: string[]
  last_event: LiveBallEvent | null
}

export type LiveScoreState = {
  match_id: number
  status: string
  current_innings: number | null
  summaries: LiveInningsSummary[]
  events: LiveBallEvent[]
}

type TeamNameMap = Record<number, string | undefined>

function inningsLabel(innings: number): string {
  if (innings === 1) return '1st innings'
  if (innings === 2) return '2nd innings'
  if (innings === 3) return '3rd innings'
  return `${innings}th innings`
}

function scoreLine(summary: LiveInningsSummary | null): string {
  if (!summary) return '0/0 (0.0)'
  return `${summary.runs}/${summary.wickets} (${summary.overs_label})`
}

function teamName(teamId: number | null | undefined, teamNames: TeamNameMap): string {
  if (teamId == null) return 'Team'
  return teamNames[teamId] ?? `Team ${teamId}`
}

function deliveryLabel(event: LiveBallEvent): string {
  const runs = event.runs_batter + event.runs_extras

  if (event.wicket_type) {
    return event.dismissal_text?.trim() || 'Wicket'
  }

  if (event.extras_type) {
    return `${runs} ${event.extras_type.replaceAll('_', ' ')}`
  }

  if (runs === 0) return 'Dot ball'
  if (runs === 1) return '1 run'
  return `${runs} runs`
}

function deliveryScoreToken(event: LiveBallEvent): string {
  if (event.wicket_type) return 'W'
  if (event.extras_type) {
    const code = event.extras_type.replaceAll('_', ' ').slice(0, 2).toUpperCase()
    return `${event.runs_extras}${code}`
  }
  return String(event.runs_batter)
}

function latestSummary(state: LiveScoreState | undefined): LiveInningsSummary | null {
  const summaries = state?.summaries ?? []
  if (summaries.length === 0) return null

  const current = state?.current_innings
  return summaries.find((summary) => summary.innings === current) ?? summaries[summaries.length - 1] ?? null
}

export function LiveScorePanel({
  matchId,
  matchStatus,
  homeTeamId,
  awayTeamId,
  homeName,
  awayName,
  showEvents = true,
}: {
  matchId: number
  matchStatus?: string | null
  homeTeamId: number
  awayTeamId: number
  homeName: string
  awayName: string
  showEvents?: boolean
}) {
  const isLive = String(matchStatus ?? '').toLowerCase() === 'live'

  const liveQ = useQuery({
    queryKey: ['public-live-score', matchId],
    queryFn: () => fetchJson<LiveScoreState>(`/public/matches/${matchId}/live`),
    enabled: Number.isFinite(matchId),
    refetchInterval: isLive ? 15_000 : false,
    retry: 1,
  })

  const teamNames = useMemo(
    () => ({
      [homeTeamId]: homeName,
      [awayTeamId]: awayName,
    }),
    [awayName, awayTeamId, homeName, homeTeamId],
  )

  const activeSummary = latestSummary(liveQ.data)
  const recentEvents = useMemo(
    () => [...(liveQ.data?.events ?? [])].slice(-12).reverse(),
    [liveQ.data?.events],
  )

  const lastEvent = activeSummary?.last_event ?? recentEvents[0] ?? null

  return (
    <section className="live-score-panel" aria-label="Live score">
      <div className="live-score-panel__head">
        <div>
          <p className="live-score-panel__eyebrow">Live score</p>
          <h2>
            {activeSummary
              ? `${teamName(activeSummary.batting_team_id, teamNames)} ${scoreLine(activeSummary)}`
              : isLive
                ? 'Scorer warming up'
                : 'Live score'}
          </h2>
        </div>
        <span className={`live-score-panel__status${isLive ? ' is-live' : ''}`}>
          {isLive ? 'LIVE' : String(matchStatus ?? liveQ.data?.status ?? 'Scheduled').toUpperCase()}
        </span>
      </div>

      {liveQ.isLoading ? (
        <p className="live-score-panel__muted">Loading live score…</p>
      ) : null}

      {liveQ.isError ? (
        <p className="live-score-panel__muted">Live scoring is not available yet.</p>
      ) : null}

      {!liveQ.isLoading && !liveQ.isError ? (
        <>
          {activeSummary ? (
            <div className="live-score-panel__summary-grid">
              <article>
                <span>Batting</span>
                <strong>{teamName(activeSummary.batting_team_id, teamNames)}</strong>
                <p>{scoreLine(activeSummary)}</p>
              </article>
              <article>
                <span>Bowling</span>
                <strong>{teamName(activeSummary.bowling_team_id, teamNames)}</strong>
                <p>{inningsLabel(activeSummary.innings)}</p>
              </article>
              <article>
                <span>Last ball</span>
                <strong>{lastEvent ? deliveryLabel(lastEvent) : '—'}</strong>
                <p>{lastEvent ? `Ball ${lastEvent.over_number}.${lastEvent.ball_number}` : 'No deliveries yet'}</p>
              </article>
            </div>
          ) : (
            <p className="live-score-panel__muted">
              {isLive
                ? 'The match is marked live. Ball-by-ball updates will appear as soon as the scorer records the first delivery.'
                : 'No live scoring events have been recorded for this match yet.'}
            </p>
          )}

          {activeSummary?.last_six?.length ? (
            <div className="live-score-panel__last-six" aria-label="Recent balls">
              <span>Last balls</span>
              <div>
                {activeSummary.last_six.map((ball, index) => (
                  <strong key={`${ball}-${index}`}>{ball}</strong>
                ))}
              </div>
            </div>
          ) : null}

          {showEvents && recentEvents.length > 0 ? (
            <div className="live-score-panel__timeline">
              <h3>Ball-by-ball</h3>
              <ol>
                {recentEvents.map((event) => (
                  <li key={event.id}>
                    <span>{event.over_number}.{event.ball_number}</span>
                    <strong>{deliveryScoreToken(event)}</strong>
                    <p>{deliveryLabel(event)}</p>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
