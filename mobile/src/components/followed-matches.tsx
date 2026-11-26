import { StyleSheet, Text, View } from 'react-native'
import type { Fixture } from '../lib/feed'
import { useSupporterResource } from '../lib/supporter-account'
import { loadClubs } from '../lib/team-data'
import { useTeamResource } from '../lib/use-team-resource'
import { SiteLink } from './app-link'
import { MatchCard } from './match-card'
import { LoadState, ui } from './native-ui'

export function FollowedMatches() {
  const feed = useSupporterResource<{ upcoming: Fixture[]; recent: Fixture[] }>('/followed-matches')
  const clubs = useTeamResource('clubs-v1', loadClubs, { maxAge: 300_000 })
  const groups = [
    { title: 'Upcoming fixtures', matches: feed.data?.upcoming },
    { title: 'Recent results', matches: feed.data?.recent },
  ]
  return <View style={s.section}>
    <View style={ui.row}>
      <Text accessibilityRole="header" style={[ui.heading, s.fill]}>Your clubs</Text>
      <SiteLink path="/teams" style={ui.link}>Find teams ›</SiteLink>
    </View>
    <LoadState loading={feed.loading} error={feed.error} retry={feed.refresh}
      empty={feed.data && !groups.some(group => group.matches?.length) ? 'Published fixtures and results from clubs you follow will appear here.' : undefined} />
    {groups.map(group => group.matches?.length ? <View key={group.title} style={s.section}>
      <Text accessibilityRole="header" style={ui.rowTitle}>{group.title}</Text>
      {group.matches.map(match => <MatchCard key={match.id} match={match} teams={clubs.data || []} compact />)}
    </View> : null)}
  </View>
}

const s = StyleSheet.create({ section: { gap: 8 }, fill: { flex: 1 } })
