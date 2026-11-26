export type Division = 'mens' | 'women' | 'youth'
export type SeasonSection = 'fixtures' | 'results' | 'standings' | 'stats' | 'teams'
export const legalPaths: Record<string, string> = {
  '/about-us': 'About the league',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms',
  '/support': 'Account help',
  '/account-deletion': 'Account deletion',
  '/safeguarding': 'Safeguarding',
  '/scorecard-corrections': 'Scorecard corrections',
  '/supporters': 'Supporter information',
}

const origin = 'https://npl.co.zw'

export function nplPath(input: string): string | undefined {
  if (!(input.startsWith('/') || /^https?:\/\//i.test(input))) return undefined
  if (input.startsWith('//') || input.includes('\\')) return undefined
  try {
    const url = new URL(input, origin)
    if (!['https:', 'http:'].includes(url.protocol) || !['npl.co.zw', 'www.npl.co.zw'].includes(url.hostname) || url.port || url.username || url.password) return
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    return pathname + url.search + url.hash
  } catch {
    return undefined
  }
}

export type NativePath =
  | { page: 'home' | 'live' | 'contact' | 'compare' | 'unknown' }
  | { page: 'news'; query?: string }
  | { page: 'competition' | 'teams'; division?: Division }
  | { page: 'matches'; division?: Division; mode: 'fixtures' | 'results' }
  | { page: 'match'; id: number; section?: string }
  | { page: 'account'; deletion: boolean }
  | { page: 'league'; slug: string; season?: string; section?: SeasonSection }
  | { page: 'story' | 'team' | 'player'; slug: string }
  | { page: 'gallery'; media: 'image' | 'video'; item?: string; matchId?: number }
  | { page: 'search'; query: string; filter?: string }
  | { page: 'legal'; slug: string; title: string }
  | { page: 'merchandise'; product?: number; team?: string; teamId?: number; order?: string; token?: string }

export function resolveNativePath(input: string, section?: string): NativePath {
  const relative = nplPath(input)
  if (!relative) return { page: 'unknown' }
  const url = new URL(relative, origin)
  const bits = url.pathname.split('/').filter(Boolean)
  let [first, second, third, fourth, fifth] = bits
  if (!first) return { page: 'home' }
  if (first === 'ladies') first = 'women'
  const division = first === 'mens' || first === 'women' || first === 'youth' ? first : undefined
  const anchor = url.hash.slice(1)
  const matchId = first === 'matches' ? second : first === 'leagues' && third === 'seasons' && fifth === 'matches' ? bits[5] : undefined
  if (matchId && /^\d+$/.test(matchId)) return { page: 'match', id: Number(matchId), section: section || anchor }
  if (division) {
    if (second === 'teams') return { page: 'teams', division }
    if (second === 'results' || second === 'fixtures') return { page: 'matches', division, mode: second }
    const league = url.searchParams.get('leagueSlug')
    if (second === 'seasons' && league) return { page: 'league', slug: league }
    return { page: 'competition', division }
  }
  if (first === 'results' || first === 'fixtures') return { page: 'matches', mode: first }
  if (first === 'live') return { page: 'live' }
  if (first === 'my-npl') return { page: 'account', deletion: anchor === 'delete-account-heading' }
  if (first === 'teams' && !second) return { page: 'teams' }
  if (first === 'teams' && second) return { page: 'team', slug: second }
  if (first === 'players' && second) return { page: 'player', slug: second }
  if (first === 'players') return { page: 'search', query: url.searchParams.get('q') || '', filter: 'player' }
  if (first === 'news') return second ? { page: 'story', slug: second } : { page: 'news', query: url.searchParams.get('q') || undefined }
  if (first === 'competition' || first === 'leagues') {
    if (!second) return { page: 'competition' }
    const target = section || anchor.replace(/^league-tab-/, '')
    const picked = target === 'fixtures' || target === 'results' || target === 'standings' || target === 'stats' || target === 'teams' ? target : undefined
    return { page: 'league', slug: second, season: third === 'seasons' ? fourth : undefined, section: picked }
  }
  if (first === 'gallery') return {
    page: 'gallery', media: second === 'video' ? 'video' : 'image',
    item: url.searchParams.get('item') || (second && !['images', 'video'].includes(second) ? second : undefined),
    matchId: Number(url.searchParams.get('match_id')) || undefined,
  }
  if (first === 'search') return { page: 'search', query: url.searchParams.get('q') || '', filter: url.searchParams.get('type') || undefined }
  if (first === 'compare-teams') return { page: 'compare' }
  if (first === 'contact-us') return { page: 'contact' }
  if (first === 'merchandise') return {
    page: 'merchandise', product: /^\d+$/.test(second || '') ? Number(second) : undefined,
    team: second === 'teams' ? third : undefined, teamId: Number(url.searchParams.get('team_id')) || undefined,
    order: second === 'orders' ? third : undefined, token: url.searchParams.get('token') || undefined,
  }
  if (Object.hasOwn(legalPaths, '/' + first)) return { page: 'legal', slug: first, title: legalPaths['/' + first] }
  return { page: 'unknown' }
}
