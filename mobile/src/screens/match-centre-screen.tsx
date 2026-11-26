import { useFocusEffect, useSegments, router } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import {
  formatDismissalDisplay, getInningsSides, hasBattingLine,
  hasBowlingLine, isDidNotBat, oversFieldToBalls, type InningsNumber,
} from '../../../website/src/lib/cricket'
import { SiteLink } from '../components/app-link'
import { MatchCard, matchName, shortTeamName } from '../components/match-card'
import { MatchActions } from '../components/match-actions'
import { NativeMedia } from '../components/native-media'
import { NativeTable } from '../components/native-table'
import { Action, LoadState, MenuRow, Notice, Screen, Segments, ui } from '../components/native-ui'
import { RichText } from '../components/rich-text'
import { ScorecardGalleryLink } from './gallery-screen'
import type { MatchDetail, LiveMatch, MatchBall } from '../lib/match-data'
import { useLiveMatch } from '../lib/match-data'
import { usePublic } from '../lib/public-resource'
import { loadClubs, type Club, type Player } from '../lib/team-data'
import { supporterPublicRequest, useSupporterIdentity } from '../lib/supporter-account'
import { useTeamResource } from '../lib/use-team-resource'
import { colors } from '../theme'

const sections = [{ value: 'overview', label: 'Overview' }, { value: 'scorecard', label: 'Scorecard' }, { value: 'ball', label: 'Ball by ball' }] as const
type Section = typeof sections[number]['value']
const formats = [{ value: 'batting', label: 'Batting' }, { value: 'bowling', label: 'Bowling' }] as const

export function MatchCentreScreen({ id, initial }: { id: number; initial?: string }) {
  const [section, setSection] = useState<Section>(initial === 'scorecard' || initial === 'batting' || initial === 'bowling'
    ? 'scorecard' : initial === 'ball-by-ball' || initial === 'ball' ? 'ball' : 'overview')
  const [chosenInnings, setInnings] = useState<InningsNumber>()
  const [format, setFormat] = useState<'batting' | 'bowling'>(initial === 'bowling' ? 'bowling' : 'batting')
  const match = usePublic<MatchDetail>('/matches/' + id, { maxAge: 30_000 })
  const refreshMatch = match.refresh
  const clubs = useTeamResource('clubs-v1', loadClubs, { maxAge: 300_000 })
  const isLive = match.data?.status === 'live'
  const live = useLiveMatch(isLive || section === 'ball' ? id : null, isLive)
  useEffect(() => {
    if (isLive && live.data?.status === 'completed') void refreshMatch()
  }, [isLive, live.data?.status, refreshMatch])
  const players = usePublic<Player[]>(section === 'overview' ? null : '/matches/' + id + '/eligible-players')
  const playerMap = useMemo(() => new Map(players.data?.map(player => [player.id, player])), [players.data])
  const tab = (useSegments() as string[])[1]
  const { width, fontScale } = useWindowDimensions()
  const wide = width >= 780 && fontScale <= 1.35
  const data = match.data
  const teams = clubs.data || []
  const teamName = (teamId: number) => data ? shortTeamName(matchName(data, teams, teamId)) : 'Team ' + teamId
  const first = live.data?.summaries.find(value => value.innings === 1)?.batting_team_id || data?.result?.batting_first_team_id || data?.home_team_id
  const innings = chosenInnings ?? (isLive && live.data?.current_innings === 2 ? 2 : 1)
  const sides = data ? getInningsSides(innings, first ?? null, data.home_team_id, data.away_team_id) : null
  const refresh = () => void Promise.all([match.refresh(), live.refresh(), clubs.refresh(), players.refresh()])
  const segmentControl = <Segments value={section} options={sections} onChange={setSection} />
  const actions = data ? <MatchActions match={data} teams={teams} /> : null

  return <Screen back={tab === 'home' ? 'Home' : tab === 'live' ? 'Live' : tab === 'news' ? 'News' : tab === 'account' ? 'My NPL' : 'Results'}
    title="Match centre" contentStyle={wide && s.wide} refreshing={match.loading && Boolean(data)} onRefresh={refresh}
    pinned={data ? <View style={[s.pinned, wide && s.split]}>
      <View style={wide && s.summary}><MatchCard match={data} teams={teams} live={isLive ? live.data : undefined} detail compact /></View>
      <View style={[s.navigation, wide && s.fill]}>
        {wide && data.venue ? <Text style={ui.rowTitle}>{data.venue}</Text> : null}
        {wide ? actions : null}
        {segmentControl}
      </View>
    </View> : undefined}>
    <LoadState loading={match.loading && !data} error={match.error} retry={refresh} />
    {data ? <>
      {!wide ? <>{section === 'overview' && data.venue && data.status !== 'scheduled' ? <Text style={ui.muted}>{data.venue}</Text> : null}{actions}</> : null}
      {isLive && live.error ? <Notice error>Live updates are delayed.</Notice> : null}
      {section === 'overview' ? <MatchOverview key={id} match={data} clubs={clubs.data || []} />
        : sides ? <>
          <View style={s.navigation}>
            <Text accessibilityRole="header" style={ui.heading}>Innings</Text>
            <Segments value={String(innings)} options={[
              { value: '1', label: teamName(first || data.home_team_id) },
              { value: '2', label: teamName(first === data.home_team_id ? data.away_team_id : data.home_team_id) },
            ]} onChange={value => setInnings(value === '1' ? 1 : 2)} />
          </View>
          {section === 'scorecard' ? <>
            <Segments value={format} options={formats} onChange={setFormat} />
            <LoadState loading={players.loading && !players.data} error={players.error} retry={() => void players.refresh()} />
            <Scorecard match={data} live={isLive} batting={format === 'batting'} teamId={format === 'batting' ? sides.battingTeamId : sides.bowlingTeamId} players={playerMap} />
          </> : <BallLog key={innings} data={live.data} innings={innings} players={playerMap} loading={live.loading}
            error={live.error} retry={() => void live.refresh()} />}
        </> : null}
    </> : null}
  </Screen>
}

