import { Link } from '@tanstack/react-router'
import { formatMatchDate } from '../lib/formatters'
import { resolveMediaUrl } from '../lib/publicApi'
import type { ArticleLite } from '../lib/hooks'

export function NewsCard({ article }: { article: ArticleLite }) {
  const image = resolveMediaUrl(article.featured_image_url)
  return (
    <Link to="/news/$slug" params={{ slug: article.slug }} className="ui-news-card">
      {image ? <img src={image} alt={article.title} /> : <div className="ui-news-card-placeholder" />}
      <div>
        <p>{article.category ?? 'News'} • {formatMatchDate(article.published_at)}</p>
        <h3>{article.title}</h3>
        {article.excerpt ? <p>{article.excerpt}</p> : null}
      </div>
    </Link>
  )
}
