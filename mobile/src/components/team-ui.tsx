import { useState } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Link, router } from 'expo-router'
import { colors } from '../theme'
import { mediaUrl } from '../lib/team-data'
export function TeamEmblem({ name, uri, size = 54 }: { name: string; uri?: string | null; size?: number }) {
  const [failed, setFailed] = useState<string>()
  const src = mediaUrl(uri)
  return <View style={[s.emblem, { width: size, height: size }]}>{src && failed !== src ? <Image accessibilityLabel={`${name} emblem`} source={{ uri: src }} onError={() => setFailed(src)} style={s.image} resizeMode="contain" /> : <Text style={s.initials}>{name.split(' ').slice(0, 2).map(word => word[0]).join('')}</Text>}</View>
}
export function BackLink({ label, fallback = '/account' }: { label: string; fallback?: '/account' | '/account/teams' }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Back to ${label}`} onPress={() => router.canGoBack() ? router.back() : router.replace(fallback)} style={s.back}><Text style={s.backText}>‹  {label}</Text></Pressable>
}
export function ResourceState({ loading, error, empty, retry }: { loading?: boolean; error?: string; empty?: string; retry: () => void }) {
  return <View style={s.state}>{loading ? <ActivityIndicator color={colors.brand} accessibilityLabel="Loading NPL information" /> : null}{error ? <><Text style={s.message} accessibilityRole="alert">{error}</Text><Pressable accessibilityRole="button" onPress={retry} style={s.retry}><Text style={s.retryText}>Try again</Text></Pressable></> : !loading && empty ? <Text style={s.message}>{empty}</Text> : null}</View>
}
export function ProfileFollow({ slug }: { slug: string }) {
  return <Link href={{ pathname: '/page', params: { path: `/teams/${slug}`, title: 'Follow team', web: '1' } }} style={s.follow}>＋ Follow team</Link>
}
const s = StyleSheet.create({ emblem: { flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: 8, overflow: 'hidden' }, image: { width: '100%', height: '100%' }, initials: { color: colors.ink, fontSize: 16, fontWeight: '700' }, back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }, backText: { color: colors.brand, fontSize: 14, fontWeight: '600' }, state: { gap: 10, paddingVertical: 8 }, message: { color: colors.muted, fontSize: 14, lineHeight: 21 }, retry: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }, retryText: { color: colors.brand, fontWeight: '700' }, follow: { color: colors.brand, fontWeight: '700', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.brand, borderRadius: 8, alignSelf: 'flex-start', overflow: 'hidden' } })
