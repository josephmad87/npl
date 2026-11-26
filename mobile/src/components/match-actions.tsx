import { useState } from 'react'
import { createEventInCalendarAsync } from 'expo-calendar/legacy'
import { Share, StyleSheet, View } from 'react-native'
import { fixtureCalendarEvent, matchUrl } from '../../../website/src/lib/matchday'
import type { Fixture, Team } from '../lib/feed'
import { matchName, shortTeamName } from './match-card'
import { Action, Notice } from './native-ui'

export function MatchActions({ match, teams }: { match: Fixture; teams: Team[] }) {
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const title = [match.home_team_id, match.away_team_id].map(id => shortTeamName(matchName(match, teams, id))).join(' vs ')
  const final = match.status === 'completed'
  const url = matchUrl(match.id, final)
  const event = fixtureCalendarEvent(match, title)

  async function share() {
    setError('')
    try {
      await Share.share(process.env.EXPO_OS === 'ios' ? { message: title, url } : { title, message: title + '\n' + url })
    } catch {
      setError('Could not open sharing. Try again.')
    }
  }

  async function addToCalendar() {
    const current = fixtureCalendarEvent(match, title)
    if (pending || !current) return
    setPending(true)
    setError('')
    try {
      const day = (date: Date) => new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
      await createEventInCalendarAsync({
        ...current, notes: current.url,
        startDate: current.allDay ? day(current.startDate) : current.startDate,
        endDate: current.allDay ? day(current.endDate) : current.endDate,
        timeZone: current.allDay ? undefined : 'Africa/Harare',
      })
    } catch {
      setError('Could not open your calendar. Check that a calendar app is installed.')
    } finally {
      setPending(false)
    }
  }

  return <View style={s.actions}>
    <View style={s.row}>
      <Action label={final ? 'Share scorecard' : 'Share match'} tone="secondary" onPress={() => void share()} />
      {event ? <Action label="Add to calendar" tone="secondary" busy={pending} onPress={() => void addToCalendar()} /> : null}
    </View>
    {error ? <Notice error>{error}</Notice> : null}
  </View>
}

const s = StyleSheet.create({
  actions: { gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
