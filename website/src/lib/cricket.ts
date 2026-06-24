export const DID_NOT_BAT = 'did not bat'
export const NOT_OUT = 'not out'
export const RETIRED_HURT = 'retired hurt'

export function normalizeDismissal(dismissal: string | null | undefined): string {
  return dismissal?.trim().toLowerCase() ?? ''
}

export function isDidNotBat(dismissal: string | null | undefined): boolean {
  return normalizeDismissal(dismissal) === DID_NOT_BAT
}

export function isNotOutDismissal(dismissal: string | null | undefined): boolean {
  const t = normalizeDismissal(dismissal)
  return t === NOT_OUT || t === RETIRED_HURT
}

export function isBattingOut(dismissal: string | null | undefined): boolean {
  const t = normalizeDismissal(dismissal)
  if (!t || t === NOT_OUT || t === RETIRED_HURT || t === DID_NOT_BAT) {
    return false
  }
  return true
}

export function countsBattingInnings(
  dismissal: string | null | undefined,
  runs: number,
  ballsFaced: number,
): boolean {
  if (isDidNotBat(dismissal)) return false
  if (runs > 0 || ballsFaced > 0) return true
  const t = normalizeDismissal(dismissal)
  if (t === NOT_OUT || t === RETIRED_HURT) return true
  return isBattingOut(dismissal)
}

export function formatDismissalDisplay(dismissal: string | null | undefined): string {
  if (!dismissal?.trim()) return '—'
  return dismissal.trim()
}

export function normalizeCricketOversInput(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const raw = Number(trimmed)
  if (Number.isNaN(raw) || raw <= 0) return ''
  const n = Math.round(raw * 10) / 10
  const s = n.toString()
  if (!s.includes('.')) return s
  const [whole, frac] = s.split('.')
  const ball = Math.min(5, parseInt(frac[0] ?? '0', 10) || 0)
  return `${whole}.${ball}`
}

export function formatCricketOvers(
  value: string | number | null | undefined,
): string {
  if (value == null || value === '') return ''
  const normalized = normalizeCricketOversInput(String(value))
  if (!normalized) return ''
  if (!normalized.includes('.')) return normalized
  return normalized.replace(/\.0$/, '').replace(/(\.\d)0$/, '$1')
}

export function oversFieldToBalls(ov: unknown): number {
  if (ov == null) return 0
  const raw = typeof ov === 'number' ? ov : Number(ov)
  if (Number.isNaN(raw) || raw <= 0) return 0
  const normalized = normalizeCricketOversInput(String(raw))
  if (!normalized) return 0
  if (!normalized.includes('.')) {
    return Math.floor(Number(normalized)) * 6
  }
  const [whole, frac] = normalized.split('.')
  const w = parseInt(whole, 10) || 0
  const b = Math.min(5, parseInt(frac[0] ?? '0', 10) || 0)
  return w * 6 + b
}

export type InningsNumber = 1 | 2

export function getInningsSides(
  innings: InningsNumber,
  battingFirstTeamId: number | null,
  homeTeamId: number,
  awayTeamId: number,
): { battingTeamId: number; bowlingTeamId: number } | null {
  if (battingFirstTeamId == null) return null
  const secondTeamId =
    battingFirstTeamId === homeTeamId ? awayTeamId : homeTeamId
  if (innings === 1) {
    return { battingTeamId: battingFirstTeamId, bowlingTeamId: secondTeamId }
  }
  return { battingTeamId: secondTeamId, bowlingTeamId: battingFirstTeamId }
}

export function hasBattingLine(row: {
  runs?: number
  balls_faced?: number
  dismissal?: string | null
}): boolean {
  return (
    (row.runs ?? 0) > 0 ||
    (row.balls_faced ?? 0) > 0 ||
    (row.dismissal?.trim() ?? '') !== ''
  )
}

export function hasBowlingLine(row: {
  overs?: string | number | null
  maidens?: number
  runs_conceded?: number
  wickets?: number
  catches?: number
  stumpings?: number
  run_outs?: number
  notes?: string | null
}): boolean {
  const ov = row.overs
  const hasOvers = ov != null && ov !== '' && Number(ov) > 0
  return (
    hasOvers ||
    (row.maidens ?? 0) > 0 ||
    (row.runs_conceded ?? 0) > 0 ||
    (row.wickets ?? 0) > 0 ||
    (row.catches ?? 0) > 0 ||
    (row.stumpings ?? 0) > 0 ||
    (row.run_outs ?? 0) > 0 ||
    (row.notes?.trim() ?? '') !== ''
  )
}
