import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SiteLink } from '../components/app-link'
import { FollowButton } from '../components/follow-button'
import { formatDate, MatchCard, shortTeamName } from '../components/match-card'
import { NativeTable } from '../components/native-table'
import { Action, Field, LoadState, Screen, Segments, ui } from '../components/native-ui'
import { RichText } from '../components/rich-text'
import { TeamEmblem } from '../components/team-ui'
import type { Article, Fixture } from '../lib/feed'
import { publicRequest, usePublic, type Page } from '../lib/public-resource'
import { allPages, divisionLabel, loadClubs, type Club, type Player, type SeasonRecord } from '../lib/team-data'
import { useTeamResource } from '../lib/use-team-resource'
import { colors } from '../theme'

type Filter = 'all' | 'team' | 'player' | 'match' | 'news' | 'league'
type SearchItem = { id: string; path: string; title: string; detail?: string; image?: string | null }
type SearchResult = { category: Filter; label: string; items: SearchItem[]; total: number }
const filters: readonly { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'team', label: 'Teams' }, { value: 'player', label: 'Players' },
  { value: 'match', label: 'Matches' }, { value: 'news', label: 'News' }, { value: 'league', label: 'Competitions' },
]

export function SearchScreen({ initialQuery, initialFilter }: { initialQuery: string; initialFilter?: string }) {
  const first = filters.find(item => item.value === initialFilter)?.value || (initialFilter === 'fixture' || initialFilter === 'result' ? 'match' : 'all')
  const [query, setQuery] = useState(initialQuery)
  const [debounced, setDebounced] = useState(initialQuery)
  const [filter, setFilter] = useState<Filter>(first)
  const [limit, setLimit] = useState(10)
  const clubs = useTeamResource('clubs-v1', loadClubs, { maxAge: 300_000 })
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 275)
    return () => clearTimeout(timer)
  }, [query])
  const search = useCallback(async (signal: AbortSignal) => {
    const encoded = encodeURIComponent(debounced)
    const size = filter === 'all' ? 4 : limit
    const href = (kind: string) => '/' + kind + '?q=' + encoded + '&page_size=' + size
    const group = <T,>(category: Filter, label: string, raw: Page<T>, map: (item: T) => SearchItem): SearchResult =>
      ({ category, label, items: raw.items.map(map), total: raw.total })

    const jobs: Promise<SearchResult>[] = []
    if (filter === 'all' || filter === 'team') jobs.push(publicRequest<Page<Club>>(href('teams'), signal).then(raw =>
      group('team', 'Teams', raw, item => ({ id: 'team' + item.id, path: '/teams/' + item.slug, title: item.name, detail: divisionLabel(item.category), image: item.logo_url }))))
    if (filter === 'all' || filter === 'player') jobs.push(publicRequest<Page<Player>>(href('players'), signal).then(raw =>
      group('player', 'Players', raw, item => ({ id: 'player' + item.id, path: '/players/' + item.slug, title: item.full_name, detail: item.role || undefined, image: item.profile_photo_url }))))
    if (filter === 'all' || filter === 'league') jobs.push(publicRequest<Page<{ id: number; slug: string; name: string; category: string }>>(href('leagues'), signal).then(raw =>
      group('league', 'Competitions', raw, item => ({ id: 'league' + item.id, path: '/leagues/' + item.slug, title: item.name, detail: divisionLabel(item.category) }))))
    if (filter === 'all' || filter === 'news') jobs.push(publicRequest<Page<Article>>(href('news'), signal).then(raw =>
      group('news', 'News', raw, item => ({ id: 'news' + item.id, path: '/news/' + item.slug, title: item.title, detail: formatDate(item.published_at || item.created_at, true), image: item.featured_image_url }))))
    if (filter === 'all' || filter === 'match') {
      const name = (id: number) => shortTeamName(clubs.data?.find(item => item.id === id)?.name || 'Team ' + id)
      const entries = (kind: 'results' | 'fixtures') => publicRequest<Page<Fixture>>(href(kind), signal).then(raw =>
        group('match', kind === 'results' ? 'Results' : 'Fixtures', raw, match => ({
          id: kind + match.id, path: '/matches/' + match.id,
          title: name(match.home_team_id) + ' vs ' + name(match.away_team_id),
          detail: [formatDate(match.match_date), match.venue].filter(Boolean).join(' · '),
        })))
      jobs.push(entries('results'), entries('fixtures'))
    }
    const outcomes = await Promise.allSettled(jobs)
    const groups = outcomes.flatMap(outcome => outcome.status === 'fulfilled' ? [outcome.value] : [])
    if (!groups.length) throw new Error('Search is unavailable. Try again.')
    return { groups, partial: groups.length !== outcomes.length }
  }, [debounced, filter, limit, clubs.data])
  const resource = useTeamResource(debounced && (clubs.data || clubs.error) ? 'search:' + filter + ':' + limit + ':' + debounced : null, search, { persist: false, maxAge: 0 })
  const data = resource.data
  const more = data?.groups.some(group => group.items.length < group.total)
  const hasResults = data?.groups.some(group => group.items.length)
  return <Screen back="Back" title="Search app">
    <Field label="Search NPL" value={query} onChangeText={value => { setQuery(value); setLimit(10) }}
      placeholder="Team, player, match or competition" autoCorrect={false} returnKeyType="search" maxLength={120} clearButtonMode="while-editing" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.searchFilters}>
      {filters.map(option => <Pressable accessibilityRole="tab" accessibilityState={{ selected: option.value === filter }}
        key={option.value} onPress={() => { setFilter(option.value); setLimit(10) }}
        style={[s.chip, option.value === filter && s.chipSelected]}>
        <Text style={option.value === filter ? s.chipSelectedText : ui.rowTitle}>{option.label}</Text>
      </Pressable>)}
    </ScrollView>
    <LoadState loading={Boolean(debounced) && (resource.loading && !data || clubs.loading && !clubs.data)}
      error={resource.error} retry={() => void resource.refresh()}
      empty={query.trim() && data && !hasResults ? 'No results match your search.' : undefined} />
    {!query.trim() ? <View style={ui.menu}>
      <SiteLink path="/teams" push style={[ui.link, s.result]}>Browse teams ›</SiteLink>
      <View style={ui.divider} />
      <SiteLink path="/competition" push style={[ui.link, s.result]}>Browse competitions ›</SiteLink>
    </View> : null}
    {data?.partial ? <Text style={ui.muted}>Some results could not load. <Text style={ui.link} onPress={() => void resource.refresh()}>Try again</Text></Text> : null}
    {data?.groups.filter(group => group.items.length).map(group => <View key={group.label} style={s.group}>
      <Text accessibilityRole="header" style={ui.heading}>{group.label}</Text>
      <View style={ui.menu}>
        {group.items.map(item => <SiteLink key={item.id} path={item.path} asChild push><Pressable accessibilityRole="link" style={[ui.row, s.result]}>
          {item.image ? <TeamEmblem name={item.title} uri={item.image} size={36} /> : null}
          <View style={s.fill}><Text style={ui.rowTitle}>{item.title}</Text>{item.detail ? <Text style={ui.muted}>{item.detail}</Text> : null}</View>
          <Text style={ui.link} accessible={false}>›</Text>
        </Pressable></SiteLink>)}
      </View>
      {filter === 'all' && group.total > group.items.length
        ? <Action tone="secondary" label={'View more ' + group.label.toLowerCase()} onPress={() => setFilter(group.category)} /> : null}
    </View>)}
    {filter !== 'all' && more && limit < 100 ? <Action tone="secondary" label="Show more results" onPress={() => setLimit(value => Math.min(value + 10, 100))} /> : null}
  </Screen>
}

