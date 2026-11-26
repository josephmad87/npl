import { useLocalSearchParams } from 'expo-router'
import { LeagueScreen } from './league-screen'

export default function TournamentScreen() {
  const { slug = '', mode } = useLocalSearchParams<{ slug?: string; mode?: string }>()
  return <LeagueScreen key={slug + mode} slug={slug} initial={mode === 'fixtures' ? 'fixtures' : 'results'} />
}
