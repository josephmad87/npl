import { useLocalSearchParams } from 'expo-router'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { SiteLink } from '../components/app-link'
import { formatDate } from '../components/match-card'
import { MediaImage } from '../components/native-media'
import { Action, LoadState, Screen, ui } from '../components/native-ui'
import { RichText, plainText } from '../components/rich-text'
import type { Article } from '../lib/feed'
import { usePublic } from '../lib/public-resource'
import { usePageExpansion, usePagedPublic } from '../lib/use-paged-public'
import { colors } from '../theme'

type Story = Article & {
  category?: string | null; body?: string | null; author_name?: string | null
  body_image_url?: string | null; body_image_caption?: string | null
  related_entities?: { match_ids?: number[]; team_ids?: number[] } | null
}

export function NewsScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>()
  return q ? <FilteredNews key={q} query={q} /> : <LatestNews />
}

function FilteredNews({ query }: { query: string }) {
  return <NewsList {...usePagedPublic<Article>('/news?q=' + encodeURIComponent(query), 5)} query={query} />
}

function LatestNews() {
  const first = usePublic<Article[]>('/homepage-news', { maxAge: 30_000 })
  const pages = usePageExpansion('/news', 5, first.data ? { items: first.data, page: 1, pages: first.data.length === 5 ? 2 : 1, total: first.data.length } : undefined)
  return <NewsList {...first} {...pages} />
}

function NewsList({ items, hasMore, loadingMore, moreError, more, loading, error, refresh, data, query }: {
  items: Article[]; hasMore: boolean; loadingMore: boolean; moreError: string; more: () => Promise<void>
  loading: boolean; error?: string; refresh: () => Promise<void>; data?: unknown; query?: string
}) {
  return <FlatList style={ui.page} contentContainerStyle={[ui.content, s.top]} data={items}
    keyExtractor={article => String(article.id)} contentInsetAdjustmentBehavior="automatic"
    refreshControl={<RefreshControl refreshing={loading && Boolean(data)} onRefresh={() => void refresh()} />}
    ListHeaderComponent={<View style={s.header}>
      <Text accessibilityRole="header" style={ui.title}>NPL News</Text>
      {query ? <Text style={ui.muted}>Stories matching “{query}”</Text> : null}
      <LoadState loading={loading && !data} error={error} retry={() => void refresh()}
        empty={data && !items.length ? query ? 'No stories match this search.' : 'League stories will appear here.' : undefined} />
    </View>}
    renderItem={({ item }) => <StoryCard story={item} />}
    ListFooterComponent={hasMore ? <View style={s.header}>
      {moreError ? <Text style={ui.muted} accessibilityRole="alert">{moreError}</Text> : null}
      <Action label="View older stories" tone="secondary" busy={loadingMore} onPress={() => void more()} />
    </View> : undefined}
  />
}

export function StoryCard({ story, compact }: { story: Story; compact?: boolean }) {
  const date = formatDate(story.published_at || story.created_at, true)
  return <SiteLink path={'/news/' + story.slug} asChild>
    <Pressable accessibilityRole="link" style={[ui.panel, compact && s.compact]}>
      {story.featured_image_url ? <View style={compact ? s.thumbnail : undefined}><MediaImage source={story.featured_image_url} aspect={compact ? 1.16 : 1.85} /></View> : null}
      <View style={s.fill}>
        <Text style={compact ? ui.rowTitle : ui.heading}>{story.title}</Text>
        {date ? <Text style={ui.muted}>{date}</Text> : null}
        {!compact && story.excerpt ? <Text numberOfLines={2} style={ui.muted}>{plainText(story.excerpt)}</Text> : null}
      </View>
      {compact ? <Text accessible={false} style={s.chevron}>›</Text> : null}
    </Pressable>
  </SiteLink>
}

export function ArticleScreen({ slug }: { slug: string }) {
  const path = '/news/' + slug
  const resource = usePublic<Story>('/news/' + encodeURIComponent(slug), { maxAge: 45_000 })
  const story = resource.data
  const metadata = story ? [formatDate(story.published_at || story.created_at, true), story.category, story.author_name].filter(Boolean).join(' · ') : ''
  return <Screen back="News" title={story ? undefined : 'News'} refreshing={resource.loading && Boolean(story)} onRefresh={() => void resource.refresh()}>
    <LoadState loading={resource.loading && !story} error={resource.error} retry={() => void resource.refresh()} />
    {story ? <>
      {metadata ? <Text style={s.metadata}>{metadata}</Text> : null}
      <Text accessibilityRole="header" style={ui.title}>{story.title}</Text>
      <MediaImage source={story.featured_image_url} />
      <RichText content={story.body || story.excerpt} basePath={path} />
      {story.body_image_url && story.body_image_url !== story.featured_image_url && !story.body?.includes(story.body_image_url) ? <>
        <MediaImage source={story.body_image_url} label={story.body_image_caption || undefined} />
        {story.body_image_caption ? <Text style={ui.muted}>{story.body_image_caption}</Text> : null}
      </> : null}
      {story.related_entities?.match_ids?.map(id => <SiteLink key={id} path={'/matches/' + id} section="scorecard" style={ui.link}>View match scorecard ›</SiteLink>)}
    </> : null}
  </Screen>
}

const s = StyleSheet.create({
  top: { paddingTop: 18 },
  header: { gap: 10, paddingBottom: 4 },
  metadata: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  fill: { flexShrink: 1, gap: 4 },
  compact: { flexDirection: 'row', alignItems: 'center', padding: 9 },
  thumbnail: { width: 75, flexShrink: 0 },
  chevron: { color: colors.accent, fontSize: 23 },
})
