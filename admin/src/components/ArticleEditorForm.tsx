import { useMemo, useState } from 'react'
import { Save, X } from 'lucide-react'
import type { ArticleDto } from '@/lib/api-types'
import {
  type CompetitionCategoryValue,
  normalizeCompetitionCategory,
} from '@/lib/competitionCategories'
import { CompetitionCategorySelect } from '@/components/CompetitionCategorySelect'
import { MediaUrlField } from '@/components/MediaUrlField'
import { RichTextEditor } from '@/components/RichTextEditor'

const STATUSES = ['draft', 'scheduled', 'published', 'archived'] as const

export type ArticleEditorValues = {
  title: string
  slug: string
  excerpt: string | null
  body: string | null
  featured_image_url: string | null
  author_name: string | null
  status: (typeof STATUSES)[number]
  category: CompetitionCategoryValue
  tags: string[] | null
  seo_title: string | null
  seo_description: string | null
}

function parseTagsInput(raw: string): string[] | null {
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return parts.length > 0 ? parts : null
}

function tagsToInput(tags: string[] | null | undefined): string {
  return (tags ?? []).join(', ')
}

function emptyArticleValues(): ArticleEditorValues {
  return {
    title: '',
    slug: '',
    excerpt: null,
    body: null,
    featured_image_url: null,
    author_name: null,
    status: 'draft',
    category: 'mens',
    tags: null,
    seo_title: null,
    seo_description: null,
  }
}

function fromArticle(a: ArticleDto): ArticleEditorValues {
  return {
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    body: a.body,
    featured_image_url: a.featured_image_url,
    author_name: a.author_name,
    status: STATUSES.find((s) => s === a.status) ?? 'draft',
    category: normalizeCompetitionCategory(a.category),
    tags: a.tags,
    seo_title: a.seo_title,
    seo_description: a.seo_description,
  }
}

type ArticleEditorFormProps = {
  mode: 'create' | 'edit'
  /** When editing, pass the loaded article; omit for create. */
  article: ArticleDto | null
  error: string | null
  isSubmitting?: boolean
  onCancel: () => void
  onSubmit: (values: ArticleEditorValues) => void | Promise<void>
}

