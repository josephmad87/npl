export const API = process.env.EXPO_PUBLIC_API_URL || 'https://npl-dbd64439b135.herokuapp.com/api/v1'
export type Fixture = {
  id: number
  season?: { id: number; name: string; slug: string; league?: { id: number; name: string; slug: string } } | null
  home_team_placeholder?: string | null
  away_team_placeholder?: string | null
  home_team_id: number
  away_team_id: number
  status?: string
  match_date?: string | null
  start_time?: string | null
  venue?: string | null
  title?: string | null
  match_overs?: string | number | null
  result?: { score_summary?: string; winning_team_id?: number; margin_text?: string } | null
}
export type Team = { id: number; name: string; logo_url?: string | null }
export type Article = { id: number; slug: string; title: string; excerpt?: string; featured_image_url?: string | null; published_at?: string | null; created_at?: string }
export function list<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object' && 'items' in value && Array.isArray(value.items)) return value.items as T[]
  throw new Error('Unexpected feed response')
}
export async function read<T>(path: string, signal: AbortSignal): Promise<T[]> {
  const response = await fetch(`${API}${path}`, { signal })
  if (!response.ok) throw new Error(`Feed unavailable (${response.status})`)
  return list<T>(await response.json())
}
