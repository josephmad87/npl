import type { ComponentProps } from 'react'
import { Link, useSegments, type Href } from 'expo-router'
import { nplPath, resolveNativePath } from '../lib/native-path'

const tabs = ['home', 'live', 'results', 'news', 'account']

export function nativeHref(input: string, tab = 'home', section?: string): Href {
  const path = nplPath(input) || '/unavailable'
  const target = resolveNativePath(path, section)
  switch (target.page) {
    case 'home': return '/home'
    case 'live': return '/live'
    case 'news': return target.query ? { pathname: '/news', params: { q: target.query } } : '/news'
    case 'teams': return { pathname: '/account/teams', params: { ...(target.division ? { division: target.division } : {}), ...(tab === 'home' ? { from: 'Home' } : {}) } }
    case 'team': return { pathname: '/account/team/[slug]', params: { slug: target.slug } }
    case 'account': return { pathname: '/account/supporter', params: { ...(target.deletion ? { deletion: '1' } : {}) } }
    case 'matches': return { pathname: '/results', params: { mode: target.mode, ...(target.division ? { division: target.division } : {}) } }
    default: return { pathname: '/' + tab + '/page', params: { path, ...(section ? { section } : {}) } } as Href
  }
}

export function AppLink({ href, ...props }: ComponentProps<typeof Link>) {
  const segments = useSegments() as string[]
  const tab = tabs.includes(segments[1]) ? segments[1] : 'home'
  if (typeof href === 'object' && href.pathname === '/page') {
    const path = href.params?.path
    const section = href.params?.section
    return <Link {...props} href={nativeHref(typeof path === 'string' ? path : '/', tab, typeof section === 'string' ? section : undefined)} />
  }
  return <Link {...props} href={href} />
}

export function SiteLink({ path, section, ...props }: Omit<ComponentProps<typeof Link>, 'href'> & { path: string; section?: string }) {
  const segments = useSegments() as string[]
  return <Link {...props} href={nativeHref(path, tabs.includes(segments[1]) ? segments[1] : 'home', section)} />
}
