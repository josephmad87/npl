import { useQuery } from '@tanstack/react-query'
import { extractList, fetchAllPaginatedList, fetchJson } from './publicApi'

export type TeamLite = {
  id: number
  name: string
  slug: string
  logo_url?: string | null
  short_name?: string | null
  category?: string | null
  cover_image_url?: string | null
  home_ground?: string | null
  home_ground_name?: string | null
  home_ground_location?: string | null
  home_ground_image_url?: string | null
  captain?: string | null
  captain_player_id?: number | null
  coach?: string | null
  coach_image_url?: string | null
  manager?: string | null
  manager_image_url?: string | null
  description?: string | null
  history?: string | null
  trophies?: string[] | null
  team_photo_urls?: string[] | null
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
  created_at?: string | null
}

export type MatchLite = {
  id: number
  season_id?: number | null
  category?: string | null
  home_team_id: number
  away_team_id: number
  title?: string | null
  venue?: string | null
  match_date?: string | null
  start_time?: string | null
  toss_info?: string | null
  status?: string
  cover_image_url?: string | null
  result?: {
    winning_team_id?: number | null
    margin_text?: string | null
    score_summary?: string | null
    innings_breakdown?: string | null
    player_of_match_player_id?: number | null
    home_extras_wides?: number
    home_extras_byes?: number
    home_extras_no_balls?: number
    home_extras_leg_byes?: number
    away_extras_wides?: number
    away_extras_byes?: number
    away_extras_no_balls?: number
    away_extras_leg_byes?: number
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
  return fetchAllPaginatedList<TeamLite>(
    (page) =>
      `/public/teams?page=${page}&page_size=100&include_inactive=true`,
  )
}

async function fetchLeagues(): Promise<LeagueLite[]> {
  const payload = await fetchJson<unknown>('/public/leagues?page=1&page_size=50')
  return extractList<LeagueLite>(payload)
}

export function useFeaturedTeams(category?: string) {
  const suffix = category
    ? `&category=${encodeURIComponent(category)}`
    : ''
  return useQuery({
    queryKey: ['featured-teams', category ?? 'all'],
    queryFn: () =>
      fetchAllPaginatedList<TeamLite>(
        (page) =>
          `/public/teams?page=${page}&page_size=24&featured=true${suffix}`,
      ),
    retry: 1,
  })
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
