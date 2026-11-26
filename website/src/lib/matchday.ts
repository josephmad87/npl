export type PublishedFixture = {
  id: number
  status?: string | null
  match_date?: string | null
  start_time?: string | null
  match_overs?: number | string | null
  venue?: string | null
}

export function matchUrl(id: number, scorecard = false) {
  return 'https://npl.co.zw/matches/' + id + (scorecard ? '?section=scorecard#scorecard' : '')
}

const cricketDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Harare', year: 'numeric', month: '2-digit', day: '2-digit',
})

function localDate(value: number | Date) {
  const parts = Object.fromEntries(cricketDay.formatToParts(value).map(part => [part.type, part.value]))
  return [parts.year, parts.month, parts.day].join('-')
}

export function isUpcomingFixture(match: PublishedFixture, now = Date.now()) {
  if (match.status !== 'scheduled') return false
  if (match.start_time) {
    const day = new Date(match.start_time)
    if (Number.isFinite(day.getTime())) return localDate(day) >= localDate(now)
  }
  return Boolean(match.match_date && match.match_date >= localDate(now))
}

export function fixtureCalendarEvent(match: PublishedFixture, title: string, now = Date.now()) {
  if (!isUpcomingFixture(match, now)) return
  if (!match.start_time && match.match_date && /^\d{4}-\d{2}-\d{2}$/.test(match.match_date)) {
    const start = new Date(match.match_date + 'T00:00:00Z')
    if (!Number.isFinite(start.getTime())) return
    return {
      title, startDate: start, endDate: new Date(start.getTime() + 86_400_000), allDay: true,
      location: match.venue || undefined, url: matchUrl(match.id),
    }
  }
  if (!match.start_time) return
  const start = new Date(match.start_time)
  if (!Number.isFinite(start.getTime()) || start.getTime() <= now) return
  const overs = Number(match.match_overs)
  const minutes = overs > 0 && overs <= 99 ? Math.ceil(overs * 8 + 20) : 180
  return {
    title, startDate: start, endDate: new Date(start.getTime() + minutes * 60_000), allDay: false,
    location: match.venue || undefined, url: matchUrl(match.id),
  }
}