type PlayerProfile = Player & {
  team_id: number; batting_style?: string | null; bowling_style?: string | null; bio?: string | null;
  matches_played: number; runs_scored: number; wickets_taken: number; batting_average?: number | null;
  strike_rate?: number | null; highest_score?: number | null; bowling_average?: number | null; best_bowling?: string | null;
  economy_rate?: number | null; catches: number; stumpings: number; run_outs: number;
}
type Appearance = {
  stat_id: number; match_id: number; match_date?: string; home_team_name: string; away_team_name: string; venue?: string
  league_name?: string; runs: number; balls_faced: number; fours: number; sixes: number; wickets: number; runs_conceded: number
}
const playerSections = [{ value: 'overview', label: 'Overview' }, { value: 'matches', label: 'Matches' }, { value: 'stats', label: 'Stats' }] as const

export function PlayerProfileScreen({ slug }: { slug: string }) {
  const path = '/players/' + encodeURIComponent(slug)
  const profile = usePublic<PlayerProfile>(path)
  const appearances = usePublic<Appearance[]>(path + '/match-appearances', { maxAge: 90_000 })
  const clubs = useTeamResource('clubs-v1', loadClubs, { maxAge: 300_000 })
  const [section, setSection] = useState<typeof playerSections[number]['value']>('overview')
  const [limit, setLimit] = useState(5)
  const player = profile.data
  const team = clubs.data?.find(club => club.id === player?.team_id)
  const last = appearances.data?.[0]
  return <Screen back="Back" title={player ? undefined : 'Player profile'}>
    <LoadState loading={profile.loading && !player} error={profile.error} retry={() => void profile.refresh()} />
    {player ? <>
      <View style={ui.panel}>
        <View style={ui.row}>
          <TeamEmblem name={player.full_name} uri={player.profile_photo_url || team?.logo_url} size={54} />
          {team ? <SiteLink path={'/teams/' + team.slug} style={[ui.link, s.fill]}>{team.name}</SiteLink> : null}
        </View>
        <Text accessibilityRole="header" style={ui.title}>{player.full_name}</Text>
        <Text style={ui.muted}>{[player.role, player.batting_style, player.bowling_style].filter(Boolean).join(' · ')}</Text>
        <FollowButton id={player.id} kind="player" />
      </View>
      <Segments value={section} options={playerSections} onChange={setSection} />
      {section === 'overview' ? <>
        {last ? <View style={[ui.panel, ui.soft]}>
          <Text style={ui.heading}>Latest match</Text>
          <Text style={ui.muted}>{[last.league_name, formatDate(last.match_date, true)].filter(Boolean).join(' · ')}</Text>
          <View style={s.metrics}>{[['Runs', last.runs], ['Balls', last.balls_faced], ['Fours', last.fours], ['Sixes', last.sixes]].map(([label, value]) =>
            <View key={label}><Text style={s.figure}>{value}</Text><Text style={ui.muted}>{label}</Text></View>)}</View>
          <SiteLink path={'/matches/' + last.match_id} section="scorecard" style={ui.link}>View match scorecard ›</SiteLink>
        </View> : <LoadState loading={appearances.loading} error={appearances.error} retry={() => void appearances.refresh()} />}
        <RichText content={player.bio} basePath={path} />
      </> : section === 'matches' ? <>
        <LoadState loading={appearances.loading && !appearances.data} error={appearances.error} retry={() => void appearances.refresh()}
          empty={appearances.data && !appearances.data.length ? 'No match appearances have been published.' : undefined} />
        {appearances.data?.slice(0, limit).map(match => <SiteLink key={match.stat_id} path={'/matches/' + match.match_id} section="scorecard" asChild>
          <Pressable accessibilityRole="link" style={ui.panel}>
            <Text style={ui.rowTitle}>{shortTeamName(match.home_team_name)} vs {shortTeamName(match.away_team_name)}</Text>
            <Text style={ui.muted}>{[formatDate(match.match_date), match.league_name].filter(Boolean).join(' · ')}</Text>
            <Text style={ui.muted}>{match.runs} runs · {match.wickets} wickets</Text>
          </Pressable>
        </SiteLink>)}
        {(appearances.data?.length || 0) > limit ? <Action tone="secondary" label="Show 5 more matches" onPress={() => setLimit(value => value + 5)} /> : null}
      </> : <View style={ui.panel}>
        <Text accessibilityRole="header" style={ui.heading}>Career totals</Text>
        {[
          ['Matches', player.matches_played], ['Runs', player.runs_scored], ['Highest score', player.highest_score],
          ['Batting average', player.batting_average], ['Strike rate', player.strike_rate], ['Wickets', player.wickets_taken],
          ['Best bowling', player.best_bowling], ['Bowling average', player.bowling_average], ['Economy', player.economy_rate],
          ['Catches', player.catches], ['Stumpings', player.stumpings], ['Run outs', player.run_outs],
        ].map(([label, value]) => <View key={label} style={s.metrics}>
          <Text style={ui.muted}>{label}</Text><Text style={ui.rowTitle}>{value ?? '—'}</Text>
        </View>)}
      </View>}
    </> : null}
  </Screen>
}

