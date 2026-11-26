import { Text, View } from 'react-native'
import { Link } from 'expo-router'
import { isUpcomingFixture } from '../../../../../website/src/lib/matchday'
import { SiteLink } from '../../../components/app-link'
import { CompetitionLinks } from '../../../components/competition-links'
import { LiveMatchCard } from '../../../components/live-match-card'
import { MatchCard } from '../../../components/match-card'
import { LoadState, Screen, ui } from '../../../components/native-ui'
import { useHomeFeed } from '../../../lib/use-home-feed'
import { StoryCard } from '../../../screens/news-screen'

export default function Home() {
  const feed = useHomeFeed()
  const live = feed.fixturesCheckedAt ? feed.fixtures.find(match => match.status === 'live') : undefined
  const fixtures = feed.fixtures.filter(match => isUpcomingFixture(match))
  const next = live ? undefined : fixtures[0]
  const featured = next || feed.results[0]
  const upcoming = fixtures.filter(match => match.id !== next?.id).slice(0, 2)
  const fixturesRoute = { pathname: '/results', params: { mode: 'fixtures' } } as const
  return <Screen refreshing={feed.loading && feed.hasScores} onRefresh={() => void feed.refresh()}>
    <View style={ui.row}>
      <Text accessibilityRole="header" style={[ui.title, { flex: 1 }]}>Matchday</Text>
      <Link href={live ? '/live' : next ? fixturesRoute : '/results'} style={ui.link}>
        {live ? 'Live scores' : next ? 'All fixtures' : 'All results'} ›
      </Link>
    </View>
    <LoadState loading={feed.loading && !feed.hasScores} error={feed.error} retry={() => void feed.refresh()} />
    {live ? <LiveMatchCard featured match={live} teams={feed.teams} /> : featured ? <MatchCard featured match={featured} teams={feed.teams} />
      : !feed.loading && !feed.error ? <Text style={ui.muted}>Fixtures and results will appear as they’re published.</Text> : null}
    <CompetitionLinks highlighted />
    {upcoming.length || !next ? <><View style={ui.row}>
      <Text accessibilityRole="header" style={[ui.heading, { flex: 1 }]}>Upcoming fixtures</Text>
      <Link href={fixturesRoute} style={ui.link}>View fixtures ›</Link>
    </View>
    {upcoming.length ? upcoming.map(match => <MatchCard key={match.id} match={match} teams={feed.teams} compact />)
      : !feed.loading && !feed.fixturesError ? <Text style={ui.muted}>New fixtures will appear once confirmed.</Text> : null}</> : null}
    <View style={ui.row}><Text accessibilityRole="header" style={[ui.heading, { flex: 1 }]}>Latest news</Text><Link href="/news" style={ui.link}>All news</Link></View>
    {feed.news.slice(0, 3).map(story => <StoryCard key={story.id} story={story} compact />)}
    <Text accessibilityRole="header" style={ui.heading}>Explore NPL</Text>
    <View style={ui.panel}>
      <SiteLink path="/competition" style={ui.link}>Competitions ›</SiteLink>
      <SiteLink path="/teams" style={ui.link}>Teams ›</SiteLink>
      <SiteLink path="/gallery" style={ui.link}>Photos & videos ›</SiteLink>
    </View>
  </Screen>
}
