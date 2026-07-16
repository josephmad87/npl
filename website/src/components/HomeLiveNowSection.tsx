import { useMemo } from 'react'

type TeamSummary = {
  id?: number
  name?: string | null
  logo_url?: string | null
}

type TeamLookup =
  | Map<number, TeamSummary>
  | Record<number, TeamSummary | undefined>
  | undefined

type HomeLiveMatch = {
  id: number
  home_team_id: number
  away_team_id: number
  status?: string | null
  match_date?: string | null
  start_time?: string | null
  venue?: string | null
  title?: string | null
  season?: {
    name?: string | null
    league?: {
      name?: string | null
    } | null
  } | null
}

type HomeLiveNowSectionProps = Readonly<{
  matches: HomeLiveMatch[]
  teamsMap: TeamLookup
}>

const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@nplzimbabwe'

function todayKey(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function matchDateKey(match: HomeLiveMatch): string {
  return String(match.match_date ?? match.start_time ?? '').slice(0, 10)
}

function normalizedStatus(match: HomeLiveMatch): string {
  return String(match.status ?? 'scheduled').trim().toLowerCase()
}

function isLiveMatch(match: HomeLiveMatch): boolean {
  return normalizedStatus(match) === 'live'
}

function isTodayMatch(match: HomeLiveMatch): boolean {
  return matchDateKey(match) === todayKey()
}

function statusLabel(match: HomeLiveMatch): string {
  const status = normalizedStatus(match)

  if (status === 'live') return 'Live now'
  if (status === 'completed') return 'Completed'
  if (isTodayMatch(match)) return 'Today'

  return status.replace(/_/g, ' ')
}

function statusClass(match: HomeLiveMatch): string {
  const status = normalizedStatus(match)

  if (status === 'live') return 'is-live'
  if (status === 'completed') return 'is-completed'
  if (isTodayMatch(match)) return 'is-today'

  return ''
}

function formatStartTime(match: HomeLiveMatch): string | null {
  if (!match.start_time) return null

  const date = new Date(match.start_time)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getTeam(teamsMap: TeamLookup, teamId: number): TeamSummary | undefined {
  if (!teamsMap) return undefined

  if (teamsMap instanceof Map) {
    return teamsMap.get(teamId)
  }

  return teamsMap[teamId]
}

function teamName(
  teamsMap: TeamLookup,
  teamId: number,
  fallback: string,
): string {
  return getTeam(teamsMap, teamId)?.name ?? fallback
}

function competitionLine(match: HomeLiveMatch): string | null {
  return [match.season?.league?.name, match.season?.name]
    .filter(Boolean)
    .join(' · ') || null
}

export function HomeLiveNowSection({
  matches,
  teamsMap,
}: HomeLiveNowSectionProps) {
  const todayMatches = useMemo(
    () =>
      matches
        .filter((match) => isLiveMatch(match) || isTodayMatch(match))
        .sort((a, b) => {
          if (isLiveMatch(a) && !isLiveMatch(b)) return -1
          if (!isLiveMatch(a) && isLiveMatch(b)) return 1

          return String(a.start_time ?? a.match_date ?? '').localeCompare(
            String(b.start_time ?? b.match_date ?? ''),
          )
        })
        .slice(0, 4),
    [matches],
  )

  return (
    <section
      className="home-section home-live-now"
      aria-labelledby="home-live-now-title"
    >
      <div className="home-live-now__header">
        <div>
          <p className="home-live-now__eyebrow">Match day</p>
          <h2 id="home-live-now-title">Live Now / Today’s Matches</h2>
          <p>
            Follow today’s NPL action, jump into the match centre, or watch NPL
            TV.
          </p>
        </div>

        <div className="home-live-now__actions">
          <a href="/fixtures">All fixtures</a>
          <a href={YOUTUBE_CHANNEL_URL} target="_blank" rel="noreferrer">
            Watch NPL TV
          </a>
        </div>
      </div>

      {todayMatches.length > 0 ? (
        <div className="home-live-now__grid">
          {todayMatches.map((match) => {
            const home = teamName(
              teamsMap,
              match.home_team_id,
              `Team ${match.home_team_id}`,
            )
            const away = teamName(
              teamsMap,
              match.away_team_id,
              `Team ${match.away_team_id}`,
            )
            const startTime = formatStartTime(match)
            const comp = competitionLine(match)

            return (
              <article key={match.id} className="home-live-now-card">
                <div className="home-live-now-card__top">
                  <span
                    className={`home-live-now-card__status ${statusClass(match)}`}
                  >
                    {isLiveMatch(match) ? (
                      <span className="home-live-now-card__pulse" />
                    ) : null}
                    {statusLabel(match)}
                  </span>

                  {startTime ? (
                    <span className="home-live-now-card__time">{startTime}</span>
                  ) : null}
                </div>

                <h3>{home}</h3>
                <p className="home-live-now-card__vs">vs</p>
                <h3>{away}</h3>

                {comp ? <p className="home-live-now-card__meta">{comp}</p> : null}
                {match.venue ? (
                  <p className="home-live-now-card__venue">{match.venue}</p>
                ) : null}

                <div className="home-live-now-card__buttons">
                  <a href={`/matches/${match.id}`}>Match Centre</a>
                  <a href={YOUTUBE_CHANNEL_URL} target="_blank" rel="noreferrer">
                    Watch
                  </a>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="home-live-now__empty">
          <p>No matches scheduled for today.</p>
          <a href="/fixtures">View upcoming fixtures</a>
        </div>
      )}
    </section>
  )
}
