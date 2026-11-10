import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Link, useLocalSearchParams } from 'expo-router'
import { colors } from '../theme'
import { clubPath, divisionLabel, teamRequest, type Club } from '../lib/team-data'
import { useTeamResource } from '../lib/use-team-resource'
import { BackLink, ProfileFollow, ResourceState, TeamEmblem } from '../components/team-ui'
import { TeamMatches, TeamSquad, TeamStats } from '../components/team-panels'
type Section = 'Overview' | 'Squad' | 'Matches' | 'Stats'
const sections: Section[] = ['Overview', 'Squad', 'Matches', 'Stats']
export default function TeamProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const safeSlug = typeof slug === 'string' ? slug : ''
  const load = useCallback((signal: AbortSignal) => teamRequest<Club>(clubPath(safeSlug), signal), [safeSlug])
  const { data: club, loading, error, refresh } = useTeamResource(`club-${safeSlug}`, load)
  const [section, setSection] = useState<Section>('Overview')
  return <ScrollView style={s.page} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}>
    <BackLink label="Teams" fallback="/account/teams" />
    {!club || error ? <ResourceState loading={loading && !club} error={error} retry={() => void refresh()} /> : null}
    {club ? <>
      <View style={s.identity}><View style={s.top}><TeamEmblem name={club.name} uri={club.logo_url} size={72} /><Text style={s.division}>{club.category === 'youth' ? 'YOUTH CRICKET' : `${divisionLabel(club.category).toUpperCase()}’S CRICKET`}</Text></View><Text accessibilityRole="header" style={s.title}>{club.name}</Text>{club.home_ground_location ? <Text style={s.location}>{club.home_ground_location}</Text> : null}<ProfileFollow slug={club.slug} /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>{sections.map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: section === value }} onPress={() => setSection(value)} style={[s.tab, section === value && s.activeTab]}><Text style={[s.tabText, section === value && s.activeText]}>{value}</Text></Pressable>)}</ScrollView>
      {section === 'Overview' ? <View style={s.section}><Text accessibilityRole="header" style={s.heading}>Club information</Text><View style={s.facts}><Text style={s.label}>HOME GROUND</Text><Text style={s.fact}>{club.home_ground_name || club.home_ground || 'Not yet published'}</Text><View style={s.factPair}>{[['CAPTAIN', club.captain], ['COACH', club.coach]].map(([label, value]) => <View key={label} style={s.factPart}><Text style={s.label}>{label}</Text><Text style={s.fact}>{value || 'Not yet published'}</Text></View>)}</View></View>{club.description ? <Text style={s.description}>{club.description.replace(/<[^>]*>/g, '')}</Text> : null}<Pressable accessibilityRole="button" onPress={() => setSection('Squad')} style={s.squad}><View style={s.squadText}><Text style={s.fact}>Meet the squad</Text><Text style={s.location}>Players, roles and profiles</Text></View><Text style={s.arrow}>›</Text></Pressable><Text style={s.note}>Club details from published NPL records</Text></View> : section === 'Squad' ? <TeamSquad club={club} /> : section === 'Matches' ? <TeamMatches club={club} /> : <TeamStats club={club} />}
      <Link href="/account/teams" style={s.directory}>Browse all teams →</Link>
    </> : null}
  </ScrollView>
}
const s = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, paddingBottom: 40, gap: 18 }, identity: { padding: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, gap: 14 }, top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, division: { color: colors.brand, backgroundColor: '#fff7f3', paddingVertical: 7, paddingHorizontal: 9, borderRadius: 20, fontSize: 10, fontWeight: '700', flexShrink: 1 }, title: { color: colors.ink, fontSize: 25, lineHeight: 30, fontWeight: '800' }, location: { color: colors.muted, fontSize: 13, lineHeight: 19 }, tabs: { flexDirection: 'row', gap: 22, borderBottomWidth: 1, borderBottomColor: colors.line }, tab: { minHeight: 44, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' }, activeTab: { borderBottomColor: colors.brand }, tabText: { color: colors.muted, fontSize: 14 }, activeText: { color: colors.brand, fontWeight: '700' }, section: { gap: 16 }, heading: { color: colors.ink, fontSize: 21, fontWeight: '700' }, facts: { padding: 18, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 7 }, label: { color: colors.muted, fontSize: 10, letterSpacing: 0.8 }, fact: { color: colors.ink, fontSize: 15, lineHeight: 22, fontWeight: '600' }, factPair: { flexDirection: 'row', gap: 20, paddingTop: 16, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.line }, factPart: { flex: 1, gap: 7 }, squad: { backgroundColor: '#fff7f3', borderWidth: 1, borderColor: '#fee9df', borderRadius: 12, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' }, squadText: { flex: 1, gap: 4 }, arrow: { fontSize: 26, color: colors.brand }, note: { color: colors.muted, fontSize: 11 }, description: { color: colors.muted, lineHeight: 24, fontSize: 15 }, directory: { color: colors.brand, fontSize: 14, paddingVertical: 14, fontWeight: '700' } })
