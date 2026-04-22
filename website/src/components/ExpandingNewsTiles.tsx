import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { resolveMediaUrl } from '../lib/publicApi'
import type { ArticleLite } from '../lib/hooks'

export function ExpandingNewsTiles({ articles }: { articles: ArticleLite[] }) {
  const [active, setActive] = useState(0)

  if (articles.length === 0) return null

  return (
    <section className="expanding-tiles" aria-label="Featured news">
      {articles.map((article, idx) => {
        const image = resolveMediaUrl(article.featured_image_url)
        const isActive = idx === active
        return (
          <Link
            key={article.id}
            to="/news/$slug"
            params={{ slug: article.slug }}
            className={`expanding-tiles__panel${isActive ? ' is-active' : ''}`}
            onMouseEnter={() => setActive(idx)}
            onFocus={() => setActive(idx)}
            style={image ? { backgroundImage: `linear-gradient(180deg, transparent 20%, rgba(0,0,0,.65) 100%), url(${image})` } : undefined}
          >
            <div>
              <p>{article.category ?? 'News'}</p>
              <h3>{article.title}</h3>
            </div>
          </Link>
        )
      })}
    </section>
  )
}
