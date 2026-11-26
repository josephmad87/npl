import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { AppLink as Link } from '../../../components/app-link'
import { CompetitionLinks } from '../../../components/competition-links'
import { ScreenHeading } from '../../../components/screen-heading'
import { FollowedMatches } from '../../../components/followed-matches'
import { useSupporterAccount } from '../../../lib/supporter-account'
import { colors } from '../../../theme'
export default function Account() {
  const session = useSupporterAccount()
  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <ScreenHeading label="YOUR LEAGUE" title="My NPL" subtitle="Closer to the game. Closer to your club." />
    {session ? <FollowedMatches /> : null}
    <View style={s.menu}>
      <Link href='/account/supporter' asChild>
        <Pressable accessibilityRole="link" style={s.row}>
          <View style={s.rowText}>
            <Text style={s.name}>{session ? 'Manage supporter account' : 'Open supporter account'}</Text>
            <Text style={s.subtitle}>Follows, preferences and orders</Text>
          </View>
          <Text style={s.arrow}>›</Text>
        </Pressable>
      </Link>
      {session ? <Link href={{ pathname: '/account/supporter', params: { preferences: '1' } }} asChild>
        <Pressable accessibilityRole="link" style={s.row}>
          <View style={s.rowText}><Text style={s.name}>Match alerts</Text><Text style={s.subtitle}>Reminders and scores for clubs you follow</Text></View>
          <Text style={s.arrow} accessible={false}>›</Text>
        </Pressable>
      </Link> : null}
    </View>
    <View style={s.section}><Text accessibilityRole="header" style={s.heading}>Explore NPL</Text><View style={s.menu}>
      <Link href="/account/teams" asChild><Pressable accessibilityRole="link" style={s.row}><View style={s.rowText}><Text style={s.name}>Teams</Text><Text style={s.subtitle}>Discover clubs and squads</Text></View><Text style={s.arrow}>›</Text></Pressable></Link>
      {[['Competitions', 'Seasons, fixtures and standings', '/competition'], ['Find players and matches', 'Search players, teams and scorecards', '/search'], ['Compare teams', 'Head-to-head records', '/compare-teams'], ['Photos & videos', 'Inside the league', '/gallery']].map(([title, description, path]) => <Link key={path} href={{ pathname: '/page', params: { path, title } }} asChild><Pressable accessibilityRole="link" style={s.row}><View style={s.rowText}><Text style={s.name}>{title}</Text><Text style={s.subtitle}>{description}</Text></View><Text style={s.arrow}>›</Text></Pressable></Link>)}
    </View></View>
    <CompetitionLinks />
    <View style={s.section}><Text accessibilityRole="header" style={s.heading}>Help & information</Text>{[['Contact NPL', '/contact-us'], ['About the league', '/about-us'], ['Privacy policy', '/privacy']].map(([title, path]) => <Link key={path} href={{ pathname: '/page', params: { path, title } }} style={s.help}>{title}  ›</Link>)}<Link href={{ pathname: '/account/supporter', params: { deletion: '1' } }} style={s.help}>Delete account  ›</Link></View>
  </ScrollView>
}
const s = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, paddingBottom: 40, gap: 28 }, section: { gap: 14 }, heading: { fontSize: 20, fontWeight: '700', color: colors.ink }, menu: { borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: 'hidden' }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, minHeight: 72 }, rowText: { flex: 1, gap: 5 }, name: { color: colors.ink, fontSize: 15, fontWeight: '700' }, subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19 }, arrow: { color: colors.muted, fontSize: 24 }, help: { color: colors.ink, fontSize: 15, paddingVertical: 14 } })
