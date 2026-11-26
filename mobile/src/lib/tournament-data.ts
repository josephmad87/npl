import { list, type Fixture } from './feed'
import { allPages, teamRequest } from './team-data'

export type MatchMode = 'fixtures' | 'results'
export type Tournament = { id: number; slug: string; name: string; category: string }
export type Season = { id: number; slug: string; name: string }
export type MatchPage = { items: Fixture[]; pages: number }

export const loadTournaments = (signal: AbortSignal) => allPages<Tournament>('/public/leagues', signal)

export async function loadTournament(slug: string, signal: AbortSignal) {
  return teamRequest<Tournament & { seasons: Season[] }>(`/public/leagues/${encodeURIComponent(slug)}`, signal)
}

export async function loadMatchPage(mode: MatchMode, season: number, page: number, signal: AbortSignal) {
  const response = await teamRequest<MatchPage>(`/public/${mode}?season_id=${season}&page=${page}&page_size=5`, signal)
  return { items: list<Fixture>(response), pages: response.pages }
}
