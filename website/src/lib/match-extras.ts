/** Sum team extras from a match result row (wides + byes + no-balls + leg-byes). */
export function sumTeamExtras(
  result: Record<string, unknown> | null | undefined,
  side: 'home' | 'away',
): number {
  if (!result) return 0
  const prefix = side === 'home' ? 'home_extras_' : 'away_extras_'
  const keys = ['wides', 'byes', 'no_balls', 'leg_byes'] as const
  let total = 0
  for (const k of keys) {
    const v = result[`${prefix}${k}`]
    if (typeof v === 'number' && !Number.isNaN(v)) {
      total += v
    } else if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
      total += Number(v)
    }
  }
  return total
}

export function formatExtrasBreakdown(
  result: Record<string, unknown> | null | undefined,
  side: 'home' | 'away',
): string | null {
  if (!result) return null
  const prefix = side === 'home' ? 'home_extras_' : 'away_extras_'
  const w = Number(result[`${prefix}wides`] ?? 0) || 0
  const b = Number(result[`${prefix}byes`] ?? 0) || 0
  const nb = Number(result[`${prefix}no_balls`] ?? 0) || 0
  const lb = Number(result[`${prefix}leg_byes`] ?? 0) || 0
  const total = w + b + nb + lb
  if (total <= 0) return null
  const parts: string[] = []
  if (w > 0) parts.push(`w ${w}`)
  if (nb > 0) parts.push(`nb ${nb}`)
  if (b > 0) parts.push(`b ${b}`)
  if (lb > 0) parts.push(`lb ${lb}`)
  return `Extras ${total} (${parts.join(', ')})`
}
