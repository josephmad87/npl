/** Stored on teams, leagues, matches, players, articles and used in public API `?category=` */
export const COMPETITION_CATEGORIES = ['mens', 'women', 'youth'] as const
export type CompetitionCategory = (typeof COMPETITION_CATEGORIES)[number]

/** Map stored / legacy article category strings onto competition slugs for filtering. */
export function parseArticleCompetitionCategory(
  raw: string | null | undefined,
): CompetitionCategory | null {
  const c = (raw ?? '').trim().toLowerCase()
  if (c === 'women' || c === 'ladies' || c === 'lady' || c === 'woman' || c === 'womens') {
    return 'women'
  }
  if (c === 'youth') return 'youth'
  if (c === 'mens' || c === 'men' || c === 'man') return 'mens'
  return null
}
