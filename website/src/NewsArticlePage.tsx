import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'

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

const getApiBaseUrl = () => {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
  if (!baseUrl) {
    throw new Error('Missing VITE_API_BASE_URL. Set it in website/.env')
  }
  return baseUrl.replace(/\/+$/, '')
}

const resolveMediaUrl = (raw: string | null | undefined): string | null => {
  const value = raw?.trim() ?? ''
  if (!value) return null
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (value.startsWith('//')) return `${globalThis.location.protocol}${value}`
  if (value.startsWith('/')) {
    try {
      return `${new URL(getApiBaseUrl()).origin}${value}`
    } catch {
      return value
    }
  }
  return value
}

async function fetchNewsArticle(slug: string): Promise<ApiNewsArticle> {
  const response = await fetch(`${getApiBaseUrl()}/public/news/${slug}`)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return (await response.json()) as ApiNewsArticle
}

function extractList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === 'object') {
    const bag = payload as Record<string, unknown>
    const list = bag.items ?? bag.data ?? bag.results
    if (Array.isArray(list)) return list as T[]
  }
  return []
}

async function fetchRecentNews(): Promise<ApiNewsArticle[]> {
  const response = await fetch(`${getApiBaseUrl()}/public/news?page=1&page_size=8`)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  const payload = (await response.json()) as unknown
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
  const { data: recentNews = [] } = useQuery({
    queryKey: ['public-recent-news'],
    queryFn: fetchRecentNews,
    retry: 1,
  })

  const heroImage = resolveMediaUrl(article?.featured_image_url)
  const sidebarNews = recentNews.filter((item) => item.slug !== slug).slice(0, 5)

  return (
    <main className="container">
      <section className="article-page">
        {isLoading ? <p>Loading article...</p> : null}
        {isError ? <p>Could not load this news article.</p> : null}

        {!isLoading && !isError && article ? (
          <article className="article-content">
            {heroImage ? (
              <div className="article-hero">
                <img src={heroImage} alt={article.title} />
                <header className="article-hero-overlay">
                  {article.category ? <p className="article-category">{article.category}</p> : null}
                  <h1>{article.title}</h1>
                  <p className="article-meta">
                    By {article.author_name ?? 'NPL Media'} • {formatPublishDate(article.published_at)}
                  </p>
                  {article.excerpt ? <p className="article-excerpt">{article.excerpt}</p> : null}
                </header>
              </div>
            ) : (
              <header className="article-header">
                {article.category ? <p className="article-category">{article.category}</p> : null}
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
              <aside className="article-sidebar" aria-label="Recent news">
                <h3>Recent News</h3>
                <div className="article-sidebar-list">
                  {sidebarNews.map((item) => {
                    const thumb = resolveMediaUrl(item.featured_image_url)
                    return (
                      <Link key={item.id} to="/news/$slug" params={{ slug: item.slug }} className="article-sidebar-item">
                        {thumb ? <img src={thumb} alt={item.title} /> : <div className="article-sidebar-thumb-placeholder" />}
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
