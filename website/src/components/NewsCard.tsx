import { Link } from '@tanstack/react-router'
import { SiteLogoPlaceholder } from './SiteLogoPlaceholder'
import { formatCategoryLabel, formatMatchDate } from '../lib/formatters'
import { resolveMediaUrl } from '../lib/publicApi'
import type { ArticleLite } from '../lib/hooks'
import { ResponsiveImage } from './ResponsiveImage'

export function NewsCard({ article }: { article: ArticleLite }) {
  const image = resolveMediaUrl(article.featured_image_url)
  return (
    <Link to="/news/$slug" params={{ slug: article.slug }} className="ui-news-card">
      {image ? (
        <ResponsiveImage
          src={image}
          alt={article.title}
          widths={[320, 480, 640]}
          sizes="(max-width: 700px) 100vw, 33vw"
          fallbackWidth={480}
        />
      ) : (
        <SiteLogoPlaceholder className="ui-news-card-placeholder" />
      )}
      <div>
        <p>
          {article.category?.trim() ? formatCategoryLabel(article.category) : 'News'} •{' '}
          {formatMatchDate(article.published_at ?? article.created_at)}
        </p>
        <h3>{article.title}</h3>
        {article.excerpt ? <p>{article.excerpt}</p> : null}
      </div>
    </Link>
  )
}
