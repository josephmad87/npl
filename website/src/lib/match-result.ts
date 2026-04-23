import type { MatchLite } from './hooks'

export function matchWinnerSide(m: MatchLite): 'home' | 'away' | null {
  if (m.status !== 'completed') return null
  const wid = m.result?.winning_team_id
  if (wid == null) return null
  if (wid === m.home_team_id) return 'home'
  if (wid === m.away_team_id) return 'away'
  return null
}

export function matchResultSummaryLine(m: MatchLite): string | null {
  if (m.status !== 'completed') return null
  const r = m.result
  if (!r) return null
  const score = r.score_summary?.trim()
  const margin = r.margin_text?.trim()
  if (score && margin) return `${score} (${margin})`
  return score ?? margin ?? r.innings_breakdown?.trim() ?? null
}
