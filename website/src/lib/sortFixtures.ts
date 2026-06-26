import type { MatchLite } from './hooks'

/** Upcoming fixtures: earliest match date first; undated fixtures last. */
export function sortFixturesByDateAsc(matches: MatchLite[]): MatchLite[] {
  return [...matches].sort((a, b) => {
    const da = a.match_date?.trim()
    const db = b.match_date?.trim()
    if (!da && !db) return a.id - b.id
    if (!da) return 1
    if (!db) return -1
    const ta = Date.parse(da)
    const tb = Date.parse(db)
    if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb
    if (da !== db) return da.localeCompare(db)
    return a.id - b.id
  })
}
