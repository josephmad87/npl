import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SiteLink } from '../components/app-link'
import { ResourceState } from '../components/team-ui'
import { formatDate, matchName, shortTeamName } from '../components/match-card'
import type { Fixture, Team } from '../lib/feed'
import { usePublic, type Page } from '../lib/public-resource'
import { loadClubs } from '../lib/team-data'
import { loadTournaments, type MatchMode, type Season, type Tournament } from '../lib/tournament-data'
import type { SeasonSection } from '../lib/native-path'
import { useTeamResource } from '../lib/use-team-resource'
import { colors } from '../theme'

const divisions = [{ value: 'all', label: 'All' }, { value: 'mens', label: 'Men' }, { value: 'women', label: 'Women' }, { value: 'youth', label: 'Youth' }]
const modes = ['results', 'fixtures'] as const
const tournamentLabels: Record<string, { badge: string; name: string }> = {
  'npl-t20-blast': { badge: 'T20', name: 'NPL T20 Blast' },
  'npl-super-40': { badge: '40', name: 'Men’s Super40' },
  'womens-npl': { badge: 'W', name: 'Women’s NPL' },
  'youth-national-premier-league': { badge: 'Y', name: 'Youth NPL' },
}

export function CompetitionRow({ league, teams, section }: { league: Tournament; teams: Team[]; section: SeasonSection }) {
  const { data } = usePublic<{ seasons: Season[] }>('/leagues/' + encodeURIComponent(league.slug))
  const season = data?.seasons[0]
  const mode: MatchMode = section === 'fixtures' ? 'fixtures' : 'results'
  const preview = usePublic<Page<Fixture>>(season ? '/' + mode + '?season_id=' + season.id + '&page_size=5' : null)
  const match = preview.data?.items.find(item => mode === 'results' || item.status === 'scheduled' && item.match_date)
  const label = tournamentLabels[league.slug]
  const date = match && formatDate(match.match_date)
  const context = match && [date, [match.home_team_id, match.away_team_id].map(id =>
    shortTeamName(matchName(match, teams, id))).join(' vs ')].filter(Boolean).join(' · ')
  return <SiteLink path={'/leagues/' + league.slug} section={section} asChild push>
    <TouchableOpacity accessibilityRole="link" style={s.card}>
      <View style={s.cardRow}>
        {label ? <View style={s.badge}><Text style={s.badgeText}>{label.badge}</Text></View> : null}
        <View style={s.details}>
          <Text style={s.name}>{label?.name || league.name}</Text>
          {season ? <Text style={s.subtitle}>{season.name}</Text> : null}
        </View>
        <Text style={s.arrow} accessible={false}>›</Text>
      </View>
      {context ? <Text style={s.context}>{mode === 'results' ? 'Latest · ' : 'Next · '}{context}</Text> : null}
    </TouchableOpacity>
  </SiteLink>
}

export function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} style={[s.choice, selected && s.selected]} onPress={onPress}>
    <Text style={[s.choiceText, selected && s.selectedText]}>{label}</Text>
  </Pressable>
}

export default function TournamentsScreen() {
  const { mode: requestedMode, division: requestedDivision } = useLocalSearchParams<{ mode?: string; division?: string }>()
  const mode = requestedMode === 'fixtures' ? 'fixtures' : 'results'
  const [pickedDivision, setDivision] = useState<{ requested?: string; value: string }>()
  const division = pickedDivision?.requested === requestedDivision && pickedDivision ? pickedDivision.value : requestedDivision || 'all'
  const { data, error, loading, refresh } = useTeamResource('tournament-directory-v1', loadTournaments)
  const clubs = useTeamResource('clubs-v1', loadClubs, { maxAge: 300_000 })
  const tournaments = (data || []).filter(item => division === 'all' || item.category === division)

  return <FlatList style={s.page} contentContainerStyle={s.content} data={tournaments}
    keyExtractor={item => String(item.id)} refreshing={loading && !!data} onRefresh={() => void refresh()}
    ListHeaderComponent={<View style={s.head}>
      <Text style={s.title} accessibilityRole="header">Match centre</Text>
      <View style={s.choices}>{modes.map(value => <Choice key={value} label={value === 'results' ? 'Results' : 'Fixtures'} selected={mode === value} onPress={() => router.setParams({ mode: value })} />)}</View>
      <View style={s.choices}>{divisions.map(({ value, label }) => <Choice key={value} label={label} selected={division === value} onPress={() => setDivision({ requested: requestedDivision, value })} />)}</View>
      {error && data ? <ResourceState error={error} retry={() => void refresh()} /> : null}
    </View>}
    ListEmptyComponent={<ResourceState loading={loading} error={error} empty="No tournaments published for this division." retry={() => void refresh()} />}
    renderItem={({ item }) => <CompetitionRow league={item} teams={clubs.data || []} section={mode} />}
  />
}

export const tournamentStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 18, paddingBottom: 42, gap: 10 },
  head: { gap: 8 },
  title: { fontSize: 27, fontWeight: '800', color: colors.ink },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  selected: { backgroundColor: colors.maroon },
  choiceText: { fontWeight: '700', color: colors.ink },
  selectedText: { color: colors.surface },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, padding: 12, borderRadius: 13, gap: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  details: { flex: 1, gap: 3 },
  badge: { minWidth: 38, height: 36, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#f2e2df' },
  badgeText: { color: colors.maroon, fontSize: 13, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13 },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  context: { paddingTop: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, color: colors.muted, fontSize: 12 },
  arrow: { fontSize: 22, color: colors.brand },
  action: { minHeight: 46, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', padding: 10 },
  actionText: { color: colors.brand, fontWeight: '800' },
})
const s = tournamentStyles
