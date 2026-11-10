import { useCallback } from 'react'
import { ActivityIndicator, AppState, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Link, useFocusEffect } from 'expo-router'
import { useHomeFeed } from '../../lib/use-home-feed'
import { colors } from '../../theme'
import { ScreenHeading } from '../../components/screen-heading'
import { MatchCard } from '../../components/match-card'
import { LiveMatchCard } from '../../components/live-match-card'
export default function Live() {
  const { feed, loading, error, refresh } = useHomeFeed()
  useFocusEffect(useCallback(() => {
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh() }, 20_000)
    return () => clearInterval(timer)
  }, [refresh]))
  const live = feed?.fixtures.filter(match => match.status === 'live') || []
  const upcoming = feed?.fixtures.filter(match => match.status === 'scheduled').slice(0, 2) || []
  return <ScrollView style={s.page} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}>
    <ScreenHeading label="MATCH CENTRE" title="Live cricket" subtitle="Scores first. Every wicket, every boundary." />
    {error ? <Text accessibilityRole="alert" style={s.caption}>Could not refresh the match list. Saved information may be out of date. Pull down to retry.</Text> : null}
    {loading && !feed ? <ActivityIndicator color={colors.brand} accessibilityLabel="Checking live matches" /> : null}
    {live.map(match => <LiveMatchCard key={match.id} match={match} teams={feed?.teams || []} />)}
    {!loading && !error && !live.length ? <View style={s.empty}><Text style={s.mark}>◉</Text><Text style={s.emptyTitle}>No match is live right now</Text><Text style={s.emptyText}>Come back on matchday for scores and ball-by-ball coverage.</Text><Link href={{ pathname: '/page', params: { path: '/fixtures', title: 'Fixtures' } }} style={s.primary}>Find the next game →</Link></View> : null}
    {upcoming.length ? <View style={s.section}><Text accessibilityRole="header" style={s.heading}>Coming up</Text>{upcoming.map(match => <MatchCard key={match.id} match={match} teams={feed?.teams || []} />)}</View> : null}
    {feed?.results.length ? <View style={s.section}><View style={s.row}><Text accessibilityRole="header" style={s.heading}>Last time out</Text><Link href="/results" style={s.link}>All results →</Link></View><MatchCard match={feed.results[0]} teams={feed.teams} /></View> : null}
  </ScrollView>
}
const s = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, paddingBottom: 40, gap: 24 }, section: { gap: 14 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }, heading: { color: colors.ink, fontSize: 21, fontWeight: '700' }, caption: { fontSize: 14, color: colors.warning, lineHeight: 21 }, empty: { backgroundColor: colors.ink, borderRadius: 16, padding: 24, gap: 12 }, mark: { color: colors.gold, fontSize: 26 }, emptyTitle: { color: colors.surface, fontSize: 22, fontWeight: '700' }, emptyText: { color: '#d2c8c8', lineHeight: 22, fontSize: 14 }, primary: { backgroundColor: colors.gold, color: colors.ink, alignSelf: 'flex-start', padding: 14, borderRadius: 8, overflow: 'hidden', fontWeight: '700', marginTop: 4 }, link: { color: colors.brand, paddingVertical: 12, fontWeight: '700' } })
