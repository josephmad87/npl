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
import { getArticleDisplayStatus } from '@/lib/article-publication'
import {
  validateZimbabwePublicationTime,
  zimbabwePublicationInput,
} from '@/lib/scheduled-publication-time'

const STATUSES = ['draft', 'scheduled', 'published', 'archived'] as const

export type ArticleEditorValues = {
  title: string
  slug: string
  excerpt: string | null
  body: string | null
  featured_image_url: string | null
  body_image_url: string | null
  body_image_caption: string | null
  author_name: string | null
  status: (typeof STATUSES)[number]
  published_at: string | null
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

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function emptyArticleValues(): ArticleEditorValues {
  return {
    title: '',
    slug: '',
    excerpt: null,
    body: null,
    featured_image_url: null,
    body_image_url: null,
    body_image_caption: null,
    author_name: null,
    status: 'draft',
    published_at: null,
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
    body_image_url: a.body_image_url ?? null,
    body_image_caption: a.body_image_caption ?? null,
    author_name: a.author_name,
    status: getArticleDisplayStatus(a),
    published_at: a.published_at,
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
  const [bodyImageUrl, setBodyImageUrl] = useState(
    initial.body_image_url ?? '',
  )
  const [bodyImageCaption, setBodyImageCaption] = useState(
    initial.body_image_caption ?? '',
  )
  const [authorName, setAuthorName] = useState(initial.author_name ?? '')
  const [category, setCategory] = useState<CompetitionCategoryValue>(initial.category)
  const [status, setStatus] = useState<(typeof STATUSES)[number]>(initial.status)
  const [scheduleDate, setScheduleDate] = useState(
    () => initial.status === 'scheduled' ? zimbabwePublicationInput(initial.published_at).date : '',
  )
  const [scheduleTime, setScheduleTime] = useState(
    () => initial.status === 'scheduled' ? zimbabwePublicationInput(initial.published_at).time : '',
  )
  const [tagsInput, setTagsInput] = useState(tagsToInput(initial.tags))
  const [seoTitle, setSeoTitle] = useState(initial.seo_title ?? '')
  const [seoDescription, setSeoDescription] = useState(
    initial.seo_description ?? '',
  )
  const editorialChecks = [
    { label: 'A listing excerpt', ready: excerpt.trim().length > 0 },
    { label: 'A featured image', ready: featuredImageUrl.trim().length > 0 },
    { label: 'An SEO title', ready: seoTitle.trim().length > 0 },
    { label: 'A meta description', ready: seoDescription.trim().length > 0 },
    { label: 'At least one internal-search tag', ready: parseTagsInput(tagsInput) !== null },
  ]

  const handleSubmit = (nextStatus = status) => {
    const t = title.trim()
    const s = slug.trim() || (mode === 'create' ? slugify(t) : '')
    if (!t) {
      setLocalError('Enter a title before saving the story.')
      return
    }
    if (!s) {
      setLocalError('Enter a URL slug, or use a title with letters or numbers to generate one.')
      return
    }
    // Archiving keeps the historical publication date; returning to draft clears it.
    let publishedAt: string | null = nextStatus === 'archived' ? initial.published_at : null
    if (nextStatus === 'scheduled') {
      const schedule = validateZimbabwePublicationTime(scheduleDate, scheduleTime)
      if (schedule.error) {
        setLocalError(schedule.error)
        return
      }
      publishedAt = schedule.publishedAt
    } else if (nextStatus === 'published') {
      publishedAt = status === 'published' && initial.status === 'published' && initial.published_at
        ? initial.published_at
        : new Date().toISOString()
    }
    setLocalError(null)
    void onSubmit({
      title: t,
      slug: s,
      excerpt: excerpt.trim() || null,
      body:
        bodyHtml.trim() && bodyHtml.trim() !== '<p></p>' ? bodyHtml : null,
      featured_image_url: featuredImageUrl.trim() || null,
      body_image_url: bodyImageUrl.trim() || null,
      body_image_caption: bodyImageCaption.trim() || null,
      author_name: authorName.trim() || null,
      // A future publication timestamp makes the public API reveal the story automatically.
      status: nextStatus === 'scheduled' ? 'published' : nextStatus,
      published_at: publishedAt,
      category: normalizeCompetitionCategory(category),
      tags: parseTagsInput(tagsInput),
      seo_title: seoTitle.trim() || null,
      seo_description: seoDescription.trim() || null,
    })
  }

  const submitLabel = status === 'draft'
    ? 'Save draft'
    : status === 'scheduled'
      ? initial.status === 'scheduled' ? 'Update schedule' : 'Schedule story'
    : status === 'published'
      ? initial.status === 'published' ? 'Save changes' : 'Publish now'
      : mode === 'create' ? 'Create article' : 'Update article'
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
          enableTables
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
            className="inline-edit__control article-editor__control article-editor__select"
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as (typeof STATUSES)[number])
            }
          >
            {STATUSES.map((st) => (
              <option key={st} value={st}>
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </option>
            ))}
          </select>
          {status === 'scheduled' ? (
            <div aria-describedby="article-schedule-hint">
              <p id="article-schedule-hint" className="muted article-editor__hint">
                The story will go live automatically at this Zimbabwe time (CAT, UTC+2).
              </p>
              <label className="article-editor__label" htmlFor="article-schedule-date">
                Go-live date
              </label>
              <input
                id="article-schedule-date"
                type="date"
                className="inline-edit__control article-editor__control"
                value={scheduleDate}
                onChange={(event) => setScheduleDate(event.target.value)}
                disabled={isSubmitting}
                required
              />
              <label className="article-editor__label" htmlFor="article-schedule-time">
                Go-live time (Zimbabwe time)
              </label>
              <input
                id="article-schedule-time"
                type="time"
                className="inline-edit__control article-editor__control"
                value={scheduleTime}
                onChange={(event) => setScheduleTime(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          ) : null}
          <label className="article-editor__label" htmlFor="article-category">
            Competition category
          </label>
          <CompetitionCategorySelect
            id="article-category"
            className="inline-edit__control article-editor__control article-editor__select"
            value={category}
            onChange={setCategory}
          />
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
              className={`${status === 'draft' ? 'btn-ghost' : 'btn-primary'} btn--with-icon`}
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
            >
              <Save size={15} strokeWidth={2} aria-hidden />
              {isSubmitting ? 'Saving…' : submitLabel}
            </button>
          </div>
          {status === 'draft' || status === 'scheduled' ? (
            <button
              type="button"
              className="btn-primary article-editor__publish-now"
              onClick={() => handleSubmit('published')}
              disabled={isSubmitting}
            >
              Publish now
            </button>
          ) : null}
          {displayError ? (
            <p className="login-error article-editor__error" role="alert">{displayError}</p>
          ) : null}
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
            placeholder={mode === 'create' ? 'Generated from the title if left blank' : undefined}
            autoComplete="off"
          />
          {mode === 'create' ? (
            <p className="muted article-editor__hint">Leave blank to generate the URL from the title.</p>
          ) : null}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setSlug(slugify(title))}
            disabled={!title.trim() || isSubmitting}
          >
            Generate slug from title
          </button>
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
          <label className="article-editor__label" htmlFor="article-body-image">
            Body image
          </label>
          <p className="muted article-editor__hint">
            Optional image shown in the article body (below the header, not
            covered by title text).
          </p>
          <MediaUrlField
            id="article-body-image"
            uploadKind="news"
            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
            value={bodyImageUrl}
            onChange={(next) => setBodyImageUrl(next ?? '')}
            disabled={isSubmitting}
          />
          <label className="article-editor__label" htmlFor="article-body-image-caption">
            Body image caption
          </label>
          <textarea
            id="article-body-image-caption"
            className="inline-edit__control article-editor__textarea"
            value={bodyImageCaption}
            onChange={(e) => setBodyImageCaption(e.target.value)}
            rows={2}
            maxLength={512}
            placeholder="Optional caption or photo credit…"
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
            aria-describedby="article-seo-title-count"
          />
          <p id="article-seo-title-count" className="muted article-editor__hint">
            {seoTitle.length}/60 characters recommended
          </p>
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
            aria-describedby="article-seo-description-count"
          />
          <p id="article-seo-description-count" className="muted article-editor__hint">
            {seoDescription.length}/160 characters recommended
          </p>
          <h3>Publication checklist</h3>
          <ul className="article-editor__seo-checklist">
            {editorialChecks.map((check) => (
              <li key={check.label}>
                <span aria-hidden>{check.ready ? '✓' : '○'}</span>{' '}
                {check.label}
              </li>
            ))}
          </ul>
        </div>
      </aside>

    </div>
  )
}
