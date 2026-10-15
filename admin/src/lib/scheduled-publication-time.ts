/** Article publication times are entered as Zimbabwe clock time, regardless of the editor's browser timezone. */
const ZIMBABWE_TIME_ZONE = 'Africa/Harare'
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function zimbabwePublicationInput(value: string | null | undefined): {
  date: string
  time: string
} {
  if (!value) return { date: '', time: '' }

  const instant = new Date(value)
  if (Number.isNaN(instant.valueOf())) return { date: '', time: '' }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZIMBABWE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''

  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  }
}

export function zimbabwePublicationTimeForApi(date: string, time: string): string | null {
  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) return null

  // Zimbabwe stays on UTC+02:00. Include the offset so browser timezone cannot move the chosen time.
  const timestamp = `${date}T${time}:00+02:00`
  const instant = new Date(timestamp)
  if (Number.isNaN(instant.valueOf())) return null

  // Date.parse normalizes impossible calendar dates, so check the round trip.
  const result = zimbabwePublicationInput(instant.toISOString())
  return result.date === date && result.time === time ? timestamp : null
}

export function validateZimbabwePublicationTime(
  date: string,
  time: string,
  now = Date.now(),
): { publishedAt: string; error: null } | { publishedAt: null; error: string } {
  if (!date || !time) {
    return { publishedAt: null, error: 'Choose both a go-live date and time to schedule this story.' }
  }

  const publishedAt = zimbabwePublicationTimeForApi(date, time)
  if (!publishedAt) {
    return { publishedAt: null, error: 'Enter a valid go-live date and time in Zimbabwe time.' }
  }
  if (new Date(publishedAt).getTime() <= now) {
    return { publishedAt: null, error: 'Choose a future go-live date and time.' }
  }
  return { publishedAt, error: null }
}
