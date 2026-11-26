import { Redirect, useLocalSearchParams } from 'expo-router'
import { nativeHref } from '../../components/app-link'

export default function MatchLink() {
  const { id, section, '#': anchor } = useLocalSearchParams<{ id: string; section?: string; '#'?: string }>()
  if (!/^\d+$/.test(id)) return <Redirect href="/home" />
  return <Redirect href={nativeHref('/matches/' + id, 'home', (section || anchor) === 'scorecard' ? 'scorecard' : undefined)} />
}
