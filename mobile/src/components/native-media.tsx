import { Image } from 'expo-image'
import { useEvent } from 'expo'
import { useFocusEffect } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useCallback, useState } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import { Action, Notice, ui } from './native-ui'
import { mediaUrl } from '../lib/team-data'
import { colors } from '../theme'

export function MediaImage({ source, label, fit = 'cover', aspect = 16 / 9 }: {
  source?: string | null; label?: string; fit?: 'cover' | 'contain'; aspect?: number
}) {
  const uri = mediaUrl(source)
  const [failed, setFailed] = useState<string>()
  if (!uri || failed === uri) return null
  return <Image
    source={{ uri }} contentFit={fit} cachePolicy="memory-disk"
    accessible={Boolean(label)} accessibilityLabel={label}
    style={[styles.image, { aspectRatio: aspect }]} onError={() => setFailed(uri)}
  />
}

export function youtubeVideoId(value: string) {
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, '')
    const id = host === 'youtu.be' ? url.pathname.slice(1)
      : ['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)
        ? url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1]
        : null
    return id && /^[\w-]{11}$/.test(id) ? id : undefined
  } catch { return undefined }
}

export function NativeMedia({ source, label, poster }: { source: string; label?: string; poster?: string | null }) {
  const uri = mediaUrl(source)
  const youtube = uri ? youtubeVideoId(uri) : undefined
  const [error, setError] = useState(false)
  if (!uri) return <Notice>Video is unavailable.</Notice>
  if (youtube) return <View style={styles.media}>
    <MediaImage source={poster || 'https://i.ytimg.com/vi/' + youtube + '/hqdefault.jpg'} label={label} />
    <Action tone="secondary" label="Open in YouTube" onPress={() => {
      const appLink = process.env.EXPO_OS === 'android' ? 'vnd.youtube:' + youtube : 'youtube://watch?v=' + youtube
      void Linking.openURL(appLink).catch(() => setError(true))
    }} />
    {error ? <Notice>YouTube is needed to play this video.</Notice> : null}
  </View>
  const url = new URL(uri)
  return url.protocol === 'https:' && /\.(mp4|m4v|mov|m3u8|webm)$/i.test(url.pathname)
    ? <ClipPlayer uri={uri} label={label} />
    : <View style={styles.media}>
      <MediaImage source={poster} label={label} />
      <Text style={ui.muted}>This video is unavailable for in-app playback.</Text>
    </View>
}

function ClipPlayer({ uri, label }: { uri: string; label?: string }) {
  const player = useVideoPlayer(uri)
  const state = useEvent(player, 'statusChange', { status: player.status })
  useFocusEffect(useCallback(() => () => { player.pause() }, [player]))
  return <>
    <VideoView player={player} nativeControls style={styles.video} accessibilityLabel={label || 'Video player'} />
    {state.status === 'error' ? <Notice error>Could not load this video. Check your connection and try again.</Notice> : null}
  </>
}

const styles = StyleSheet.create({
  image: { width: '100%', borderRadius: 11, backgroundColor: colors.line },
  video: { width: '100%', aspectRatio: 16 / 9, borderRadius: 11, backgroundColor: colors.ink },
  media: { gap: 8 },
})
