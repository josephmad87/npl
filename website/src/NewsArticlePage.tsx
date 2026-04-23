import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { ErrorNotice } from './components/ErrorNotice'
import { SiteLogoPlaceholder } from './components/SiteLogoPlaceholder'
import { parseArticleCompetitionCategory } from './lib/competitionCategories'
import { formatCategoryLabel } from './lib/formatters'
import { extractList, fetchJson, resolveMediaUrl } from './lib/publicApi'

type ApiNewsArticle = {
  id: number
  title: string
  slug: string
  excerpt: string | null
  body: string | null
  featured_image_url: string | null
  author_name: string | null
  published_at: string | null
  category: string | null
}

async function fetchNewsArticle(slug: string): Promise<ApiNewsArticle> {
  return fetchJson<ApiNewsArticle>(`/public/news/${slug}`)
}

async function fetchRecentNews(category?: string | null): Promise<ApiNewsArticle[]> {
  const suffix = category ? `&category=${encodeURIComponent(category)}` : ''
  const payload = await fetchJson<unknown>(`/public/news?page=1&page_size=8${suffix}`)
  return extractList<ApiNewsArticle>(payload)
}

function formatPublishDate(value: string | null): string {
  if (!value) return 'Unpublished'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) return value
  return new Intl.DateTimeFormat('en-ZW', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(parsed)
}

export default function NewsArticlePage() {
  const { slug } = useParams({ from: '/news/$slug' })
  const { data: article, isLoading, isError } = useQuery({
    queryKey: ['public-news-article', slug],
    queryFn: () => fetchNewsArticle(slug),
    retry: 1,
  })
  const relatedCategory = article ? parseArticleCompetitionCategory(article.category) : null
  const { data: recentNews = [] } = useQuery({
    queryKey: ['public-recent-news', relatedCategory ?? 'all'],
    queryFn: () => fetchRecentNews(relatedCategory),
    enabled: Boolean(article),
    retry: 1,
  })

  const heroImage = resolveMediaUrl(article?.featured_image_url)
  const sidebarNews = recentNews.filter((item) => item.slug !== slug).slice(0, 5)
  const categoryLine =
    article?.category?.trim() ? formatCategoryLabel(article.category) : null

  return (
    <main className="container">
      <section className="article-page">
        {isLoading ? (
          <div className="article-loading" role="status" aria-live="polite" aria-label="Loading article">
            <span className="article-loading-spinner" />
            <p>Loading article...</p>
          </div>
        ) : null}
        {isError ? (
          <ErrorNotice message="Could not load this news article. It may have been removed or the link is incorrect." />
        ) : null}

        {!isLoading && !isError && article ? (
          <article className="article-content">
            {heroImage ? (
              <div className="article-hero">
                <img src={heroImage} alt={article.title} />
                <header className="article-hero-overlay">
                  {categoryLine ? <p className="article-category">{categoryLine}</p> : null}
                  <h1>{article.title}</h1>
                  <p className="article-meta">
                    By {article.author_name ?? 'NPL Media'} • {formatPublishDate(article.published_at)}
                  </p>
                  {article.excerpt ? <p className="article-excerpt">{article.excerpt}</p> : null}
                </header>
              </div>
            ) : (
              <header className="article-header">
                {categoryLine ? <p className="article-category">{categoryLine}</p> : null}
                <h1>{article.title}</h1>
                <p className="article-meta">
                  By {article.author_name ?? 'NPL Media'} • {formatPublishDate(article.published_at)}
                </p>
                {article.excerpt ? <p className="article-excerpt">{article.excerpt}</p> : null}
              </header>
            )}
            <div className="article-lower">
              {article.body ? (
                <section className="article-body" dangerouslySetInnerHTML={{ __html: article.body }} />
              ) : (
                <p className="article-empty">Full story coming soon.</p>
              )}
              <aside
                className="article-sidebar"
                aria-label={relatedCategory ? 'Related news' : 'Recent news'}
              >
                <h3>{relatedCategory ? 'Related News' : 'Recent News'}</h3>
                <div className="article-sidebar-list">
                  {sidebarNews.map((item) => {
                    const thumb = resolveMediaUrl(item.featured_image_url)
                    return (
                      <Link key={item.id} to="/news/$slug" params={{ slug: item.slug }} className="article-sidebar-item">
                        {thumb ? (
                          <img src={thumb} alt={item.title} />
                        ) : (
                          <SiteLogoPlaceholder className="article-sidebar-thumb-placeholder" />
                        )}
                        <p>{item.title}</p>
                      </Link>
                    )
                  })}
                </div>
              </aside>
            </div>
          </article>
        ) : null}
      </section>
    </main>
  )
}
