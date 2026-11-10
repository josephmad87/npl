import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { colors } from '../../theme'
import { LiveMatchCard } from '../../components/live-match-card'
import { MatchCard } from '../../components/match-card'
import { useHomeFeed } from '../../lib/use-home-feed'

export default function Home() {
  const { feed, loading, error, refresh } = useHomeFeed()
  const live = feed?.fixtures.filter(match => match.status === 'live') || []
  const upcoming = feed?.fixtures.filter(match => match.status !== 'live').slice(0, 2) || []
  return <ScrollView style={s.page} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}>
    <View style={s.intro}><View style={s.introText}><Text style={s.kicker}>ZIMBABWE CLUB CRICKET</Text><Text accessibilityRole="header" style={s.title}>Your matchday</Text></View></View>
    <Link href={{ pathname: '/account/teams', params: { from: 'Home' } }} style={s.link}>Explore teams →</Link>
    {error ? <Text accessibilityRole="alert" style={s.error}>Connection unavailable. Saved scores may be out of date. Pull down to retry.</Text> : null}
    {loading && !feed ? <ActivityIndicator accessibilityLabel="Loading matchday" color={colors.brand} /> : null}
    {feed ? <Text style={s.updated}>Checked {new Date(feed.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Pull down to refresh</Text> : null}
    {live.length ? <View style={s.section}><View style={s.sectionHead}><Text accessibilityRole="header" style={s.heading}>Live now</Text><Link href="/live" style={s.link}>All live →</Link></View><Text style={s.caption}>Live scores refresh while this screen is open</Text>{live.map(match => <LiveMatchCard key={match.id} match={match} teams={feed?.teams || []} />)}</View> : null}
    <View style={s.section}><View style={s.sectionHead}><Text accessibilityRole="header" style={s.heading}>Latest results</Text><Link href="/results" style={s.link}>View all →</Link></View>
      {feed?.results.map(match => <MatchCard key={match.id} match={match} teams={feed.teams} />)}
      {!loading && !feed?.results.length ? <Text style={s.caption}>{error ? 'Connect to load recent results.' : 'Results will appear after matches are completed.'}</Text> : null}
    </View>
    <View style={s.section}><View style={s.sectionHead}><Text accessibilityRole="header" style={s.heading}>Up next</Text><Link href={{ pathname: '/page', params: { path: '/fixtures', title: 'Fixtures' } }} style={s.link}>Fixtures →</Link></View>
      {upcoming.length ? upcoming.map(match => <MatchCard key={match.id} match={match} teams={feed?.teams || []} />) : <Text style={s.caption}>{loading ? 'Checking upcoming games…' : 'The next fixtures will appear once confirmed.'}</Text>}
    </View>
    <View style={s.section}><View style={s.sectionHead}><Text accessibilityRole="header" style={s.heading}>Latest news</Text><Link href="/news" style={s.link}>All news →</Link></View>
      {feed?.news.slice(0, 3).map(article => <Link key={article.id} href={{ pathname: '/page', params: { path: `/news/${encodeURIComponent(article.slug)}`, title: 'NPL News' } }} asChild><Pressable style={s.story}>{article.featured_image_url ? <Image source={{ uri: article.featured_image_url }} style={s.newsImage} accessibilityLabel={article.title} /> : null}<View style={s.storyBody}><Text style={s.kicker}>NPL NEWS</Text><Text style={s.storyTitle}>{article.title}</Text><Text numberOfLines={2} style={s.caption}>{article.excerpt}</Text><Text style={s.storyAction}>Read story →</Text></View></Pressable></Link>)}
    </View>
    <View style={s.explore}><Text accessibilityRole="header" style={s.heading}>Explore NPL</Text>{[['Competitions', '/competition'], ['Teams', '/mens/teams'], ['Photos & videos', '/gallery']].map(([title, path]) => <Link key={path} href={title === 'Teams' ? { pathname: '/account/teams', params: { from: 'Home' } } : { pathname: '/page', params: { path, title } }} style={s.exploreLink}>{title} →</Link>)}</View>
  </ScrollView>
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, paddingBottom: 40, gap: 28 }, intro: { flexDirection: 'row', alignItems: 'center', gap: 16 }, introText: { flex: 1, gap: 4 }, logo: { width: 90, height: 56, resizeMode: 'contain' }, kicker: { color: colors.brand, fontSize: 10, fontWeight: '700', letterSpacing: 1 }, title: { color: colors.ink, fontWeight: '800', fontSize: 27 },
  updated: { color: colors.muted, fontSize: 11, marginTop: -16 }, section: { gap: 14 }, sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }, heading: { color: colors.ink, fontSize: 22, fontWeight: '700' }, link: { color: colors.brand, fontWeight: '700', fontSize: 14, paddingVertical: 12 }, caption: { color: colors.muted, fontSize: 14, lineHeight: 21 }, error: { color: colors.warning, fontSize: 14, lineHeight: 21 },
  storyLink: { width: '100%' }, story: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', width: '100%' }, newsImage: { width: '100%', height: 180 }, storyBody: { padding: 18, gap: 10 }, storyTitle: { color: colors.ink, fontSize: 19, lineHeight: 25, fontWeight: '700' }, storyAction: { color: colors.brand, fontWeight: '700', paddingTop: 6 }, explore: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 24, gap: 4 }, exploreLink: { color: colors.ink, fontSize: 16, paddingVertical: 16 },
})
