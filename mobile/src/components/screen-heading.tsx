import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme'
export function ScreenHeading({ title, subtitle, label }: { title: string; subtitle: string; label?: string }) {
  return <View style={s.header}>{label ? <Text style={s.label}>{label}</Text> : null}<Text accessibilityRole="header" style={s.title}>{title}</Text><Text style={s.subtitle}>{subtitle}</Text></View>
}
const s = StyleSheet.create({ header: { gap: 8, paddingBottom: 8 }, label: { fontSize: 11, letterSpacing: 1.2, fontWeight: '700', color: colors.brand }, title: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: colors.ink }, subtitle: { fontSize: 14, lineHeight: 21, color: colors.muted } })
