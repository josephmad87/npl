import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { Link, router, useLocalSearchParams } from 'expo-router'
import { colors } from '../theme'
import { divisionLabel, filterClubs, loadClubs, type Division } from '../lib/team-data'
import { useTeamResource } from '../lib/use-team-resource'
import { BackLink, ResourceState, TeamEmblem } from '../components/team-ui'
const divisions: Division[] = ['mens', 'women', 'youth']
export default function TeamsScreen() {
  const { width } = useWindowDimensions()
  const columns = width >= 720 ? 3 : 2
  const params = useLocalSearchParams<{ division?: string; from?: string }>()
  const division = divisions.includes(params.division as Division) ? params.division as Division : 'mens'
  const [query, setQuery] = useState('')
  const { data, loading, error, refresh } = useTeamResource('clubs-v1', loadClubs)
  const clubs = useMemo(() => filterClubs(data || [], division, query), [data, division, query])
  return <FlatList key={columns} numColumns={columns} columnWrapperStyle={s.gridRow} style={s.page} contentContainerStyle={s.content} data={clubs} keyExtractor={club => String(club.id)} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
    ListHeaderComponent={<View style={s.head}>
      <BackLink label={params.from === 'Home' ? 'Home' : 'My NPL'} />
      <Text accessibilityRole="header" style={s.title}>Teams</Text>
      <View style={s.segments}>{divisions.map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${divisionLabel(value)} teams`} accessibilityState={{ selected: division === value }} onPress={() => router.setParams({ division: value })} style={[s.segment, division === value && s.selected]}><Text style={[s.segmentText, division === value && s.selectedText]}>{divisionLabel(value)}</Text></Pressable>)}</View>
      <View style={s.search}><TextInput value={query} onChangeText={setQuery} placeholder="Search teams or home grounds" placeholderTextColor={colors.muted} accessibilityLabel="Search teams or home grounds" autoCorrect={false} returnKeyType="search" style={s.input} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear team search" onPress={() => setQuery('')} style={s.clear}><Text style={s.clearText}>×</Text></Pressable> : null}</View>
      {error ? <ResourceState error={data ? 'Could not refresh. Showing saved teams. Pull down to retry.' : error} retry={() => void refresh()} /> : null}
    </View>}
    renderItem={({ item }) => (
      <View style={[s.tile, { width: (width - 32 - (columns - 1) * 10) / columns }]}>
        <Link href={{ pathname: '/account/team/[slug]', params: { slug: item.slug } }} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={`${item.name}, club profile`} style={s.team}>
            <TeamEmblem name={item.name} uri={item.logo_url} size={40} />
            <Text style={s.name}>{item.name.replace(/ Cricket Club$/i, '')}</Text>
            <Text style={s.ground}>Club profile ›</Text>
          </Pressable>
        </Link>
      </View>
    )}
    ListEmptyComponent={<ResourceState loading={loading && !data} empty={!error ? query ? 'No teams match your search. Try another name or clear the search.' : `No ${divisionLabel(division).toLowerCase()} teams are published yet.` : undefined} retry={() => void refresh()} />}
/>
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 86 },
  head: { gap: 10, paddingBottom: 14 },
  title: { fontSize: 27, fontWeight: '800', color: colors.ink },
  segments: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: { minHeight: 44, paddingHorizontal: 15, justifyContent: 'center', backgroundColor: colors.surface, borderRadius: 22 },
  selected: { backgroundColor: colors.maroon },
  segmentText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  selectedText: { color: colors.surface },
  search: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.surface },
  input: { flex: 1, padding: 12, minHeight: 44, color: colors.ink, fontSize: 14 },
  clear: { width: 44, justifyContent: 'center', alignItems: 'center' },
  clearText: { color: colors.muted, fontSize: 24 },
  gridRow: { gap: 10, marginBottom: 10 },
  tile: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 13, overflow: 'hidden' },
  team: { flex: 1, gap: 5, padding: 12, minHeight: 110 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  ground: { color: colors.muted, fontSize: 12, lineHeight: 17 },
})
