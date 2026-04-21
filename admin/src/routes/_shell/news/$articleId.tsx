import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SquarePen } from 'lucide-react'
import { useState } from 'react'
import type { ArticleDto } from '@/lib/api-types'
import { sanitizeArticleHtml } from '@/lib/sanitizeArticleHtml'
import { adminListAll, adminPatch } from '@/lib/admin-client'
import {
  ArticleEditorForm,
  type ArticleEditorValues,
} from '@/components/ArticleEditorForm'
import { BackNavLink } from '@/components/BackNavLink'
import { DetailFields } from '@/components/DetailFields'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { parseDetailRouteSearch } from '@/lib/detail-route-search'
import { resolveAdminMediaUrl } from '@/lib/media-url'

export const Route = createFileRoute('/_shell/news/$articleId')({
  validateSearch: parseDetailRouteSearch,
  component: ArticleDetailPage,
})

function ArticleDetailPage() {
  const { articleId } = Route.useParams()
  const aid = Number(articleId)
  const { mode } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listQ = useQuery({
    queryKey: ['admin', 'news'],
    queryFn: () => adminListAll<ArticleDto>('/admin/news'),
  })
  const article = listQ.data?.find((a) => a.id === aid)
  const isEditing = mode === 'edit'
  const [saveError, setSaveError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [heroFailedFor, setHeroFailedFor] = useState<string | null>(null)

  const goView = () => {
    if (!article) return
    setSaveError(null)
    void navigate({
      to: '/news/$articleId',
      params: { articleId: String(article.id) },
      search: {},
    })
  }

  const beginEdit = () => {
    if (!article) return
    setSaveError(null)
    void navigate({
      to: '/news/$articleId',
      params: { articleId: String(article.id) },
      search: { mode: 'edit' },
    })
  }

  const save = async (values: ArticleEditorValues) => {
    if (!article || !Number.isFinite(aid)) return
    if (!values.title.trim() || !values.slug.trim()) {
      setSaveError('Title and slug are required.')
      return
    }
    setSaveError(null)
    setSubmitting(true)
    try {
      await adminPatch<ArticleDto>(`/admin/news/${aid}`, {
        title: values.title,
        slug: values.slug,
        excerpt: values.excerpt,
        body: values.body,
        featured_image_url: values.featured_image_url,
        author_name: values.author_name,
        status: values.status,
        category: values.category,
        tags: values.tags,
        seo_title: values.seo_title,
        seo_description: values.seo_description,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'news'] })
      goView()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (listQ.isLoading) {
    return <p className="muted">Loading…</p>
  }
  if (listQ.isError) {
    return <p className="login-error">{listQ.error.message}</p>
  }
  if (!article || !Number.isFinite(aid)) {
    return (
      <>
        <PageHeader title="Article not found" />
        <BackNavLink to="/news">Back to news</BackNavLink>
      </>
    )
  }

  const safeBody = sanitizeArticleHtml(article.body ?? '')
  const heroSrc = resolveAdminMediaUrl(article.featured_image_url)
  const showHero = Boolean(heroSrc && heroFailedFor !== heroSrc)

  return (
    <>
      <PageHeader
        title={isEditing ? `Edit — ${article.title}` : article.title}
        description={`Slug: ${article.slug} · ID ${article.id}`}
        actions={
          <>
            <BackNavLink to="/news">News</BackNavLink>
            {!isEditing ? (
              <button
                type="button"
                className="btn-primary btn--with-icon"
                onClick={beginEdit}
              >
                <SquarePen size={18} strokeWidth={2} aria-hidden />
                Edit article
              </button>
            ) : null}
          </>
        }
      />
      {isEditing ? (
        <ArticleEditorForm
          key={article.id}
          mode="edit"
          article={article}
          error={saveError}
          isSubmitting={submitting}
          onCancel={goView}
          onSubmit={(v) => void save(v)}
        />
      ) : (
        <div className="article-view-layout">
          <div className="article-view-layout__main">
            {showHero ? (
              <div className="article-view__hero">
                <img
                  src={heroSrc ?? ''}
                  alt=""
                  className="article-view__hero-img"
                  onError={() => setHeroFailedFor(heroSrc)}
                />
              </div>
            ) : null}
            {safeBody ? (
              <section
                className="article-view__body"
                aria-label="Article body"
                dangerouslySetInnerHTML={{ __html: safeBody }}
              />
            ) : (
              <p className="muted article-view__empty">No body content yet.</p>
            )}
          </div>
          <aside className="article-view-layout__sidebar" aria-label="Article metadata">
            <DetailFields
              items={[
                { label: 'Author', value: article.author_name ?? '—' },
                { label: 'Category', value: article.category ?? '—' },
                {
                  label: 'Tags',
                  value:
                    (article.tags?.length ?? 0) > 0
                      ? (article.tags ?? []).join(', ')
                      : '—',
                },
                {
                  label: 'Updated',
                  value: String(article.updated_at).slice(0, 19),
                },
                {
                  label: 'Published',
                  value: article.published_at
                    ? String(article.published_at).slice(0, 19)
                    : '—',
                },
                {
                  label: 'Status',
                  value: (
                    <StatusBadge
                      status={
                        article.status as
                          | 'draft'
                          | 'scheduled'
                          | 'published'
                          | 'archived'
                      }
                    />
                  ),
                },
                { label: 'Slug', value: article.slug },
                { label: 'SEO title', value: article.seo_title ?? '—' },
                {
                  label: 'Meta description',
                  value: article.seo_description ?? '—',
                },
                { label: 'Excerpt', value: article.excerpt ?? '—' },
              ]}
            />
          </aside>
        </div>
      )}
    </>
  )
}