function Scorecard({ match, live, batting, teamId, players }: {
  match: MatchDetail; live: boolean; batting: boolean; teamId: number; players: Map<number, Player>
}) {
  const refreshed = usePublic<MatchDetail>(live ? '/matches/' + match.id : null, { maxAge: 10_000, poll: 10_000, persist: false })
  const rows = (refreshed.data || match).player_stats.filter(row => row.team_id === teamId)
  const didNotBat = batting ? rows.filter(row => isDidNotBat(row.dismissal)).map(row => players.get(row.player_id)?.full_name).filter(Boolean) : []
  const scored = rows.filter(row => batting ? hasBattingLine(row) && !isDidNotBat(row.dismissal) : hasBowlingLine(row))
    .sort((a, b) => ((batting ? a.batting_order : a.bowling_order) || 999) - ((batting ? b.batting_order : b.bowling_order) || 999))
  if (!scored.length) return <Text style={ui.muted}>No {batting ? 'batting' : 'bowling'} figures have been published for this innings.</Text>
  return <>
    <NativeTable columns={batting ? ['Batter', 'R', 'B', '4s', '6s', 'SR'] : ['Bowler', 'O', 'M', 'R', 'W', 'Econ']}
      rows={scored.map(row => {
        const player = players.get(row.player_id)
        const balls = oversFieldToBalls(row.overs)
        const cells = batting
          ? [row.runs, row.balls_faced, row.fours, row.sixes, row.balls_faced ? (100 * row.runs / row.balls_faced).toFixed(2) : '—']
          : [Math.floor(balls / 6) + '.' + (balls % 6), row.maidens, row.runs_conceded, row.wickets, balls ? (6 * row.runs_conceded / balls).toFixed(2) : '—']
        return {
          id: row.id, cells: [player?.full_name || 'Player ' + row.player_id, ...cells.map(String)],
          path: player?.slug ? '/players/' + player.slug : undefined,
          detail: batting ? formatDismissalDisplay(row.dismissal) : undefined,
        }
      })} />
    {didNotBat.length ? <Text style={ui.muted}>Did not bat · {didNotBat.join(', ')}</Text> : null}
    <Text style={ui.muted}>{batting ? 'SR Strike rate' : 'O Overs  ·  M Maidens  ·  R Runs  ·  W Wickets  ·  Econ Economy'}</Text>
  </>
}

