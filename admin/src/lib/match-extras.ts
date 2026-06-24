export function formatExtrasBreakdown(
  result: {
    home_extras_wides?: number
    home_extras_byes?: number
    home_extras_no_balls?: number
    home_extras_leg_byes?: number
    away_extras_wides?: number
    away_extras_byes?: number
    away_extras_no_balls?: number
    away_extras_leg_byes?: number
  } | null | undefined,
  side: 'home' | 'away',
): string | null {
  if (!result) return null
  const prefix = side === 'home' ? 'home_extras_' : 'away_extras_'
  const w = result[`${prefix}wides` as keyof typeof result] ?? 0
  const b = result[`${prefix}byes` as keyof typeof result] ?? 0
  const nb = result[`${prefix}no_balls` as keyof typeof result] ?? 0
  const lb = result[`${prefix}leg_byes` as keyof typeof result] ?? 0
  const total = Number(w) + Number(b) + Number(nb) + Number(lb)
  if (total <= 0) return null
  const parts: string[] = []
  if (Number(w) > 0) parts.push(`w ${w}`)
  if (Number(nb) > 0) parts.push(`nb ${nb}`)
  if (Number(b) > 0) parts.push(`b ${b}`)
  if (Number(lb) > 0) parts.push(`lb ${lb}`)
  return `Extras ${total} (${parts.join(', ')})`
}
