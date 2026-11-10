import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { allPages, clubPath, loadClubs, loadSeasonDirectory, seasonsForClub, teamRequest, type Club, type Player, type SeasonRecord } from '../lib/team-data'
import type { Fixture } from '../lib/feed'
import { useTeamResource } from '../lib/use-team-resource'
import { ResourceState, TeamEmblem } from './team-ui'
import { MatchCard } from './match-card'
import { colors } from '../theme'
function useRecords(club: Club) {
  const load = useCallback((signal: AbortSignal) => teamRequest<SeasonRecord[]>(`${clubPath(club.slug)}/season-records`, signal), [club.slug])
  return useTeamResource(`records-${club.slug}`, load)
}
export function TeamSquad({ club }: { club: Club }) {
  const directory = useTeamResource('season-directory-v1', loadSeasonDirectory)
  const [chosen, setChosen] = useState<number | null>(null)
  const seasons = seasonsForClub(directory.data || [], club.id)
  const season = seasons.find(item => item.id === chosen)
  return <View style={s.section}><Text accessibilityRole="header" style={s.heading}>Squad</Text>
    <Text style={s.caption}>{season ? `Season squad · ${season.league_name}` : 'Current club player profiles'}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.choices}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: !season }} onPress={() => setChosen(null)} style={[s.choice, !season && s.chosen]}><Text style={s.choiceText}>Current players</Text></Pressable>
      {seasons.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: season?.id === item.id }} onPress={() => setChosen(item.id)} style={[s.choice, season?.id === item.id && s.chosen]}><Text style={s.choiceText}>{item.name}</Text></Pressable>)}
    </ScrollView>
    {directory.error ? <ResourceState error="Season options could not be refreshed. Current players are still available." retry={() => void directory.refresh()} /> : directory.loading && !directory.data ? <Text style={s.caption}>Loading season options…</Text> : null}
    <Roster key={season?.id || 'current'} club={club} season={season?.id} />
  </View>
}