const compareSections = [{ value: 'record', label: 'Season record' }, { value: 'form', label: 'Recent form' }, { value: 'head', label: 'Head-to-head' }] as const
type CompareSection = typeof compareSections[number]['value']

export function CompareTeamsScreen() {
  const clubs = useTeamResource('clubs-v1', loadClubs, { maxAge: 300_000 })
  const [left, setLeft] = useState<Club>()
  const [right, setRight] = useState<Club>()
  const [choosing, setChoosing] = useState<'left' | 'right' | null>(null)
  const [query, setQuery] = useState('')
  const [section, setSection] = useState<CompareSection>('head')
  const list = clubs.data?.filter(item => item.id !== (choosing === 'left' ? right?.id : left?.id)
    && item.name.toLowerCase().includes(query.trim().toLowerCase()))
  return <Screen back="My NPL" title="Compare teams">
    <LoadState loading={clubs.loading && !clubs.data} error={clubs.error} retry={() => void clubs.refresh()} />
    <View style={ui.row}>
      <ClubPicker club={left} label="First team" onPress={() => { setQuery(''); setChoosing(choosing === 'left' ? null : 'left') }} />
      <Text style={ui.muted}>vs</Text>
      <ClubPicker club={right} label="Second team" onPress={() => { setQuery(''); setChoosing(choosing === 'right' ? null : 'right') }} />
    </View>
    {choosing ? <View style={ui.panel}>
      <Field label="Find a team" value={query} onChangeText={setQuery} placeholder="Team name" />
      {list?.map(team => <Action key={team.id} tone="secondary" label={team.name} onPress={() => {
        if (choosing === 'left') setLeft(team); else setRight(team)
        setChoosing(null)
      }} />)}
      {list && !list.length ? <Text style={ui.muted}>No teams match this search.</Text> : null}
    </View> : null}
    {left && right ? <>
      <Segments value={section} options={compareSections} onChange={setSection} />
      <TeamComparison key={left.id + ':' + right.id + ':' + section} left={left} right={right} section={section} clubs={clubs.data || []} />
    </> : <Text style={ui.muted}>Choose two teams to compare their results.</Text>}
  </Screen>
}