export function ArticleEditorForm({
  mode,
  article,
  error,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: ArticleEditorFormProps) {
  const initial = useMemo(
    () => (article ? fromArticle(article) : emptyArticleValues()),
    [article],
  )

  const [localError, setLocalError] = useState<string | null>(null)

  const [title, setTitle] = useState(initial.title)
  const [slug, setSlug] = useState(initial.slug)
  const [excerpt, setExcerpt] = useState(initial.excerpt ?? '')
  const [bodyHtml, setBodyHtml] = useState(() => initial.body ?? '')
  const [featuredImageUrl, setFeaturedImageUrl] = useState(
    initial.featured_image_url ?? '',
  )
  const [authorName, setAuthorName] = useState(initial.author_name ?? '')
  const [category, setCategory] = useState<CompetitionCategoryValue>(initial.category)
  const [status, setStatus] = useState<(typeof STATUSES)[number]>(initial.status)
  const [tagsInput, setTagsInput] = useState(tagsToInput(initial.tags))
  const [seoTitle, setSeoTitle] = useState(initial.seo_title ?? '')
  const [seoDescription, setSeoDescription] = useState(
    initial.seo_description ?? '',
  )

  const handleSubmit = () => {
    const t = title.trim()
    const s = slug.trim()
    if (!t || !s) {
      setLocalError('Title and slug are required.')
      return
    }
    setLocalError(null)
    void onSubmit({
      title: t,
      slug: s,
      excerpt: excerpt.trim() || null,
      body:
        bodyHtml.trim() && bodyHtml.trim() !== '<p></p>' ? bodyHtml : null,
      featured_image_url: featuredImageUrl.trim() || null,
      author_name: authorName.trim() || null,
      status,
      category: normalizeCompetitionCategory(category),
      tags: parseTagsInput(tagsInput),
      seo_title: seoTitle.trim() || null,
      seo_description: seoDescription.trim() || null,
    })
  }

  const submitLabel =
    mode === 'create' ? 'Create article' : 'Update article'
  const displayError = error ?? localError

  return (
    <div className="article-editor">
      <div className="article-editor__main">
        <label className="article-editor__label" htmlFor="article-title">
          Title
        </label>
        <input
          id="article-title"
          className="article-editor__title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Article title"
          autoComplete="off"
        />

        <label className="article-editor__label" htmlFor="article-body">
          Content
        </label>
        <RichTextEditor
          key={article?.id ?? 'new-draft'}
          initialHtml={initial.body ?? ''}
          onHtmlChange={setBodyHtml}
          disabled={isSubmitting}
        />
      </div>

      <aside className="article-editor__sidebar" aria-label="Post settings">
        <div className="article-editor__panel">
          <h2 className="article-editor__panel-title">Publish</h2>
          <label className="article-editor__label" htmlFor="article-status">
            Status
          </label>
          <select
            id="article-status"
            className="inline-edit__control article-editor__control"
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as (typeof STATUSES)[number])
            }
          >
            {STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          <div className="article-editor__panel-actions">
            <button
              type="button"
              className="btn-ghost btn--with-icon"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              <X size={15} strokeWidth={2} aria-hidden />
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary btn--with-icon"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              <Save size={15} strokeWidth={2} aria-hidden />
              {submitLabel}
            </button>
          </div>
        </div>

        <div className="article-editor__panel">
          <h2 className="article-editor__panel-title">Slug & author</h2>
          <label className="article-editor__label" htmlFor="article-slug">
            Slug
          </label>
          <input
            id="article-slug"
            className="inline-edit__control article-editor__control"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            autoComplete="off"
          />
          <label className="article-editor__label" htmlFor="article-author">
            Author name
          </label>
          <input
            id="article-author"
            className="inline-edit__control article-editor__control"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            autoComplete="name"
          />
          <label className="article-editor__label" htmlFor="article-category">
            Competition category
          </label>
          <CompetitionCategorySelect
            id="article-category"
            className="inline-edit__control article-editor__control"
            value={category}
            onChange={setCategory}
          />
        </div>

        <div className="article-editor__panel">
          <h2 className="article-editor__panel-title">Excerpt & media</h2>
          <label className="article-editor__label" htmlFor="article-excerpt">
            Excerpt
          </label>
          <textarea
            id="article-excerpt"
            className="inline-edit__control article-editor__textarea"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={4}
            placeholder="Short summary for listings and SEO…"
          />
          <label className="article-editor__label" htmlFor="article-cover">
            Featured image
          </label>
          <MediaUrlField
            id="article-cover"
            uploadKind="news"
            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
            value={featuredImageUrl}
            onChange={(next) => setFeaturedImageUrl(next ?? '')}
            disabled={isSubmitting}
          />
        </div>

        <div className="article-editor__panel">
          <h2 className="article-editor__panel-title">Tags</h2>
          <label className="article-editor__label" htmlFor="article-tags">
            Tags (comma-separated)
          </label>
          <input
            id="article-tags"
            className="inline-edit__control article-editor__control"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="fixtures, finals, …"
            autoComplete="off"
          />
        </div>

        <div className="article-editor__panel">
          <h2 className="article-editor__panel-title">SEO</h2>
          <label className="article-editor__label" htmlFor="article-seo-title">
            SEO title
          </label>
          <input
            id="article-seo-title"
            className="inline-edit__control article-editor__control"
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            autoComplete="off"
          />
          <label
            className="article-editor__label"
            htmlFor="article-seo-description"
          >
            Meta description
          </label>
          <textarea
            id="article-seo-description"
            className="inline-edit__control article-editor__textarea"
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            rows={3}
          />
        </div>
      </aside>

      {displayError ? (
        <p className="login-error article-editor__error">{displayError}</p>
      ) : null}
    </div>
  )
}
