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

/** e.g. "Apr 22, 2026" for section subtitles */
export function formatNewsHighlightsDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-ZW', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}
