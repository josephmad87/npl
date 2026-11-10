import { API } from './feed'
export type Division = 'mens' | 'women' | 'youth'
export type Club = { id: number; name: string; slug: string; category: string; short_name?: string | null; logo_url?: string | null; home_ground?: string | null; home_ground_name?: string | null; home_ground_location?: string | null; captain?: string | null; coach?: string | null; description?: string | null }
export type Player = { id: number; full_name: string; slug: string; profile_photo_url?: string | null; role?: string | null }
export type SeasonRecord = { season_id: number; season_name: string; league_name: string; played: number; wins: number; losses: number; no_result: number }
export const divisionLabel = (value: string) => ({ mens: 'Men', women: 'Women', youth: 'Youth' })[value] || value
export function filterClubs(clubs: Club[], division: string, search: string) {
  const query = search.trim().toLocaleLowerCase()
  return clubs.filter(club => club.category === division && `${club.name} ${club.short_name || ''} ${club.home_ground_name || club.home_ground || ''} ${club.home_ground_location || ''}`.toLocaleLowerCase().includes(query))
}
export function mediaUrl(value?: string | null) {
  if (!value) return undefined
  try { const url = new URL(value, new URL(API).origin); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined } catch { return undefined }
}
export async function teamRequest<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${API}${path}`, { signal })
  if (!response.ok) throw new Error(response.status === 404 ? 'This team is no longer available.' : 'Could not connect to NPL. Please try again.')
  return response.json() as Promise<T>
}
export async function allPages<T>(path: string, signal: AbortSignal): Promise<T[]> {
  const result: T[] = []
  for (let page = 1; page <= 100; page++) {
    const payload = await teamRequest<{ items: T[]; pages: number }>(`${path}${path.includes('?') ? '&' : '?'}page=${page}&page_size=100`, signal)
    if (!Array.isArray(payload.items) || !Number.isInteger(payload.pages)) throw Error('The NPL response could not be read. Please try again.')
    result.push(...payload.items)
    if (page >= payload.pages || payload.items.length === 0) return result
  }
  throw Error('The directory is too large to load. Please try again later.')
}
export const loadClubs = (signal: AbortSignal) => allPages<Club>('/public/teams', signal)
export const clubPath = (slug: string) => `/public/teams/${encodeURIComponent(slug)}`

export type ClubSeason = { id: number; name: string; slug: string; league_name: string; start_date?: string | null; team_ids: number[] }
/** Season membership, not completed results, determines available squad seasons. */
export async function loadSeasonDirectory(signal: AbortSignal): Promise<ClubSeason[]> {
  const leagues = await allPages<{ slug: string; name: string }>('/public/leagues', signal)
  const groups = await Promise.all(leagues.map(async league => {
    const detail = await teamRequest<{ seasons: { slug: string }[] }>(`/public/leagues/${encodeURIComponent(league.slug)}`, signal)
    return Promise.all(detail.seasons.map(async season => {
      const data = await teamRequest<Omit<ClubSeason, 'league_name'>>(`/public/leagues/${encodeURIComponent(league.slug)}/seasons/${encodeURIComponent(season.slug)}`, signal)
      return { ...data, league_name: league.name }
    }))
  }))
  return groups.flat().sort((a, b) => (b.start_date || '').localeCompare(a.start_date || '') || b.id - a.id)
}
export function seasonsForClub(seasons: ClubSeason[], clubId: number) { return seasons.filter(season => season.team_ids.includes(clubId)) }