function ClubPicker({ club, label, onPress }: { club?: Club; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label + (club ? ': ' + club.name : '')} style={[ui.panel, s.fill]} onPress={onPress}>
    {club ? <TeamEmblem name={club.name} uri={club.logo_url} size={42} /> : null}
    <Text style={ui.rowTitle}>{club ? shortTeamName(club.name) : label} ▾</Text>
  </Pressable>
}

function TeamComparison({ left, right, section, clubs }: { left: Club; right: Club; section: CompareSection; clubs: Club[] }) {
  const getHead = useCallback((signal: AbortSignal) => allPages<Fixture>('/public/results?team_id=' + left.id, signal)
    .then(matches => matches.filter(match => [match.home_team_id, match.away_team_id].includes(right.id))), [left.id, right.id])
  const head = useTeamResource(section === 'head' ? 'comparison:' + left.id + ':' + right.id : null, getHead, { persist: false })
  const leftForm = usePublic<Page<Fixture>>(section === 'form' ? '/results?team_id=' + left.id + '&page_size=5' : null)
  const rightForm = usePublic<Page<Fixture>>(section === 'form' ? '/results?team_id=' + right.id + '&page_size=5' : null)
  const leftRecord = usePublic<SeasonRecord[]>(section === 'record' ? '/teams/' + left.slug + '/season-records' : null)
  const rightRecord = usePublic<SeasonRecord[]>(section === 'record' ? '/teams/' + right.slug + '/season-records' : null)
  const [limit, setLimit] = useState(5)
  if (section === 'head') return <>
    <Text style={ui.heading}>Latest meetings</Text>
    <LoadState loading={head.loading && !head.data} error={head.error}
      empty={head.data && !head.data.length ? 'These teams have no published head-to-head results.' : undefined} retry={() => void head.refresh()} />
    {head.data?.slice(0, limit).map(match => <MatchCard key={match.id} match={match} teams={clubs} compact />)}
    {(head.data?.length || 0) > limit ? <Action tone="secondary" label="Show 5 more meetings" onPress={() => setLimit(value => value + 5)} /> : null}
  </>
  if (section === 'form') return <>{([leftForm, rightForm] as const).map((resource, index) => <View key={index} style={s.group}>
    <Text style={ui.heading}>{shortTeamName(index === 0 ? left.name : right.name)}</Text>
    <LoadState loading={resource.loading && !resource.data} error={resource.error} retry={() => void resource.refresh()}
      empty={resource.data && !resource.data.items.length ? 'No results published.' : undefined} />
    {resource.data?.items.map(match => <MatchCard key={match.id} match={match} teams={clubs} compact />)}
  </View>)}</>
  return <>{([leftRecord, rightRecord] as const).map((resource, index) => <View key={index} style={s.group}>
    <Text style={ui.heading}>{shortTeamName(index === 0 ? left.name : right.name)}</Text>
    <LoadState loading={resource.loading && !resource.data} error={resource.error} retry={() => void resource.refresh()}
      empty={resource.data && !resource.data.length ? 'No season records published.' : undefined} />
    {resource.data?.length ? <NativeTable columns={['Season', 'P', 'W', 'L', 'NR']} rows={resource.data.map(item => ({
      id: item.season_id, cells: [item.season_name, ...[item.played, item.wins, item.losses, item.no_result].map(String)],
    }))} /> : null}
  </View>)}</>
}

const s = StyleSheet.create({
  group: { gap: 10 }, fill: { flex: 1, gap: 4 },
  searchFilters: { gap: 7, paddingVertical: 2 },
  chip: { backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 13, minHeight: 44, justifyContent: 'center' },
  chipSelected: { backgroundColor: colors.maroon },
  chipSelectedText: { color: colors.surface, fontSize: 15, fontWeight: '700' },
  result: { minHeight: 56, paddingHorizontal: 12, paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  metrics: { flexDirection: 'row', gap: 9, justifyContent: 'space-between', flexWrap: 'wrap' },
  figure: { color: colors.maroon, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
})
