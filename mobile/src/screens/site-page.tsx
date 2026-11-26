import { Redirect, useLocalSearchParams } from 'expo-router'
import { Text } from 'react-native'
import { nativeHref, SiteLink } from '../components/app-link'
import { Screen, ui } from '../components/native-ui'
import { resolveNativePath } from '../lib/native-path'
import { CompareTeamsScreen, PlayerProfileScreen, SearchScreen } from './discovery-screens'
import { GalleryScreen } from './gallery-screen'
import { ContactScreen, InformationScreen } from './information-screens'
import { CompetitionsScreen, LeagueScreen } from './league-screen'
import { MatchCentreScreen } from './match-centre-screen'
import { MerchandiseScreen } from './merchandise-screen'
import { ArticleScreen } from './news-screen'

export default function Page() {
  const { path, section } = useLocalSearchParams<{ path?: string; section?: string }>()
  const route = typeof path === 'string' ? path : '/'
  const target = resolveNativePath(route, section)
  const key = route + ':' + (section || '')
  switch (target.page) {
    case 'home': case 'live': case 'news': case 'teams': case 'team': case 'account': case 'matches':
      return <Redirect href={nativeHref(route)} />
    case 'match': return <MatchCentreScreen key={key} id={target.id} initial={target.section} />
    case 'story': return <ArticleScreen key={key} slug={target.slug} />
    case 'player': return <PlayerProfileScreen key={key} slug={target.slug} />
    case 'competition': return <CompetitionsScreen key={key} initial={target.division} />
    case 'league': return <LeagueScreen key={key} slug={target.slug} season={target.season} initial={target.section} />
    case 'gallery': return <GalleryScreen key={key} initial={target.media} item={target.item} matchId={target.matchId} />
    case 'search': return <SearchScreen key={key} initialQuery={target.query} initialFilter={target.filter} />
    case 'compare': return <CompareTeamsScreen />
    case 'contact': return <ContactScreen />
    case 'legal': return <InformationScreen key={key} slug={target.slug} title={target.title} />
    case 'merchandise': return <MerchandiseScreen key={key} product={target.product} team={target.team} teamId={target.teamId} order={target.order} token={target.token} />
    default:
      return <Screen back="Back" title="Content unavailable">
        <Text style={ui.muted}>This NPL page could not be found.</Text>
        <SiteLink path="/search" style={ui.link}>Search app ›</SiteLink>
      </Screen>
  }
}
