import { useQuery } from '@tanstack/react-query'
import { extractList, fetchJson } from './publicApi'

export type TeamLite = {
  id: number
  name: string
  slug: string
  logo_url?: string | null
  short_name?: string | null
  category?: string | null
  cover_image_url?: string | null
  home_ground?: string | null
  captain?: string | null
  coach?: string | null
  description?: string | null
  year_founded?: number | null
}

export type LeagueLite = {
  id: number
  name: string
  slug: string
  banner_url?: string | null
  logo_url?: string | null
  category?: string | null
  description?: string | null
}

export type SeasonLite = {
  id: number
  league_id: number
  name: string
  slug: string
  start_date?: string | null
  end_date?: string | null
  status?: string | null
  team_ids?: number[]
}

export type ArticleLite = {
  id: number
  title: string
  slug: string
  excerpt?: string | null
  featured_image_url?: string | null
  category?: string | null
  tags?: string[] | null
  published_at?: string | null
}

export type MatchLite = {
  id: number
  season_id?: number | null
  category?: string | null
  home_team_id: number
  away_team_id: number
  venue?: string | null
  match_date?: string | null
  start_time?: string | null
  status?: string
  cover_image_url?: string | null
  result?: {
    winning_team_id?: number | null
    margin_text?: string | null
    score_summary?: string | null
    innings_breakdown?: string | null
    player_of_match_player_id?: number | null
  } | null
  season?: {
    id: number
    league_id?: number
    name?: string
    slug?: string
    league?: { id: number; name: string; slug: string } | null
  } | null
  player_stats?: Array<Record<string, unknown>>
}

async function fetchTeams(): Promise<TeamLite[]> {
  const payload = await fetchJson<unknown>('/public/teams?page=1&page_size=100')
  return extractList<TeamLite>(payload)
}

async function fetchLeagues(): Promise<LeagueLite[]> {
  const payload = await fetchJson<unknown>('/public/leagues?page=1&page_size=50')
  return extractList<LeagueLite>(payload)
}

export function useTeamsMap() {
  const query = useQuery({
    queryKey: ['teams-map'],
    queryFn: fetchTeams,
    retry: 1,
  })

  const map = (query.data ?? []).reduce<Record<number, TeamLite>>((acc, team) => {
    acc[team.id] = team
    return acc
  }, {})

  return { ...query, map }
}

export function useLeaguesMap() {
  const query = useQuery({
    queryKey: ['leagues-map'],
    queryFn: fetchLeagues,
    retry: 1,
  })

  const map = (query.data ?? []).reduce<Record<number, LeagueLite>>((acc, league) => {
    acc[league.id] = league
    return acc
  }, {})

  return { ...query, map }
}

export function useRecentNews(limit = 6, category?: string) {
  const suffix = category ? `&category=${encodeURIComponent(category)}` : ''
  return useQuery({
    queryKey: ['recent-news', limit, category ?? 'all'],
    queryFn: async () => {
      const payload = await fetchJson<unknown>(`/public/news?page=1&page_size=${limit}${suffix}`)
      return extractList<ArticleLite>(payload)
    },
    retry: 1,
  })
}

export function useUpcomingFixtures(category?: string, limit = 6) {
  const suffix = category ? `&category=${encodeURIComponent(category)}` : ''
  return useQuery({
    queryKey: ['upcoming-fixtures', category ?? 'all', limit],
    queryFn: async () => {
      const payload = await fetchJson<unknown>(`/public/fixtures?page=1&page_size=${limit}${suffix}`)
      return extractList<MatchLite>(payload)
    },
    retry: 1,
  })
}

export function useLatestResults(category?: string, limit = 6) {
  const suffix = category ? `&category=${encodeURIComponent(category)}` : ''
  return useQuery({
    queryKey: ['latest-results', category ?? 'all', limit],
    queryFn: async () => {
      const payload = await fetchJson<unknown>(`/public/results?page=1&page_size=${limit}${suffix}`)
      return extractList<MatchLite>(payload)
    },
    retry: 1,
  })
}
