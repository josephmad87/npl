import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { colors } from '../theme'

/** Shared by the tab navigator so league identity stays visible on every tab. */
export function AppHeader({ detail = false, title }: { detail?: boolean; title?: string }) {
  const insets = useSafeAreaInsets()
  return <View style={[s.shell, { paddingTop: insets.top }]}>
    <View style={s.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="NPL Zimbabwe home" onPress={() => router.navigate('/')} style={({ pressed }) => [s.brand, pressed && s.pressed]}>
        <Image source={require('../../assets/npl-wordmark.png')} style={s.logo} />
        <View style={s.wordmark}><Text style={s.title}>NPL ZIMBABWE</Text><Text style={s.subtitle}>NATIONAL PREMIER LEAGUE</Text></View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Open My NPL" onPress={() => router.navigate('/account')} style={({ pressed }) => [s.account, pressed && s.pressed]}>
        <View style={s.personHead} /><View style={s.personBody} />
      </Pressable>
    </View>
    {detail ? <View style={s.detailRow}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={s.back}><Text style={s.backText}>‹ Back</Text></Pressable><Text numberOfLines={1} style={s.detailTitle}>{title || 'NPL Zimbabwe'}</Text></View> : null}
  </View>
}
const s = StyleSheet.create({
  detailRow: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, back: { minHeight: 44, justifyContent: 'center' }, backText: { color: colors.brand, fontSize: 14, fontWeight: '600' }, detailTitle: { color: colors.ink, fontSize: 14, fontWeight: '600', flex: 1 },
  shell: { backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  row: { minHeight: 76, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  logo: { width: 65, height: 43, resizeMode: 'contain' }, wordmark: { flex: 1, gap: 5 },
  title: { fontSize: 15, letterSpacing: 0.8, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 8, letterSpacing: 0.7, color: colors.muted },
  account: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  personHead: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: colors.ink, marginBottom: 2 },
  personBody: { width: 16, height: 10, borderWidth: 1.5, borderBottomWidth: 0, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderColor: colors.ink },
  pressed: { opacity: 0.65 },
})
