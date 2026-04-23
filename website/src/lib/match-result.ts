import type { MatchLite } from './hooks'

function asInningsStringList(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => String(x).trim()).filter(Boolean)
  }
  if (typeof v === 'string' && v.trim()) {
    return [v.trim()]
  }
  return []
}

/** Per-team innings for the scoreboard; `merged` is a full summary when not split (legacy text). */
export function buildInningScoreboard(m: MatchLite): {
  homeLines: string[]
  awayLines: string[]
  merged: string | null
} {
  const r = m.result
  if (!r) {
    return { homeLines: [], awayLines: [], merged: null }
  }
  const raw = r.innings_breakdown?.trim()
  if (raw) {
    try {
      const j = JSON.parse(raw) as Record<string, unknown>
      const home = asInningsStringList(j.home_lines ?? j.home)
      const away = asInningsStringList(j.away_lines ?? j.away)
      if (home.length > 0 || away.length > 0) {
        return { homeLines: home, awayLines: away, merged: null }
      }
    } catch {
      /* treat as free text */
    }
    if (raw.length < 400 && !raw.startsWith('{')) {
      return { homeLines: [], awayLines: [], merged: raw }
    }
  }
  const sum = r.score_summary?.trim()
  if (sum) {
    return { homeLines: [], awayLines: [], merged: sum }
  }
  return { homeLines: [], awayLines: [], merged: null }
}

/** Strip trailing "(12.3)" for the large runs line. */
export function scoreRunsDisplayPart(inningsFragment: string): string {
  return inningsFragment.replace(/\s*\(([\d.]+)\)\s*$/g, '').trim()
}

export function scoreOversFromFragment(inningsFragment: string): string | null {
  const m = inningsFragment.match(/\(([\d.]+)\)\s*$/)
  return m?.[1] ?? null
}

export function matchCompetitionLine(m: MatchLite): string {
  const t = m.title?.trim()
  if (t) {
    return t
  }
  const league = m.season?.league?.name?.trim()
  const sn = m.season?.name?.trim()
  if (league && sn) {
    return `${league} ${sn}`
  }
  if (sn) {
    return sn
  }
  if (league) {
    return league
  }
  return 'Match'
}

export function matchResultHeadline(m: MatchLite): string {
  if (m.status !== 'completed') {
    return (m.status ?? 'Scheduled').replaceAll('_', ' ').toUpperCase()
  }
  const r = m.result
  if (!r) {
    return 'RESULT'
  }
  const margin = r.margin_text?.trim()
  if (margin) {
    return margin.toUpperCase()
  }
  const sum = r.score_summary?.trim()
  if (sum) {
    return sum.length > 120 ? `${sum.slice(0, 117)}…` : sum.toUpperCase()
  }
  return 'MATCH COMPLETED'
}

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