function ballSummary(ball: MatchBall, players: Map<number, Player>) {
  const bowler = players.get(ball.bowler_player_id || 0)?.full_name
  const batter = players.get(ball.striker_player_id || 0)?.full_name
  return [bowler && batter ? bowler + ' to ' + batter : '', ball.dismissal_text || (ball.wicket_type ? 'Wicket' : ''),
    ball.runs_batter ? ball.runs_batter + (ball.runs_batter === 1 ? ' run' : ' runs') : '',
    ball.runs_extras ? ball.runs_extras + ' ' + (ball.extras_type?.replaceAll('_', ' ') || 'extras') : '',
  ].filter(Boolean).join(' · ') || 'Dot ball'
}

function BallLog({ data, innings, players, loading, error, retry }: {
  data?: LiveMatch; innings: number; players: Map<number, Player>; loading: boolean; error?: string; retry: () => void
}) {
  const [limit, setLimit] = useState(30)
  const events = useMemo(() => (data?.events || []).filter(ball => ball.innings === innings).sort((a, b) => b.sequence_number - a.sequence_number), [data, innings])
  return <>
    <LoadState loading={loading && !data} error={error} retry={retry} empty={data && !events.length ? 'No ball-by-ball updates are available for this innings.' : undefined} />
    {events.slice(0, limit).map(ball => <View key={ball.id} style={[ui.panel, s.ball]}>
      <Text style={[ui.rowTitle, s.overs]}>{ball.over_number}.{ball.ball_number}</Text>
      <View style={s.fill}><Text style={ui.rowTitle}>{ballSummary(ball, players)}</Text>
        {ball.commentary ? <Text style={ui.muted}>{ball.commentary}</Text> : null}</View>
    </View>)}
    {events.length > limit ? <Action label="Show earlier balls" tone="secondary" onPress={() => setLimit(value => value + 30)} /> : null}
  </>
}

type SquadEntry = {
  id: number; player_id: number; lineup_order: number; is_captain: boolean; is_wicketkeeper: boolean
}
type Squad = { teams: { team_id: number; players: SquadEntry[] }[] }

function MatchOverview({ match, clubs }: { match: MatchDetail; clubs: Club[] }) {
  const [showLineups, setShowLineups] = useState(false)
  const [showVote, setShowVote] = useState(false)
  const squad = usePublic<Squad>(showLineups ? '/matches/' + match.id + '/squads' : null)
  const players = usePublic<Player[]>(showLineups ? '/matches/' + match.id + '/eligible-players' : null)
  const playerMap = useMemo(() => new Map(players.data?.map(player => [player.id, player])), [players.data])
  const identity = useSupporterIdentity()
  const path = '/matches/' + match.id
  return <>
    {match.toss_info ? <Text style={ui.text}>{match.toss_info}</Text> : null}
    {match.description ? <RichText content={match.description} basePath={path} /> : null}
    {match.result?.match_report ? <RichText content={match.result.match_report} basePath={path} /> : null}
    {match.result?.top_performers ? <View style={[ui.panel, ui.soft]}>
      <Text style={ui.heading}>Top performers</Text>
      {match.result.top_performers.split(';').map((text, index) => <Text key={index} style={ui.muted}>{text.trim()}</Text>)}
    </View> : null}
    <View style={ui.menu}>
      <MenuRow title="Playing XIs and squads" onPress={() => setShowLineups(value => !value)} />
      <View style={ui.divider} />
      <ScorecardGalleryLink id={match.id} />
      {match.status === 'completed' ? <><View style={ui.divider} /><MenuRow title="Fan player of the match" onPress={() => setShowVote(value => !value)} /></> : null}
    </View>
    {showLineups ? <>
      <LoadState loading={(squad.loading && !squad.data) || (players.loading && !players.data)}
        error={squad.error || players.error} retry={() => void Promise.all([squad.refresh(), players.refresh()])}
        empty={squad.data && !squad.data.teams.some(team => team.players.length) ? 'No lineups have been published.' : undefined} />
      {players.data && squad.data?.teams.filter(team => team.players.length).map(team => <View key={team.team_id} style={ui.panel}>
        <Text style={ui.heading}>{clubs.find(club => club.id === team.team_id)?.name || 'Team ' + team.team_id}</Text>
        {team.players.slice().sort((a, b) => a.lineup_order - b.lineup_order).map(entry => {
          const player = playerMap.get(entry.player_id)
          const name = (player?.full_name || 'Player ' + entry.player_id) + (entry.is_captain ? ' (c)' : '') + (entry.is_wicketkeeper ? ' (wk)' : '')
          return player?.slug
            ? <SiteLink key={entry.id} path={'/players/' + player.slug} style={ui.link}>{name}</SiteLink>
            : <Text key={entry.id} style={ui.text}>{name}</Text>
        })}
      </View>)}
    </> : null}
    {showVote ? <FanVote key={'vote-' + identity} id={match.id} signedIn={identity !== null} /> : null}
    {match.stream_available ? <MatchBroadcast key={'broadcast-' + identity} id={match.id} signedIn={identity !== null} /> : null}
    <SiteLink path="/scorecard-corrections" style={ui.link}>Report a scorecard correction</SiteLink>
  </>
}