type SeasonSquad = { source: 'registrations' | 'match_records'; players: (Player & { season_roster_role?: string; profile_available?: boolean })[]; flags: { code: string; message: string }[] }
function Roster({ club, season }: { club: Club; season?: number }) {
  const load = useCallback(async (signal: AbortSignal): Promise<SeasonSquad> => season
    ? teamRequest<SeasonSquad>(`${clubPath(club.slug)}/season-squad?season_id=${season}`, signal)
    : { source: 'registrations', players: await allPages<Player>(`/public/players?team_id=${club.id}`, signal), flags: [] }, [club.id, club.slug, season])
  const roster = useTeamResource(`season-squad-v1-${club.id}-${season || 'current'}`, load)
  const data = roster.data
  return <View style={s.section}>
    <ResourceState loading={roster.loading && !data} error={roster.error} empty={data?.players.length === 0 ? season ? 'No reliable player records are available for this season yet. Current players lists today’s club profiles.' : 'No current player profiles have been published for this club.' : undefined} retry={() => void roster.refresh()} />
    {season && data?.players.length ? <Text style={s.caption}>{data.source === 'registrations' ? 'Official season registrations, including standby players.' : 'Players identified in published match records. The official registration list is missing; this list may be incomplete.'}</Text> : null}
    {data?.flags.some(flag => ['conflicting_team_evidence', 'unregistered_match_player'].includes(flag.code)) ? <Text style={s.caption}>Some player records need review. Unconfirmed assignments have not been added to this squad.</Text> : null}
    {data?.players.map(player => {
      const content = <><TeamEmblem name={player.full_name} uri={player.profile_photo_url} size={44} /><View style={s.playerText}><Text style={s.name}>{player.full_name}</Text>{player.role ? <Text style={s.caption}>{player.role}</Text> : null}{season && player.season_roster_role === 'standby' ? <Text style={s.caption}>Standby</Text> : null}</View></>
      return player.profile_available === false
        ? <View key={player.id} style={s.player}>{content}</View>
        : <Link key={player.id} href={{ pathname: '/page', params: { path: `/players/${player.slug}`, title: player.full_name } }} asChild><Pressable accessibilityRole="link" style={s.player}>{content}<Text style={s.arrow}>›</Text></Pressable></Link>
    })}
  </View>
}
export function TeamMatches({ club }: { club: Club }) {
  const upcomingLoad = useCallback((signal: AbortSignal) => allPages<Fixture>(`/public/fixtures?team_id=${club.id}`, signal), [club.id])
  const resultsLoad = useCallback((signal: AbortSignal) => allPages<Fixture>(`/public/results?team_id=${club.id}`, signal), [club.id])
  const fixtures = useTeamResource(`fixtures-${club.id}`, upcomingLoad)
  const results = useTeamResource(`results-${club.id}`, resultsLoad)
  const clubs = useTeamResource('clubs-v1', loadClubs)
  const teams = (clubs.data || [club]).map(team => ({ id: team.id, name: team.name, logo_url: team.logo_url || undefined }))
  return <View style={s.section}><Text accessibilityRole="header" style={s.heading}>Upcoming matches</Text><ResourceState loading={fixtures.loading && !fixtures.data} error={fixtures.error} empty={fixtures.data?.length === 0 ? 'No upcoming fixtures have been published.' : undefined} retry={() => void fixtures.refresh()} />{fixtures.data?.map(match => <MatchCard key={match.id} match={match} teams={teams} />)}<Text accessibilityRole="header" style={s.heading}>Recent results</Text><ResourceState loading={results.loading && !results.data} error={results.error} empty={results.data?.length === 0 ? 'No results have been published.' : undefined} retry={() => void results.refresh()} />{results.data?.slice(0, 10).map(match => <MatchCard key={match.id} match={match} teams={teams} />)}{results.data && results.data.length > 10 ? <Text style={s.caption}>Showing the latest 10 results.</Text> : null}</View>
}
export function TeamStats({ club }: { club: Club }) {
  const records = useRecords(club)
  return <View style={s.section}><Text accessibilityRole="header" style={s.heading}>Season records</Text><Text style={s.caption}>Official completed-match records, grouped by season.</Text><ResourceState loading={records.loading && !records.data} error={records.error} empty={records.data?.length === 0 ? 'Season statistics are not yet available for this team.' : undefined} retry={() => void records.refresh()} />{records.data?.map(record => <View style={s.record} key={record.season_id}><Text style={s.name}>{record.season_name}</Text><Text style={s.caption}>{record.league_name}</Text><View style={s.numbers}>{[['Played', record.played], ['Wins', record.wins], ['Losses', record.losses], ['No result', record.no_result]].map(([label, value]) => <View key={label} style={s.stat}><Text style={s.number}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>)}</View></View>)}</View>
}
const s = StyleSheet.create({ section: { gap: 14 }, heading: { color: colors.ink, fontSize: 21, fontWeight: '700' }, caption: { color: colors.muted, fontSize: 13, lineHeight: 20 }, season: { color: colors.brand, fontSize: 13, fontWeight: '700' }, choices: { gap: 8 }, choice: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 12, minHeight: 44, justifyContent: 'center' }, chosen: { backgroundColor: '#fee9df', borderColor: colors.brand }, choiceText: { color: colors.ink, fontSize: 12 }, player: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.line }, playerText: { flex: 1, gap: 4 }, name: { color: colors.ink, fontSize: 15, fontWeight: '700', lineHeight: 22 }, arrow: { color: colors.brand, fontSize: 24 }, record: { padding: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, gap: 8 }, numbers: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingTop: 10 }, stat: { minWidth: 50, gap: 4 }, number: { color: colors.ink, fontSize: 24, fontWeight: '800' }, statLabel: { color: colors.muted, fontSize: 11 } })
