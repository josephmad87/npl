import { useCallback, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { computeSeasonStandings, formatStandingsNrr, isRegularSeasonMatch, sortStandingsDesc } from '../../../website/src/lib/leagueSeasonAggregates'
import { buildBattingLeaderboard, buildBowlingLeaderboard } from '../../../website/src/lib/leagueStatsBuild'
import type { MatchLite } from '../../../website/src/lib/match-types'
import { SiteLink } from '../components/app-link'
import { MatchCard } from '../components/match-card'
import { NativeTable } from '../components/native-table'
import { Action, LoadState, Screen, Segments, ui } from '../components/native-ui'
import { TeamEmblem } from '../components/team-ui'
import { CompetitionRow } from './tournaments-screen'
import type { Fixture } from '../lib/feed'
import type { Division, SeasonSection } from '../lib/native-path'
import { usePublic } from '../lib/public-resource'
import { allPages, loadClubs, type Club } from '../lib/team-data'
import { loadTournaments, type Tournament, type Season } from '../lib/tournament-data'
import { usePagedPublic } from '../lib/use-paged-public'
import { useTeamResource } from '../lib/use-team-resource'
import { colors } from '../theme'

const divisions = [{ value: 'all', label: 'All' }, { value: 'mens', label: 'Men' }, { value: 'women', label: 'Women' }, { value: 'youth', label: 'Youth' }] as const
const sections = [{ value: 'fixtures', label: 'Fixtures' }, { value: 'results', label: 'Results' }, { value: 'standings', label: 'Standings' }, { value: 'stats', label: 'Stats' }, { value: 'teams', label: 'Teams' }] as const
const statsSections = [{ value: 'batting', label: 'Batting' }, { value: 'bowling', label: 'Bowling' }] as const
const labels: Record<string, string> = {
  'womens-npl': 'Women’s NPL', 'youth-national-premier-league': 'Youth NPL',
}
type League = Tournament & { seasons: Season[] }
type RegisteredSeason = Season & { team_ids: number[] }
type Adjustment = { team_id: number; points_delta: number }
type StatPlayers = { players: { id: number; full_name: string; team_id: number }[] }

export function CompetitionsScreen({ initial }: { initial?: Division }) {
  const [division, setDivision] = useState<Division | 'all'>(initial || 'all')
  const resource = useTeamResource('tournament-directory-v1', loadTournaments)
  const clubs = useTeamResource('clubs-v1', loadClubs, { maxAge: 300_000 })
  const leagues = resource.data?.filter(league => division === 'all' || league.category === division)
  return <Screen back="Back" title="Competitions" refreshing={resource.loading && Boolean(resource.data)} onRefresh={() => void resource.refresh()}>
    <Segments value={division} options={divisions} onChange={setDivision} />
    <LoadState loading={resource.loading && !resource.data} error={resource.error} retry={() => void resource.refresh()}
      empty={leagues && !leagues.length ? 'No competitions have been published for this division.' : undefined} />
    {leagues?.map(league => <CompetitionRow key={league.id} league={league} teams={clubs.data || []} section="standings" />)}
  </Screen>
}

export function LeagueScreen({ slug, season, initial = 'standings' }: { slug: string; season?: string; initial?: SeasonSection }) {
  const leaguePath = '/leagues/' + encodeURIComponent(slug)
  const resource = usePublic<League>(leaguePath)
  const [chosen, setChosen] = useState(season)
  const [section, setSection] = useState<SeasonSection>(initial)
  const [choosing, setChoosing] = useState(false)
  const data = resource.data
  const current = data?.seasons.find(item => item.slug === chosen) || data?.seasons[0]
  const clubs = useTeamResource('clubs-v1', loadClubs, { maxAge: 300_000 })
  return <Screen back="Back" title={data ? labels[slug] || data.name : 'Competition'} pinned={current && data ? <View style={s.pinned}>
      {data.seasons.length > 1
        ? <Action tone="secondary" label={current.name + ' ▾'} onPress={() => setChoosing(value => !value)} />
        : <Text style={ui.rowTitle}>{current.name}</Text>}
      {choosing ? <View style={ui.menu}>
        {data.seasons.map(item => <Pressable key={item.id} accessibilityRole="button" style={item.id === current.id && ui.soft}
          accessibilityState={{ selected: item.id === current.id }} onPress={() => { setChosen(item.slug); setChoosing(false) }}>
          <Text style={[ui.link, { paddingHorizontal: 12 }]}>{item.name}</Text>
        </Pressable>)}
      </View> : null}
      <Segments value={section} options={sections} onChange={setSection} />
    </View> : undefined}>
    <LoadState loading={resource.loading && !data} error={resource.error} retry={() => void resource.refresh()}
      empty={data && !current ? 'No seasons have been published.' : undefined} />
    {current && data ? <>
      {section === 'results' || section === 'fixtures'
        ? <SeasonMatches key={section + current.id} seasonId={current.id} mode={section} clubs={clubs.data || []} />
        : section === 'teams' ? <SeasonTeams leaguePath={leaguePath} season={current} clubs={clubs.data || []}
          loading={clubs.loading} error={clubs.error} retry={() => void clubs.refresh()} />
          : <SeasonAnalysis key={current.id} leaguePath={leaguePath} season={current} section={section} clubs={clubs.data || []} />}
    </> : null}
  </Screen>
}

function SeasonTeams({ leaguePath, season, clubs, loading, error, retry }: {
  leaguePath: string; season: Season; clubs: Club[]; loading: boolean; error?: string; retry: () => void
}) {
  const resource = usePublic<RegisteredSeason>(leaguePath + '/seasons/' + encodeURIComponent(season.slug))
  const teams = clubs.filter(club => resource.data?.team_ids.includes(club.id))
  return <>
    <LoadState loading={resource.loading || loading && !clubs.length} error={resource.error || error}
      retry={() => { void resource.refresh(); retry() }}
      empty={resource.data && !resource.data.team_ids.length ? 'No teams are registered for this season.' : undefined} />
    {teams.length ? <View style={s.grid}>
      {teams.map(club => <SiteLink key={club.id} path={'/teams/' + club.slug} asChild push>
        <Pressable accessibilityRole="link" style={StyleSheet.flatten([ui.panel, s.club])}>
          <TeamEmblem name={club.name} uri={club.logo_url} size={32} />
          <Text style={[ui.rowTitle, s.clubName]}>{club.short_name || club.name}</Text>
        </Pressable>
      </SiteLink>)}
    </View> : null}
  </>
}

function SeasonMatches({ seasonId, mode, clubs }: { seasonId: number; mode: 'results' | 'fixtures'; clubs: Club[] }) {
  const resource = usePagedPublic<Fixture>('/' + mode + '?season_id=' + seasonId, 5)
  return <>
    <LoadState loading={resource.loading && !resource.data} error={resource.error} retry={() => void resource.refresh()}
      empty={resource.data && !resource.items.length ? 'No ' + mode + ' have been published for this season.' : undefined} />
    {resource.items.map(match => <MatchCard key={match.id} match={match} teams={clubs} compact />)}
    {resource.moreError ? <Text accessibilityRole="alert" style={ui.muted}>{resource.moreError}</Text> : null}
    {resource.hasMore ? <Action label={'Show 5 more ' + mode} tone="secondary" busy={resource.loadingMore} onPress={() => void resource.more()} /> : null}
  </>
}

const s = StyleSheet.create({
  pinned: { backgroundColor: colors.background, gap: 8, paddingBottom: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  club: { flexGrow: 1, flexBasis: '46%', maxWidth: '50%', flexDirection: 'row', alignItems: 'center', padding: 10 },
  clubName: { flex: 1 },
})

function SeasonAnalysis({ leaguePath, season, section, clubs }: {
  leaguePath: string; season: Season; section: 'standings' | 'stats'; clubs: Club[]
}) {
  const load = useCallback((signal: AbortSignal) => allPages<MatchLite>('/public/results?season_id=' + season.id, signal), [season.id])
  const results = useTeamResource('season-results-full:' + season.id, load, { maxAge: 60_000 })
  const detail = usePublic<RegisteredSeason>(section === 'standings' ? leaguePath + '/seasons/' + encodeURIComponent(season.slug) : null)
  const adjustments = usePublic<Adjustment[]>(section === 'standings' ? '/seasons/' + season.id + '/standing-adjustments' : null)
  const players = usePublic<StatPlayers>(section === 'stats' ? '/seasons/' + season.id + '/stats-details' : null)
  const [format, setFormat] = useState<'batting' | 'bowling'>('batting')
  const [limit, setLimit] = useState(20)
  const names = useMemo(() => new Map(players.data?.players.map(player => [player.id, player.full_name])), [players.data])
  const clubsById = useMemo(() => new Map(clubs.map(club => [club.id, club])), [clubs])
  const standings = useMemo(() => {
    if (!results.data || !detail.data || !adjustments.data) return []
    const penalties = Object.fromEntries(adjustments.data.map(row => [row.team_id, row.points_delta]))
    return sortStandingsDesc(computeSeasonStandings(results.data.filter(isRegularSeasonMatch), detail.data.team_ids, penalties))
  }, [results.data, detail.data, adjustments.data])
  const batting = useMemo(() => section === 'stats' && results.data ? buildBattingLeaderboard(results.data) : [], [section, results.data])
  const bowling = useMemo(() => section === 'stats' && results.data ? buildBowlingLeaderboard(results.data) : [], [section, results.data])
  const error = results.error || detail.error || adjustments.error || players.error
  const retry = () => void Promise.all([results.refresh(), detail.refresh(), adjustments.refresh(), players.refresh()])
  const ready = Boolean(results.data && (section === 'stats' ? players.data : detail.data && adjustments.data))
  const statsCount = format === 'batting' ? batting.length : bowling.length

  return <>
    <Text accessibilityRole="header" style={ui.heading}>{section === 'standings' ? 'Points table' : 'Player stats'}</Text>
    <LoadState loading={!ready && !error} error={error} retry={retry} />
    {ready && section === 'standings' ? standings.length ? <>
      <NativeTable columns={['Team', 'P', 'W', 'L', 'T', 'NR', 'BP', 'Pts', 'NRR']} rows={standings.map((row, index) => {
        const club = clubsById.get(row.teamId)
        return { id: row.teamId, path: club ? '/teams/' + club.slug : undefined,
          cells: [String(index + 1) + '  ' + (club?.short_name || club?.name || 'Team ' + row.teamId),
            ...[row.played, row.won, row.lost, row.tied, row.nr, row.battingBonusPoints + row.chaseBonusPoints,
              row.points, formatStandingsNrr(row.nrr)].map(String)] }
      })} />
      <Text style={ui.muted}>P Played · W Won · Pts Points · NRR Net run rate. Swipe the table for further columns.</Text>
    </> : <Text style={ui.muted}>No teams are registered for this season.</Text> : null}
    {ready && section === 'stats' ? <>
      <Segments value={format} options={statsSections} onChange={value => { setFormat(value); setLimit(20) }} />
      {statsCount ? format === 'batting'
        ? <NativeTable columns={['Batter', 'R', 'M', 'I', 'HS', 'Avg', 'SR', '4s', '6s', '50s', '100s']}
          rows={batting.slice(0, limit).map(row => ({ id: row.playerId, cells: [
            names.get(row.playerId) || 'Player ' + row.playerId,
            ...[row.r, row.m, row.i, row.hs, row.avg, row.sr, row.s4, row.s6, row.c50, row.c100].map(String),
          ] }))} />
        : <NativeTable columns={['Bowler', 'W', 'O', 'M', 'R', 'Econ', 'SR', 'Mdns', 'Ct', 'St']}
          rows={bowling.slice(0, limit).map(row => ({ id: row.playerId, cells: [
            names.get(row.playerId) || 'Player ' + row.playerId,
            ...[row.wk, row.o, row.m, row.r, row.econ, row.sr, row.maid, row.catches, row.stumpings].map(String),
          ] }))} />
        : <Text style={ui.muted}>No {format} figures have been published for this season.</Text>}
      {statsCount > limit ? <Action label="Show 20 more players" tone="secondary" onPress={() => setLimit(value => value + 20)} /> : null}
    </> : null}
  </>
}
