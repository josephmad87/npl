/** Stored on teams, leagues, matches, players and used in public API `?category=` */
export const COMPETITION_CATEGORIES = ['mens', 'women', 'youth'] as const
export type CompetitionCategory = (typeof COMPETITION_CATEGORIES)[number]
