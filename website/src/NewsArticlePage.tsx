import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { ErrorNotice } from './components/ErrorNotice'
import { SocialShareButtons } from './components/SocialShareButtons'
import { SiteLogoPlaceholder } from './components/SiteLogoPlaceholder'
import { ResponsiveImage } from './components/ResponsiveImage'
import { Breadcrumbs } from './components/Breadcrumbs'
import { SeoHead } from './components/SeoHead'
import { parseArticleCompetitionCategory } from './lib/competitionCategories'
import { formatCategoryLabel } from './lib/formatters'
import { fetchAllPaginatedList, fetchJson, resolveMediaUrl } from './lib/publicApi'
import { sanitizeHtml } from './lib/sanitizeHtml'
import { managedSection, useSitePageContent } from './lib/siteContent'
import { ManagedSiteHtml } from './components/ManagedSiteHtml'

type ApiNewsArticle = {
  id: number
  title: string
  slug: string
  excerpt: string | null
  body: string | null
  featured_image_url: string | null
  body_image_url: string | null
  author_name: string | null
  published_at: string | null
  created_at: string | null
  updated_at?: string | null
  category: string | null
  seo_title?: string | null
  seo_description?: string | null
  tags?: string[] | null
}

async function fetchNewsArticle(slug: string): Promise<ApiNewsArticle> {
  return fetchJson<ApiNewsArticle>(`/public/news/${slug}`)
}

