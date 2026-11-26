import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SiteLink } from './app-link'
import { TeamEmblem } from './team-ui'
import { chaseEquation, teamScore } from '../lib/match-score'
import { colors } from '../theme'
import type { Fixture, Team } from '../lib/feed'
import type { LiveMatch } from '../lib/match-data'

export function matchName(match: Fixture, teams: Team[], id: number) {
  return (id === match.home_team_id ? match.home_team_placeholder : id === match.away_team_id ? match.away_team_placeholder : null)
    || teams.find(team => team.id === id)?.name
    || 'Team ' + id
}

export function shortTeamName(name: string) {
  return name.replace(/\s+Cricket Club$/i, '')
}

export function formatDate(value?: string | null, year = false) {
  if (!value) return ''
  const date = new Date(value.length === 10 ? value + 'T12:00:00Z' : value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) })
}

const statusLabels: Record<string, string> = { live: 'Live', scheduled: 'Upcoming', completed: 'Final', postponed: 'Postponed', cancelled: 'Cancelled', abandoned: 'Abandoned' }

export function MatchCard({ match, teams, featured = false, compact = false, detail = false, live, updatedAt, delayed }: {
  match: Fixture; teams: Team[]; featured?: boolean; compact?: boolean; detail?: boolean
  live?: LiveMatch; updatedAt?: number; delayed?: boolean
}) {
  const teamsForMatch = [match.home_team_id, match.away_team_id]
  const league = match.season?.league?.name
  const title = match.title && league && !match.title.includes(league) ? league + ' · ' + match.title : league || match.title || 'NPL Cricket'
  const winner = match.result?.winning_team_id
  const matchStatus = live?.status || match.status
  const finished = matchStatus === 'completed'
  const playing = matchStatus === 'live'
  const statusLabel = statusLabels[matchStatus || '']
  const date = formatDate(match.match_date, detail)
  const time = matchStatus === 'scheduled' && match.start_time ? new Date(match.start_time) : null
  const start = time && Number.isFinite(time.getTime())
    ? time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }) + ' CAT'
    : undefined
  const innings = playing ? live?.summaries ?? [] : []
  const current = innings.find(value => value.innings === live?.current_innings) ?? innings.at(-1)
  const first = innings.find(value => value.innings === 1)
  const chase = current?.innings === 2 && current.wickets < 10 && current.legal_balls !== undefined && (first || live?.revised_target_runs != null)
    ? chaseEquation(live?.revised_target_runs ?? ((first?.runs ?? 0) + 1), current.runs, current.legal_balls, live?.match_overs ?? match.match_overs)
    : undefined
  const outcome = winner && finished
    ? shortTeamName(matchName(match, teams, winner)) + ' ' + (match.result?.margin_text?.replace(/^Won\b/, 'won') || 'won')
    : finished ? match.result?.margin_text || 'Match completed'
      : playing ? chase || (current ? 'Innings ' + current.innings : 'Waiting for the first ball')
        : [start, match.venue].filter(Boolean).join(' · ') || 'Venue to be confirmed'

  const content = <View style={[s.card, compact && s.compact, featured && s.featured]}>
    <View style={s.context}>
      <View style={s.stageGroup}>
        <Text style={[s.stage, featured && s.featuredAccent]}>{title}</Text>
        {date ? <Text style={[s.date, featured && s.featuredAccent]}>{date}</Text> : null}
      </View>
      {statusLabel ? <View style={[s.statusBadge, playing && s.liveBadge, featured && s.featuredBadge]}>
        {playing ? <View style={[s.liveDot, featured && s.featuredDot]} /> : null}
        <Text style={[s.statusLabel, featured && s.featuredLabel]}>{statusLabel}</Text>
      </View> : null}
    </View>
    {teamsForMatch.map((id, side) => {
      const name = matchName(match, teams, id)
      const club = teams.find(team => team.id === id)
      const scored = innings.find(value => value.batting_team_id === id)
      const score = scored ? { runs: scored.runs + '/' + scored.wickets, overs: scored.overs_label } : teamScore(match.result?.score_summary, name)
      return <View key={side} style={s.teamRow}>
        <TeamEmblem name={name} uri={club?.logo_url} size={compact ? 30 : 36} />
        <Text style={[s.team, featured && s.featuredText]}>{shortTeamName(name)}</Text>
        {finished || playing ? <View style={s.figures}>
          <Text style={[s.score, compact && s.compactScore, featured && s.featuredText]}>{score.runs}</Text>
          {score.overs ? <Text style={[s.overs, featured && s.featuredAccent]}>{score.overs.replace(/\s+overs?$/i, '')} overs</Text> : null}
        </View> : null}
      </View>
    })}
    <View style={[s.footer, featured && s.featuredFooter]}><Text style={[s.outcome, featured && s.featuredText]}>{outcome}</Text>
      {compact && !detail ? <Text style={s.arrow} accessible={false}>›</Text> : null}</View>
    {playing && !detail ? <>
      {current?.last_six?.length ? <View style={s.balls}>
        <Text style={[s.date, featured && s.featuredAccent]}>Last {current.last_six.length}</Text>
        {current.last_six.map((ball, index) => <Text key={index}
          style={[s.ball, ball === 'W' && s.wicket]}>{ball}</Text>)}
      </View> : null}
      {delayed || updatedAt ? <Text style={[s.date, featured && s.featuredAccent]}>
        {delayed ? 'Updates delayed' : 'Updated ' + new Date(updatedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text> : null}
    </> : null}
    {!detail && !compact ? <Text style={[s.action, featured && s.featuredAction]}>{finished ? 'Open scorecard' : 'Open match centre'} →</Text> : null}
  </View>
  if (detail) return content
  return <SiteLink path={'/matches/' + match.id} section={finished ? 'scorecard' : undefined} asChild push>
    <TouchableOpacity accessibilityRole="link" accessibilityLabel={teamsForMatch.map(id => matchName(match, teams, id)).join(' versus ') + '. ' + [statusLabel, date, outcome].filter(Boolean).join('. ') + (finished ? '. Open scorecard.' : '. Open match centre.')}>
      {content}
    </TouchableOpacity>
  </SiteLink>
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 9 },
  compact: { padding: 12, gap: 7 },
  featured: { backgroundColor: colors.maroon, borderColor: colors.maroon, gap: 10 },
  featuredText: { color: colors.surface },
  featuredAccent: { color: '#f7d9c4' },
  featuredAction: { backgroundColor: colors.gold, color: colors.ink, borderRadius: 8, overflow: 'hidden' },
  context: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  stageGroup: { flex: 1, gap: 2 },
  stage: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  date: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  statusBadge: { flexDirection: 'row', flexShrink: 1, alignItems: 'center', gap: 5, backgroundColor: colors.brandTint, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 },
  liveBadge: { backgroundColor: '#fce5e1' },
  featuredBadge: { backgroundColor: colors.goldLight },
  statusLabel: { fontSize: 11, fontWeight: '800', color: colors.maroon, flexShrink: 1 },
  featuredLabel: { color: colors.ink },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  featuredDot: { backgroundColor: colors.maroon },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  team: { flex: 1, fontSize: 15, color: colors.ink, fontWeight: '700' },
  figures: { alignItems: 'flex-end', flexShrink: 1, maxWidth: '45%' },
  overs: { fontSize: 11, color: colors.muted, fontVariant: ['tabular-nums'] },
  score: { fontSize: 23, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  compactScore: { fontSize: 19 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 9 },
  featuredFooter: { borderTopColor: '#a07078' },
  outcome: { flex: 1, fontSize: 14, color: colors.maroon, fontWeight: '700' },
  arrow: { color: colors.accent, fontSize: 19 },
  action: { minHeight: 44, color: colors.accent, fontWeight: '800', fontSize: 14, paddingHorizontal: 10, paddingVertical: 12 },
  balls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  ball: { minWidth: 25, textAlign: 'center', paddingVertical: 4, paddingHorizontal: 4, backgroundColor: colors.brandTint, color: colors.ink, borderRadius: 6, overflow: 'hidden', fontWeight: '700', fontSize: 11 },
  wicket: { backgroundColor: '#fce5e1', color: colors.danger },
})
