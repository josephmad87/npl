import { Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { colors } from '../theme'
import { SiteLink } from './app-link'

/** Shared by the tab navigator so league identity stays visible on every tab. */
export function AppHeader() {
  const insets = useSafeAreaInsets()
  return <View style={[s.shell, { paddingTop: insets.top }]}>
    <View style={s.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="NPL Zimbabwe home" onPress={() => router.navigate('/home')} style={({ pressed }) => [s.brand, pressed && s.pressed]}>
        <Image source={require('../../assets/npl-wordmark.png')} style={s.logo} />
        <View style={s.wordmark}><Text style={s.title}>NPL ZIMBABWE</Text><Text style={s.subtitle}>NATIONAL PREMIER LEAGUE</Text></View>
      </Pressable>
      <SiteLink path="/search" asChild push>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search app" style={s.iconButton}>
          <View style={s.lens}><View style={s.handle} /></View>
        </TouchableOpacity>
      </SiteLink>
      <Pressable accessibilityRole="button" accessibilityLabel="Open My NPL" onPress={() => router.navigate('/account')} style={({ pressed }) => [s.iconButton, pressed && s.pressed]}>
        <View style={s.personHead} /><View style={s.personBody} />
      </Pressable>
    </View>
  </View>
}
const s = StyleSheet.create({
  shell: { backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  row: { minHeight: 66, paddingHorizontal: 18, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  logo: { width: 65, height: 43, resizeMode: 'contain' }, wordmark: { flex: 1, gap: 5 },
  title: { fontSize: 15, letterSpacing: 0.8, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 8, letterSpacing: 0.7, color: colors.muted },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  lens: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.6, borderColor: colors.ink, marginRight: 3, marginBottom: 3 },
  handle: { position: 'absolute', bottom: -3, right: -5, width: 7, height: 1.6, backgroundColor: colors.ink, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  personHead: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: colors.ink, marginBottom: 2 },
  personBody: { width: 16, height: 10, borderWidth: 1.5, borderBottomWidth: 0, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderColor: colors.ink },
  pressed: { opacity: 0.65 },
})
