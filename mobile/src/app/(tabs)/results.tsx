import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { MatchCard } from '../../components/match-card'
import { useHomeFeed } from '../../lib/use-home-feed'
import { colors } from '../../theme'
export default function Results() {
  const { feed, loading, error, refresh } = useHomeFeed(30)
  return <FlatList style={s.page} contentContainerStyle={s.content} data={feed?.results || []} keyExtractor={match => String(match.id)} ItemSeparatorComponent={() => <View style={{ height: 16 }} />} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    ListHeaderComponent={<View style={s.header}><Text accessibilityRole="header" style={s.title}>Results</Text><Text style={s.caption}>Recent matches · tap a card for the full scorecard</Text>{error ? <Text accessibilityRole="alert" style={s.caption}>Could not refresh. Saved results may be out of date. Pull down to retry.</Text> : null}{loading && !feed ? <ActivityIndicator color={colors.brand} /> : null}</View>}
    renderItem={({ item }) => <MatchCard match={item} teams={feed?.teams || []} />}
    ListEmptyComponent={!loading ? <Text style={s.caption}>{error ? 'Connect to load results.' : 'No results published yet.'}</Text> : undefined}
    ListFooterComponent={<Link href={{ pathname: '/page', params: { path: '/results', title: 'Results archive' } }} style={s.archive}>Browse the full results archive →</Link>} />
}
const s = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, paddingBottom: 40 }, header: { gap: 8, paddingBottom: 24 }, title: { fontSize: 28, fontWeight: '800', color: colors.ink }, caption: { fontSize: 14, lineHeight: 21, color: colors.muted }, archive: { fontSize: 16, color: colors.brand, paddingVertical: 24 } })
