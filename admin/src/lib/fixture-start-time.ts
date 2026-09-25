/**
 * Fixtures are scheduled in Zimbabwe time. Keep the typed clock time separate
 * from the date field so a browser timezone can never silently adjust it.
 */
export const FIXTURE_TIME_ZONE = 'Africa/Harare'

const TWENTY_FOUR_HOUR_TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function fixtureStartDateValue(value: string): Date {
  // Older development data may not include an offset. It still represents the
  // fixture's Zimbabwe clock time, rather than the viewer's local timezone.
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
  return new Date(hasOffset ? value : `${value}+02:00`)
}

export function fixtureStartTimeValue(value: string | null | undefined): string {
  if (!value) return ''

  const parsed = fixtureStartDateValue(value)
  if (!Number.isNaN(parsed.valueOf())) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: FIXTURE_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(parsed)
    const hour = parts.find((part) => part.type === 'hour')?.value
    const minute = parts.find((part) => part.type === 'minute')?.value

    if (hour && minute) return `${hour}:${minute}`
  }

  return value.match(/T(\d{2}:\d{2})/)?.[1] ?? ''
}

function fixtureStartDate(value: string | null | undefined): string | null {
  const date = value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
  return date ?? null
}

export function fixtureStartTimeError(
  matchDate: string | null | undefined,
  startTime: string,
  currentStartTime?: string | null,
): string | null {
  const time = startTime.trim()
  if (!time) return null
  if (!TWENTY_FOUR_HOUR_TIME.test(time)) {
    return 'Use a 24-hour start time in HH:MM format, for example 14:30.'
  }
  if (!matchDate && !fixtureStartDate(currentStartTime)) {
    return 'Choose a match date before adding a start time.'
  }
  return null
}

export function fixtureStartTimeForApi(
  matchDate: string | null | undefined,
  startTime: string,
  currentStartTime?: string | null,
): string | null {
  const time = startTime.trim()
  if (!time) return null

  const date = matchDate || fixtureStartDate(currentStartTime)
  if (!date) return null

  // Zimbabwe has a constant UTC+02:00 offset. Sending it explicitly preserves
  // the entered local clock time when the API stores the timestamp in UTC.
  return `${date}T${time}:00+02:00`
}

export function formatFixtureWhen(match: {
  match_date?: string | null
  start_time?: string | null
}): string {
  const date = match.match_date ?? fixtureStartDate(match.start_time)
  const time = fixtureStartTimeValue(match.start_time)

  if (date && time) return `${date} ${time}`
  return date ?? '—'
}
