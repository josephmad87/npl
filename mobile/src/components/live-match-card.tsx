import { useCallback, useRef, useState } from 'react'
import { AppState, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { API, type Fixture, type Team } from '../lib/feed'
import { MatchCard } from './match-card'
import { colors } from '../theme'
type LiveState = { current_innings: number | null; summaries: { innings: number; batting_team_id: number; runs: number; wickets: number; overs_label: string; last_six: string[] }[] }
export function LiveMatchCard({ match, teams }: { match: Fixture; teams: Team[] }) {
  const [state, setState] = useState<LiveState | null>(null)
  const [checked, setChecked] = useState(0)
  const [delayed, setDelayed] = useState(false)
  const pending = useRef<AbortController | null>(null)
  useFocusEffect(useCallback(() => {
    let active = true
    const update = async () => {
      if (AppState.currentState !== 'active' || pending.current) return
      const request = new AbortController(); pending.current = request
      const deadline = setTimeout(() => request.abort(), 12_000)
      try {
        const response = await fetch(`${API}/public/matches/${match.id}/live`, { signal: request.signal })
        if (!response.ok) throw Error('Score unavailable')
        const next = await response.json() as LiveState
        if (!Array.isArray(next.summaries)) throw Error('Invalid score')
        if (active) { setState(next); setChecked(Date.now()); setDelayed(false) }
      } catch { if (active) setDelayed(true) }
      finally { clearTimeout(deadline); if (pending.current === request) pending.current = null }
    }
    void update()
    const timer = setInterval(() => void update(), 10_000)
    return () => { active = false; clearInterval(timer); pending.current?.abort(); pending.current = null }
  }, [match.id]))
  const scoreSummary = state?.summaries.map(innings => `${teams.find(team => team.id === innings.batting_team_id)?.name || `Team ${innings.batting_team_id}`} ${innings.runs}/${innings.wickets} (${innings.overs_label})`).join(' · ')
  const current = state?.summaries.find(innings => innings.innings === state.current_innings) || state?.summaries.at(-1)
  const balls = current?.last_six || []
  return <View style={s.wrap}><View style={s.status}><Text style={s.live}>● LIVE</Text><Text style={s.updated}>{delayed ? 'Updates delayed · scores may be stale' : checked ? `Checked ${new Date(checked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Connecting to scorer…'}</Text></View><MatchCard teams={teams} match={{ ...match, result: { ...match.result, score_summary: scoreSummary || match.result?.score_summary } }} />{balls.length ? <View style={s.balls}><Text style={s.updated}>Recent balls</Text>{balls.map((ball, index) => <View key={index} style={s.ball}><Text style={s.ballText}>{ball}</Text></View>)}</View> : null}</View>
}
const s = StyleSheet.create({ wrap: { gap: 10 }, status: { flexDirection: 'row', alignItems: 'center', gap: 12 }, live: { color: colors.brand, fontSize: 12, fontWeight: '800' }, updated: { color: colors.muted, fontSize: 11, flexShrink: 1 }, balls: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }, ball: { backgroundColor: '#fee9df', borderRadius: 14, minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }, ballText: { fontSize: 11, color: colors.ink, fontWeight: '700' } })
