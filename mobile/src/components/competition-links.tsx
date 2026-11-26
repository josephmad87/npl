import { AppLink as Link } from './app-link'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme'

const sections = [
  { title: 'Men’s competitions', path: '/mens/seasons' },
  { title: 'Women’s competitions', path: '/women/seasons' },
  { title: 'Youth competitions', path: '/youth/seasons' },
]

export function CompetitionLinks({ highlighted = false }: { highlighted?: boolean }) {
  return <View style={[styles.section, highlighted && styles.highlighted]}>
    <Text accessibilityRole="header" style={styles.heading}>Standings & stats</Text>
    <Text style={styles.description}>{highlighted ? 'Full tables and player leaders' : 'Choose a competition and season to see the full points table, player stats, fixtures and results.'}</Text>
    {highlighted ? <View style={styles.chips}>
      {sections.map(({ title, path }, index) => <Link key={path} href={{ pathname: '/page', params: { path, title } }} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel={title} style={StyleSheet.flatten([styles.chip, index === 0 && styles.primaryChip])}>
          <Text style={[styles.chipText, index === 0 && styles.primaryChipText]}>{['Men', 'Women', 'Youth'][index]}</Text>
        </Pressable>
      </Link>)}
    </View> : <View style={styles.list}>
      {sections.map(({ title, path }) => <Link
        key={path}
        href={{ pathname: '/page', params: { path, title } }}
        style={styles.link}
      >{title} ›</Link>)}
    </View>}
  </View>
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.surface, paddingHorizontal: 13, minHeight: 44, justifyContent: 'center', borderRadius: 22 },
  primaryChip: { backgroundColor: colors.maroon },
  chipText: { color: colors.ink, fontWeight: '800' },
  primaryChipText: { color: colors.surface },
  section: { gap: 10 },
  highlighted: { backgroundColor: colors.brandTint, borderRadius: 16, padding: 16 },
  heading: { color: colors.ink, fontSize: 22, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  list: { borderRadius: 12, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', backgroundColor: colors.surface },
  link: { color: colors.brand, fontSize: 16, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 15 },
})