async function fetchRecentNews(
  category?: string | null,
): Promise<ApiNewsArticle[]> {
  const suffix = category ? `&category=${encodeURIComponent(category)}` : ''

  return fetchAllPaginatedList<ApiNewsArticle>(
    (page) => `/public/news?page=${page}&page_size=50${suffix}`,
    10,
  )
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

function cleanArticleText(value: string | null | undefined): string {
  if (!value) return ''

  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateShareText(value: string, max = 220): string {
  if (value.length <= max) return value

  return `${value.slice(0, max - 1).trim()}…`
}

export default function NewsArticlePage() {
  const { slug } = useParams({ from: '/news/$slug' })
  const contentQ = useSitePageContent('news')

  const { data: article, isLoading, isError } = useQuery({
    queryKey: ['public-news-article', slug],
    queryFn: () => fetchNewsArticle(slug),
    retry: 1,
  })

  const relatedCategory = article
    ? parseArticleCompetitionCategory(article.category)
    : null
  const sidebarContent = managedSection(
    contentQ.data,
    relatedCategory ? 'related-news' : 'recent-news',
    relatedCategory ? 'Related News' : 'Recent News',
  )

  const { data: recentNews = [] } = useQuery({
    queryKey: ['public-recent-news', relatedCategory ?? 'all'],
    queryFn: () => fetchRecentNews(relatedCategory),
    enabled: Boolean(article),
    retry: 1,
  })

  const heroImage = resolveMediaUrl(article?.featured_image_url)
  const bodyImage = resolveMediaUrl(article?.body_image_url)

  const sidebarNews = recentNews
    .filter((item) => item.slug !== slug)
    .slice(0, 5)

  const categoryLine = article?.category?.trim()
    ? formatCategoryLabel(article.category)
    : null

  const publishedLine = article
    ? formatPublishDate(article.published_at ?? article.created_at)
    : ''

  const articleShareText = article
    ? truncateShareText(
        [
          categoryLine,
          article.excerpt || cleanArticleText(article.body),
          publishedLine,
        ]
          .filter(Boolean)
          .join(' · '),
      )
    : ''

  return (
    <main className="container">
      <section className="article-page">
        {isLoading ? (
          <div
            className="article-loading"
            role="status"
            aria-live="polite"
            aria-label="Loading article"
          >
            <span className="article-loading-spinner" />
            <p>Loading article...</p>
          </div>
        ) : null}

        {isError ? (
          <ErrorNotice message="Could not load this news article. It may have been removed or the link is incorrect." />
        ) : null}

        {!isLoading && !isError && article ? (
          <>
            <SeoHead
              title={article.seo_title || article.title}
              description={
                article.seo_description ||
                article.excerpt ||
                truncateShareText(cleanArticleText(article.body), 160)
              }
              canonicalPath={`/news/${article.slug}`}
              image={heroImage}
              type="article"
              breadcrumbs={[
                { name: 'Home', path: '/' },
                { name: 'News', path: '/news' },
                { name: article.title, path: `/news/${article.slug}` },
              ]}
              structuredData={{
                '@context': 'https://schema.org',
                '@type': 'NewsArticle',
                headline: article.title,
                description: article.seo_description || article.excerpt || undefined,
                image: heroImage ? [heroImage] : undefined,
                datePublished: article.published_at || article.created_at || undefined,
                dateModified:
                  article.updated_at || article.published_at || article.created_at || undefined,
                author: {
                  '@type': article.author_name ? 'Person' : 'Organization',
                  name: article.author_name || 'NPL Zimbabwe',
                },
                keywords: article.tags?.join(', ') || undefined,
              }}
            />
            <Breadcrumbs
              items={[
                { name: 'Home', path: '/' },
                { name: 'News', path: '/news' },
                { name: article.title, path: `/news/${article.slug}` },
              ]}
            />
            {heroImage ? (
              <header className="article-hero">
                <ResponsiveImage
                  src={heroImage}
                  alt={article.title}
                  widths={[480, 768, 1024, 1280, 1600]}
                  sizes="100vw"
                  fallbackWidth={1280}
                  priority
                />
                <div className="article-hero-overlay">
                  {categoryLine ? (
                    <p className="article-category">{categoryLine}</p>
                  ) : null}

                  <h1>{article.title}</h1>

                  <p className="article-meta">
                    By {article.author_name ?? 'NPL Media'} • {publishedLine}
                  </p>
                </div>
              </header>
            ) : (
              <header className="article-header">
                {categoryLine ? (
                  <p className="article-category">{categoryLine}</p>
                ) : null}

                <h1>{article.title}</h1>

                <p className="article-meta">
                  By {article.author_name ?? 'NPL Media'} • {publishedLine}
                </p>
              </header>
            )}

            <div className="article-share-row">
              <SocialShareButtons
                title={article.title}
                text={articleShareText}
              />
            </div>

            <div className="article-page__content">
              <div className="article-page__main">
                {article.excerpt ? (
                  <p className="article-lead">{article.excerpt}</p>
                ) : null}

                {bodyImage ? (
                  <figure className="article-body-image">
                    <ResponsiveImage
                      src={bodyImage}
                      alt=""
                      widths={[480, 768, 1024, 1280]}
                      sizes="(max-width: 900px) 100vw, 70vw"
                      fallbackWidth={1024}
                    />
                  </figure>
                ) : null}

                {article.body ? (
                  <section
                    className="article-body"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.body) }}
                  />
                ) : article.excerpt ? null : (
                  <p className="article-empty">Full story coming soon.</p>
                )}
              </div>

              <aside
                className="article-sidebar"
                aria-label={relatedCategory ? 'Related news' : 'Recent news'}
              >
                <h3>{sidebarContent.heading}</h3>
                <ManagedSiteHtml html={sidebarContent.body_html} className="ui-section-header-description managed-rich-text" />

                <div className="article-sidebar-list">
                  {sidebarNews.map((item) => {
                    const thumb = resolveMediaUrl(item.featured_image_url)

                    return (
                      <Link
                        key={item.id}
                        to="/news/$slug"
                        params={{ slug: item.slug }}
                        className="article-sidebar-item"
                      >
                        {thumb ? (
                          <ResponsiveImage
                            src={thumb}
                            alt={item.title}
                            widths={[160, 240, 320]}
                            sizes="120px"
                            fallbackWidth={240}
                          />
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
            <nav className="article-page__explore" aria-label="Explore more NPL content">
              <Link to="/fixtures">View fixtures</Link>
              <Link to="/results">View results</Link>
              <Link to="/competition">Competition information</Link>
            </nav>
          </>
        ) : null}
      </section>
    </main>
  )
}
