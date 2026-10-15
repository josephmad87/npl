import type { ArticleDto } from '@/lib/api-types'

export type ArticleDisplayStatus =
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'archived'

export function getArticleDisplayStatus(
  article: Pick<ArticleDto, 'status' | 'published_at'>,
  now = Date.now(),
): ArticleDisplayStatus {
  if ((article.status === 'published' || article.status === 'scheduled') && article.published_at) {
    const publicationTime = Date.parse(article.published_at)
    if (Number.isFinite(publicationTime)) {
      return publicationTime > now ? 'scheduled' : 'published'
    }
  }

  if (
    article.status === 'draft' ||
    article.status === 'scheduled' ||
    article.status === 'published' ||
    article.status === 'archived'
  ) {
    return article.status
  }

  return 'draft'
}

export function formatArticlePublicationTime(value: string): string {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return value

  return `${new Intl.DateTimeFormat('en-ZW', {
    timeZone: 'Africa/Harare',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(timestamp)} CAT`
}
