type MatchUrlInput = {
  id: number
  home_name?: string | null
  away_name?: string | null
  home_team_name?: string | null
  away_team_name?: string | null
  season?: {
    slug?: string | null
    name?: string | null
    league?: {
      slug?: string | null
      name?: string | null
    } | null
  } | null
  season_slug?: string | null
  league_slug?: string | null
  season_name?: string | null
  league_name?: string | null
}

function slugify(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function matchSeoPath(match: MatchUrlInput): string {
  const leagueSlug =
    slugify(match.season?.league?.slug) ||
    slugify(match.league_slug) ||
    slugify(match.season?.league?.name) ||
    slugify(match.league_name) ||
    'league'

  const seasonSlug =
    slugify(match.season?.slug) ||
    slugify(match.season_slug) ||
    slugify(match.season?.name) ||
    slugify(match.season_name) ||
    'season'

  const homeName =
    match.home_name ??
    match.home_team_name ??
    'home'

  const awayName =
    match.away_name ??
    match.away_team_name ??
    'away'

  const teamsSlug = `${slugify(homeName)}-vs-${slugify(awayName)}`

  return `/leagues/${leagueSlug}/seasons/${seasonSlug}/matches/${match.id}/${teamsSlug}`
}
