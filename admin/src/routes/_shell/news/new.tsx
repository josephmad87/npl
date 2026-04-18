import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { ArticleDto } from '@/lib/api-types'
import { adminPost } from '@/lib/admin-client'
import {
  ArticleEditorForm,
  type ArticleEditorValues,
} from '@/components/ArticleEditorForm'
import { BackNavLink } from '@/components/BackNavLink'
import { PageHeader } from '@/components/PageHeader'

export const Route = createFileRoute('/_shell/news/new')({
  component: NewArticlePage,
})

function NewArticlePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const save = async (values: ArticleEditorValues) => {
    if (!values.title.trim() || !values.slug.trim()) {
      setSaveError('Title and slug are required.')
      return
    }
    setSaveError(null)
    setSubmitting(true)
    try {
      const created = await adminPost<ArticleDto>('/admin/news', {
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
        published_at: null,
        related_entities: null,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'news'] })
      void navigate({
        to: '/news/$articleId',
        params: { articleId: String(created.id) },
      })
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="New article"
        descriptionAsTooltip
        description="POST /admin/news — rich HTML body, excerpt, tags, and SEO fields match the public article payload."
        actions={
          <BackNavLink to="/news">News</BackNavLink>
        }
      />
      <ArticleEditorForm
        mode="create"
        article={null}
        error={saveError}
        isSubmitting={submitting}
        onCancel={() => void navigate({ to: '/news' })}
        onSubmit={(v) => void save(v)}
      />
    </>
  )
}
