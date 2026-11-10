import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { teamScore } from '../lib/match-score'
import { colors } from '../theme'
import type { Fixture, Team } from '../lib/feed'

export function MatchCard({ match, teams }: { match: Fixture; teams: Team[] }) {
  const name = (id: number) => teams.find(team => team.id === id)?.name || `Team ${id}`
  const date = match.match_date ? new Date(`${match.match_date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Date TBC'
  const finished = match.status === 'completed'
  return <Link href={{ pathname: '/page', params: { path: `/matches/${match.id}`, title: 'Match centre' } }} asChild>
    <Pressable accessibilityRole="link" accessibilityLabel={`${name(match.home_team_id)} versus ${name(match.away_team_id)}. ${match.result?.margin_text || match.status || 'Scheduled'}. Open scorecard.`} style={({ pressed }) => [s.card, pressed && { opacity: 0.75 }]}>
      <View style={s.context}><Text style={s.stage}>{match.title || 'NPL CRICKET'}</Text><Text style={s.date}>{date}</Text></View>
      {[match.home_team_id, match.away_team_id].map(id => {
        const team = teams.find(item => item.id === id)
        const score = teamScore(match.result?.score_summary, name(id))
        const won = match.result?.winning_team_id === id
        return <View key={id} style={s.row}>
          {team?.logo_url ? <Image source={{ uri: team.logo_url }} style={s.logo} /> : <View style={s.initials}><Text style={s.initialText}>{name(id).split(' ').slice(0, 2).map(word => word[0]).join('')}</Text></View>}
          <Text style={[s.team, won && s.winner]}>{name(id)}</Text><View style={s.figures}><Text style={[s.score, won && s.winner]}>{score.runs}</Text>{score.overs ? <Text style={s.overs}>{score.overs} overs</Text> : null}</View>
        </View>
      })}
      <View style={s.footer}><Text style={s.outcome}>{match.result?.winning_team_id ? `${name(match.result.winning_team_id)} ${match.result.margin_text || 'won'}` : match.result?.margin_text || (finished ? 'Match completed' : match.status === 'live' ? 'Live match · open for latest score' : match.venue || 'Venue TBC')}</Text><Text style={s.arrow}>›</Text></View>
      <Text style={s.action}>{finished ? 'Full scorecard' : 'Match centre'} →</Text>
    </Pressable>
  </Link>
}
const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', padding: 18, gap: 16 },
  context: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, stage: { color: colors.brand, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', flex: 1 }, date: { fontSize: 12, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, logo: { width: 36, height: 36, resizeMode: 'contain' }, initials: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f6f3f3', alignItems: 'center', justifyContent: 'center' }, initialText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  team: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.ink }, figures: { alignItems: 'flex-end', maxWidth: '40%' }, overs: { fontSize: 12, color: colors.muted, marginTop: 2 }, score: { fontSize: 24, fontWeight: '600', color: colors.ink, textAlign: 'right', fontVariant: ['tabular-nums'] }, winner: { fontWeight: '800' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 }, outcome: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.ink, fontWeight: '600' }, arrow: { color: colors.brand, fontSize: 22 }, action: { color: colors.brand, fontWeight: '700', fontSize: 14 },
})
