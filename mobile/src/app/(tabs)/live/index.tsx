import { Text, View } from 'react-native'
import { Link } from 'expo-router'
import { isUpcomingFixture } from '../../../../../website/src/lib/matchday'
import { LiveMatchCard } from '../../../components/live-match-card'
import { MatchCard } from '../../../components/match-card'
import { LoadState, Screen, ui } from '../../../components/native-ui'
import { useHomeFeed } from '../../../lib/use-home-feed'

export default function Live() {
  const feed = useHomeFeed({ includeNews: false, live: true })
  const live = feed.fixturesCheckedAt ? feed.fixtures.filter(match => match.status === 'live') : []
  const upcoming = feed.fixtures.filter(match => isUpcomingFixture(match)).slice(0, 3)
  const fixturesRoute = { pathname: '/results', params: { mode: 'fixtures' } } as const
  return <Screen title="Live cricket" refreshing={feed.loading && feed.hasScores} onRefresh={() => void feed.refresh()}>
    <LoadState loading={feed.loading && !feed.hasScores} error={feed.error} retry={() => void feed.refresh()} />
    {live.map((match, index) => <LiveMatchCard featured={index === 0} key={match.id} match={match} teams={feed.teams} />)}
    {!feed.loading && !feed.fixturesError && !live.length ? <View style={[ui.panel, ui.soft]}>
      <Text style={ui.rowTitle}>No matches live right now</Text>
      {!upcoming.length ? <Text style={ui.muted}>No upcoming fixtures have been confirmed.</Text> : null}
    </View> : null}
    {upcoming.length ? <>
      <View style={ui.row}><Text accessibilityRole="header" style={[ui.heading, { flex: 1 }]}>Coming up</Text>
        <Link href={fixturesRoute} style={ui.link}>All fixtures ›</Link></View>
      {upcoming.map(match => <MatchCard key={match.id} match={match} teams={feed.teams} compact />)}
    </> : null}
    {feed.results.length ? <>
      <View style={ui.row}><Text accessibilityRole="header" style={[ui.heading, { flex: 1 }]}>Recent results</Text><Link href="/results" style={ui.link}>All results ›</Link></View>
      {feed.results.map(match => <MatchCard key={match.id} match={match} teams={feed.teams} compact />)}
    </> : null}
  </Screen>
}