type Vote = { eligible: boolean; reason?: string | null; voter_player_id?: number; choices: { player_id: number; player_name: string; votes: number }[] }

function FanVote({ id, signedIn }: { id: number; signedIn: boolean }) {
  const [vote, setVote] = useState<Vote>()
  const [loadedAttempt, setLoadedAttempt] = useState(-1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const path = '/matches/' + id + '/fan-player-vote'
  const [attempt, setAttempt] = useState(0)
  const loading = loadedAttempt !== attempt
  useFocusEffect(useCallback(() => {
    const controller = new AbortController()
    void supporterPublicRequest<Vote>(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setVote(data)
    }).catch(() => {
      if (!controller.signal.aborted) setError('Could not load voting.')
    }).finally(() => { if (!controller.signal.aborted) setLoadedAttempt(attempt) })
    return () => controller.abort()
  }, [path, attempt]))

  async function submit(playerId: number) {
    if (!signedIn) { router.push('/account/supporter'); return }
    setBusy(true); setError('')
    try { setVote(await supporterPublicRequest<Vote>(path, { method: 'POST', body: JSON.stringify({ player_id: playerId }) })) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit your vote.') }
    finally { setBusy(false) }
  }

  return <View style={ui.panel}>
    <Text style={ui.heading}>Fan player of the match</Text>
    <LoadState loading={loading} error={error} retry={() => { setError(''); setAttempt(value => value + 1) }} />
    {!loading && vote && !vote.eligible ? <Text style={ui.muted}>{vote.reason || 'Voting is closed.'}</Text> : null}
    {vote?.choices.map(choice => <View key={choice.player_id} style={ui.row}>
      <View style={s.fill}><Text style={ui.rowTitle}>{choice.player_name}</Text><Text style={ui.muted}>{choice.votes} votes</Text></View>
      {vote.eligible ? <Action tone="secondary" label={vote.voter_player_id === choice.player_id ? 'Voted' : 'Vote'}
        disabled={busy || vote.voter_player_id === choice.player_id} onPress={() => void submit(choice.player_id)} /> : null}
    </View>)}
  </View>
}

function MatchBroadcast({ id, signedIn }: { id: number; signedIn: boolean }) {
  const [stream, setStream] = useState<{ stream_url: string; stream_label?: string }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function open() {
    if (!signedIn) { router.push('/account/supporter'); return }
    setBusy(true); setError('')
    try { setStream(await supporterPublicRequest('/matches/' + id + '/stream')) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Broadcast is unavailable.') }
    finally { setBusy(false) }
  }
  return <View style={ui.panel}>
    <Text style={ui.heading}>Watch match</Text>
    {signedIn && stream ? <NativeMedia source={stream.stream_url} label={stream.stream_label} /> :
      <Action label={signedIn ? 'Load broadcast' : 'Sign in to watch'} onPress={() => void open()} busy={busy} />}
    {error ? <Notice error>{error}</Notice> : null}
  </View>
}

const s = StyleSheet.create({
  wide: { maxWidth: 1080 },
  pinned: { backgroundColor: colors.background, gap: 8, paddingBottom: 5 },
  split: { flexDirection: 'row', alignItems: 'stretch', gap: 16 },
  summary: { width: '45%' },
  navigation: { gap: 6, justifyContent: 'flex-end' },
  fill: { flex: 1, gap: 4 },
  ball: { flexDirection: 'row', gap: 10 },
  overs: { color: colors.accent, fontVariant: ['tabular-nums'], minWidth: 37 },
})
