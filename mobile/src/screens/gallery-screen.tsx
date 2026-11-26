import { useCallback, useState } from 'react'
import { BackHandler, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { SiteLink } from '../components/app-link'
import { MediaImage, NativeMedia, youtubeVideoId } from '../components/native-media'
import { Action, LoadState, Screen, Segments, ui } from '../components/native-ui'
import { RichText } from '../components/rich-text'
import { BackLink } from '../components/team-ui'
import { usePagedPublic } from '../lib/use-paged-public'
import { usePublic, type Page } from '../lib/public-resource'
import { colors } from '../theme'

type Media = {
  id: number; slug?: string | null; title: string; description?: string | null
  media_type: 'image' | 'video'; file_url: string; thumbnail_url?: string | null
}
const types = [{ value: 'image', label: 'Photos' }, { value: 'video', label: 'Videos' }] as const

export function ScorecardGalleryLink({ id }: { id: number }) {
  return <SiteLink path={'/gallery/images?match_id=' + id} style={[ui.link, styles.matchLink]}>Match photos & videos ›</SiteLink>
}

export function GalleryScreen({ initial, item, matchId }: { initial: 'image' | 'video'; item?: string; matchId?: number }) {
  const [media, setMedia] = useState(initial)
  const [picked, setPicked] = useState<Media>()
  const lookup = usePublic<Page<Media>>(item ? '/gallery?q=' + encodeURIComponent(item) + '&page_size=10' : null)
  const data = usePagedPublic<Media>('/gallery?media_type=' + media + (matchId ? '&match_id=' + matchId : ''), 10)
  const columns = useWindowDimensions().width >= 670 ? 3 : 2
  const selected = picked || lookup.data?.items.find(candidate => candidate.slug === item)
  const galleryBack = matchId ? 'Match centre' : 'Back'
  useFocusEffect(useCallback(() => {
    if (!picked) return
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      setPicked(undefined)
      return true
    })
    return () => listener.remove()
  }, [picked]))

  if (selected) return <Screen title={selected.title} back={picked ? undefined : galleryBack}>
    {picked ? <Action tone="secondary" label="Back to photos & videos" onPress={() => setPicked(undefined)} /> : null}
    {selected.media_type === 'video'
      ? <NativeMedia source={selected.file_url} poster={selected.thumbnail_url} label={selected.title} />
      : <ScrollView minimumZoomScale={1} maximumZoomScale={3} centerContent style={styles.zoom}>
        <MediaImage source={selected.file_url} label={selected.title} fit="contain" aspect={1.2} />
      </ScrollView>}
    <RichText content={selected.description} basePath="/gallery" />
  </Screen>

  return <FlatList
    key={columns + media} style={ui.page} contentContainerStyle={ui.content} data={data.items}
    numColumns={columns} columnWrapperStyle={styles.row} keyExtractor={row => String(row.id)}
    contentInsetAdjustmentBehavior="automatic"
    refreshControl={<RefreshControl refreshing={data.loading && Boolean(data.data)} onRefresh={() => void data.refresh()} />}
    ListHeaderComponent={<View style={styles.top}>
      <BackLink label={galleryBack} fallback="/home" />
      <Text accessibilityRole="header" style={ui.title}>{matchId ? 'Match photos & videos' : 'Photos & videos'}</Text>
      <Segments value={media} options={types} onChange={setMedia} />
      <LoadState loading={data.loading && !data.data || lookup.loading} error={data.error || lookup.error} retry={() => void Promise.all([data.refresh(), lookup.refresh()])}
        empty={data.data && !data.items.length ? 'No ' + (media === 'video' ? 'videos' : 'photos') + ' have been published.' : undefined} />
      {item && lookup.data ? <Text style={ui.muted}>This media item is no longer available.</Text> : null}
    </View>}
    renderItem={({ item: entry }) => {
      const youtube = media === 'video' ? youtubeVideoId(entry.file_url) : undefined
      const thumbnail = entry.thumbnail_url || (media === 'image' ? entry.file_url : youtube ? 'https://i.ytimg.com/vi/' + youtube + '/hqdefault.jpg' : undefined)
      return <Pressable accessibilityRole="button" style={[styles.tile, { maxWidth: (100 / columns) + '%' }]}
        accessibilityLabel={(media === 'video' ? 'Play ' : 'Open ') + entry.title}
        onPress={() => setPicked(entry)}>
        {thumbnail ? <MediaImage source={thumbnail} aspect={1.72} /> : <View style={styles.poster}><Text style={ui.link}>Play video</Text></View>}
        <Text style={styles.caption}>{entry.title}</Text>
      </Pressable>
    }}
    ListFooterComponent={data.hasMore ? <View style={styles.top}>
      {data.moreError ? <Text style={ui.muted} accessibilityRole="alert">{data.moreError}</Text> : null}
      <Action label="View more" tone="secondary" busy={data.loadingMore} onPress={() => void data.more()} />
    </View> : undefined}
  />
}

const styles = StyleSheet.create({
  row: { gap: 10 },
  top: { gap: 12 },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: 11, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  caption: { color: colors.ink, fontSize: 13, fontWeight: '700', padding: 9 },
  poster: { aspectRatio: 1.72, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  zoom: { borderRadius: 10, backgroundColor: colors.ink, maxHeight: 550 },
  matchLink: { paddingHorizontal: 13, fontSize: 15 },
})
