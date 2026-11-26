import { fixtureCalendarEvent, type PublishedFixture } from '../lib/matchday'

function escapeText(value: string) {
  return value.replaceAll('\\', '\\\\').replace(/\r\n|\n|\r/g, '\\n').replace(/([,;])/g, '\\$1')
}

function fold(line: string) {
  const encoder = new TextEncoder()
  let bytes = 0
  let result = ''
  for (const char of line) {
    const length = encoder.encode(char).length
    if (bytes + length > 75) {
      result += '\r\n '
      bytes = 1
    }
    result += char
    bytes += length
  }
  return result
}

export function AddFixtureToCalendar({ match, title }: { match: PublishedFixture; title: string }) {
  if (!fixtureCalendarEvent(match, title)) return null

  function save() {
    const now = Date.now()
    const event = fixtureCalendarEvent(match, title, now)
    if (!event) return
    const dateTime = (value: Date) => value.toISOString().replace(/[-:]|\.\d{3}/g, '')
    const stamp = (value: Date) => event.allDay ? value.toISOString().slice(0, 10).replaceAll('-', '') : dateTime(value)
    const prop = event.allDay ? ';VALUE=DATE:' : ':'
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NPL Zimbabwe//Fixtures//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT', 'UID:match-' + match.id + '@npl.co.zw', 'DTSTAMP:' + dateTime(new Date(now)),
      'DTSTART' + prop + stamp(event.startDate), 'DTEND' + prop + stamp(event.endDate),
      'SUMMARY:' + escapeText(event.title), 'URL:' + event.url,
      ...(event.location ? ['LOCATION:' + escapeText(event.location)] : []),
      'END:VEVENT', 'END:VCALENDAR', '',
    ]
    const file = URL.createObjectURL(new Blob([lines.map(fold).join('\r\n')], { type: 'text/calendar;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = file
    link.download = 'npl-fixture-' + match.id + '.ics'
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(file), 1_000)
  }

  return <button className="social-share__button" type="button" onClick={save}>Add to calendar</button>
}
