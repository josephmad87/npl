import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native'
import { colors } from '../theme'
import { BackLink, ResourceState } from './team-ui'

export const ui = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 18, paddingBottom: 28, gap: 14, width: '100%', maxWidth: 760, alignSelf: 'center' },
  title: { color: colors.ink, fontSize: 31, fontWeight: '800', letterSpacing: -0.8 },
  heading: { color: colors.ink, fontSize: 19, fontWeight: '700' },
  text: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  panel: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  soft: { backgroundColor: colors.brandTint, borderColor: colors.brandTint },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  link: { color: colors.accent, fontSize: 14, fontWeight: '700', paddingVertical: 13, minHeight: 44 },
  number: { fontVariant: ['tabular-nums'] },
  menu: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, overflow: 'hidden' },
})

export function Screen({ children, back, title, refreshing, onRefresh, pinned, contentStyle }: {
  children: ReactNode; back?: string; title?: string; refreshing?: boolean; onRefresh?: () => void
  pinned?: ReactNode; contentStyle?: StyleProp<ViewStyle>
}) {
  const pinnedIndex = Number(Boolean(back)) + Number(Boolean(title))
  return <ScrollView
    style={ui.page}
    contentContainerStyle={[ui.content, !back && styles.top, contentStyle]}
    stickyHeaderIndices={pinned ? [pinnedIndex] : undefined}
    keyboardShouldPersistTaps="handled"
    automaticallyAdjustKeyboardInsets
    contentInsetAdjustmentBehavior="automatic"
    refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.maroon} /> : undefined}
  >
    {back ? <BackLink label={back} fallback="/home" /> : null}
    {title ? <Text accessibilityRole="header" style={ui.title}>{title}</Text> : null}
    {pinned}
    {children}
  </ScrollView>
}

export function Action({ label, onPress, busy, disabled, tone = 'primary' }: {
  label: string; onPress: () => void; busy?: boolean; disabled?: boolean; tone?: 'primary' | 'secondary' | 'danger'
}) {
  const primary = tone === 'primary'
  const color = primary ? colors.surface : tone === 'danger' ? colors.danger : colors.accent
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
    disabled={disabled || busy}
    onPress={onPress}
    style={({ pressed }) => [styles.action, primary && styles.primary, (pressed || disabled) && styles.dim]}
  >
    {busy ? <ActivityIndicator color={color} /> : null}
    <Text style={[styles.actionText, { color }]}>{label}</Text>
  </Pressable>
}

export function Segments<T extends string>({ value, options, onChange }: {
  value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void
}) {
  return <View accessibilityRole="tablist" style={styles.segments}>
    {options.map(option => {
      const selected = value === option.value
      return <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        key={option.value}
        onPress={() => onChange(option.value)}
        style={[styles.segment, selected && styles.active]}
      >
        <Text style={[styles.segmentLabel, selected && styles.activeLabel]}>{option.label}</Text>
      </Pressable>
    })}
  </View>
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      placeholderTextColor={colors.muted}
      selectionColor={colors.accent}
      {...props}
      style={[styles.input, props.multiline && styles.multiline, props.style]}
    />
  </View>
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <View style={[styles.notice, error && styles.error]}>
    <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[ui.muted, { color: error ? colors.danger : colors.maroon }]}>{children}</Text>
  </View>
}

export function LoadState({ loading, error, empty, retry }: {
  loading?: boolean; error?: string | null; empty?: string; retry: () => void
}) {
  return loading || error || empty
    ? <ResourceState loading={loading} error={error || undefined} empty={empty} retry={retry} />
    : null
}

export function MenuRow({ title, detail, onPress }: { title: string; detail?: string; onPress: () => void }) {
  return <Pressable style={styles.menuRow} accessibilityRole="button" onPress={onPress}>
    <View style={styles.fill}><Text style={ui.rowTitle}>{title}</Text>{detail ? <Text style={ui.muted}>{detail}</Text> : null}</View>
    <Text accessible={false} style={styles.chevron}>›</Text>
  </Pressable>
}

const styles = StyleSheet.create({
  top: { paddingTop: 18 },
  action: { minHeight: 48, borderRadius: 10, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primary: { backgroundColor: colors.maroon, borderColor: colors.maroon },
  dim: { opacity: 0.65 },
  actionText: { fontSize: 15, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  segments: { flexDirection: 'row', backgroundColor: '#ebe2de', borderRadius: 11, padding: 3, gap: 2 },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingHorizontal: 3, paddingVertical: 4 },
  active: { backgroundColor: colors.surface },
  segmentLabel: { fontSize: 13, color: colors.muted, textAlign: 'center', fontWeight: '600' },
  activeLabel: { color: colors.maroon, fontWeight: '700' },
  field: { gap: 5 },
  label: { fontSize: 13, color: colors.ink, fontWeight: '700' },
  input: { minHeight: 47, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 9, fontSize: 16, color: colors.ink },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  notice: { backgroundColor: colors.brandTint, borderRadius: 10, padding: 12 },
  error: { backgroundColor: '#fdede8' },
  menuRow: { paddingHorizontal: 13, paddingVertical: 12, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8 },
  fill: { flex: 1, gap: 3 },
  chevron: { color: colors.accent, fontSize: 23 },
})
