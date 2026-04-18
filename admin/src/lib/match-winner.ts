import type { MatchDto } from '@/lib/api-types'

/** Completed match with `result.winning_team_id` matching home or away. */
export function matchWinnerSide(m: MatchDto): 'home' | 'away' | null {
  if (m.status !== 'completed') return null
  const wid = m.result?.winning_team_id
  if (wid == null) return null
  if (wid === m.home_team_id) return 'home'
  if (wid === m.away_team_id) return 'away'
  return null
}

/** One-line score / margin for a completed match when the API stored a result. */
export function matchResultSummaryLine(m: MatchDto): string | null {
  if (m.status !== 'completed') return null
  const r = m.result
  if (!r) return null
  const score = r.score_summary?.trim()
  const margin = r.margin_text?.trim()
  if (score && margin) return `${score} (${margin})`
  return score ?? margin ?? null
}
