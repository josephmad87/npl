import { Redirect, useLocalSearchParams } from 'expo-router'
import { SiteScreen } from '../components/site-screen'
export default function Page() {
  const { path, web } = useLocalSearchParams<{ path?: string; title?: string; web?: string }>()
  const route = typeof path === 'string' ? path : '/'
  const division = ({ '/mens/teams': 'mens', '/women/teams': 'women', '/youth/teams': 'youth' } as Record<string, string>)[route]
  if (division) return <Redirect href={{ pathname: '/account/teams', params: { division } }} />
  const team = route.match(/^\/teams\/([a-z0-9-]+)$/)
  if (team && web !== '1') return <Redirect href={{ pathname: '/account/team/[slug]', params: { slug: team[1] } }} />
  return <SiteScreen key={route} path={route} />
}
