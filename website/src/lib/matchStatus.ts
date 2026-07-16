export function publicDisplayMatchStatus(
  status: string | null | undefined,
  matchDate: string | null | undefined,
): string {
  const rawStatus = (status ?? 'scheduled').toLowerCase()

  if (rawStatus !== 'scheduled') {
    return rawStatus
  }

  if (!matchDate) {
    return rawStatus
  }

  const today = new Date()
  const todayKey = today.toISOString().slice(0, 10)

  const matchDateKey = String(matchDate).slice(0, 10)

  if (matchDateKey === todayKey) {
    return 'live'
  }

  return rawStatus
}
