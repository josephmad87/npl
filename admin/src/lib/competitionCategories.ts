/** Must match website + API team/league/match/player category values */
export const COMPETITION_CATEGORY_OPTIONS = [
  { value: 'mens', label: 'Mens' },
  { value: 'women', label: 'Women' },
  { value: 'youth', label: 'Youth' },
] as const

export type CompetitionCategoryValue = (typeof COMPETITION_CATEGORY_OPTIONS)[number]['value']

/** Map legacy DB values onto the select so the control never renders blank. */
export function normalizeCompetitionCategory(raw: string | null | undefined): CompetitionCategoryValue {
  const c = (raw ?? '').trim().toLowerCase()
  if (c === 'women' || c === 'ladies' || c === 'lady' || c === 'woman' || c === 'womens') return 'women'
  if (c === 'youth') return 'youth'
  if (c === 'mens' || c === 'men' || c === 'man') return 'mens'
  return 'mens'
}
