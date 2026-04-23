export function formatMatchDate(value: string | null | undefined): string {
  if (!value) return 'TBD'
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return new Intl.DateTimeFormat('en-ZW', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  const from = formatMatchDate(start)
  const to = formatMatchDate(end)
  if (!start && !end) return 'Dates to be confirmed'
  return `${from} - ${to}`
}

const COMPETITION_LABELS: Record<string, string> = {
  mens: 'Mens',
  men: 'Mens',
  man: 'Mens',
  women: 'Women',
  ladies: 'Women',
  lady: 'Women',
  woman: 'Women',
  womens: 'Women',
  youth: 'Youth',
}

/** Human label for team/league/match/player/article competition category */
export function formatCategoryLabel(category: string | null | undefined): string {
  if (!category) return 'General'
  const c = category.trim().toLowerCase()
  if (!c) return 'General'
  const mapped = COMPETITION_LABELS[c]
  if (mapped) return mapped
  return c.charAt(0).toUpperCase() + c.slice(1)
}

export function toTimeShort(value: string | null | undefined): string {
  if (!value) return 'TBD'
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return new Intl.DateTimeFormat('en-ZW', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** e.g. "27 Apr 2025 10:00 am" for result cards (uses start_time when set). */
export function formatMatchDateTimeForResultCard(match: {
  match_date?: string | null
  start_time?: string | null
}): string {
  const iso = match.start_time ?? (match.match_date ? `${String(match.match_date).split('T')[0]}T12:00:00` : null)
  if (!iso) return 'TBC'
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return 'TBC'
  const datePart = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
  if (match.start_time) {
    const timePart = new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d)
    return `${datePart} ${timePart}`
  }
  return datePart
}

/** e.g. "Apr 22, 2026" for section subtitles */
export function formatNewsHighlightsDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-ZW', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}
