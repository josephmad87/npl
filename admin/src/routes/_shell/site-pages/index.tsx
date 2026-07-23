import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { PageHeader } from '@/components/PageHeader'
import { RichTextEditor } from '@/components/RichTextEditor'
import { adminGet, adminPatch } from '@/lib/admin-client'
import { ApiError } from '@/lib/api'
import type {
  SitePageBodyDto,
  SitePageDto,
  SitePageSectionDto,
  SitePageSlug,
} from '@/lib/api-types'
import { getSession } from '@/lib/session'

export const Route = createFileRoute('/_shell/site-pages/')({
  beforeLoad: () => {
    if (getSession()?.role !== 'super_admin') {
      throw redirect({ to: '/profile' })
    }
  },
  component: SitePagesAdminPage,
})

const PAGE_OPTIONS: Array<{
  slug: SitePageSlug
  label: string
  publicPath: string
}> = [
  { slug: 'privacy', label: 'Privacy', publicPath: '/privacy' },
  { slug: 'terms', label: 'Terms', publicPath: '/terms' },
  { slug: 'support', label: 'Support', publicPath: '/support' },
  {
    slug: 'account-deletion',
    label: 'Account deletion',
    publicPath: '/account-deletion',
  },
]

function makeSectionId(heading: string, sections: SitePageSectionDto[]): string {
  const base =
    heading
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  const used = new Set(sections.map((section) => section.id))
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

type SectionEditorProps = {
  section: SitePageSectionDto
  index: number
  count: number
  pageKey: string
  onChange: (index: number, patch: Partial<SitePageSectionDto>) => void
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: (index: number) => void
}

function SectionEditor({
  section,
  index,
  count,
  pageKey,
  onChange,
  onMove,
  onRemove,
}: SectionEditorProps) {
  const handleBodyChange = useCallback(
    (bodyHtml: string) => onChange(index, { body_html: bodyHtml }),
    [index, onChange],
  )

  return (
    <article className="site-page-editor__section">
      <header className="site-page-editor__section-header">
        <div>
          <p>Section {index + 1}</p>
          <span>Anchor: #{section.id}</span>
        </div>
        <div className="site-page-editor__section-actions">
          <button
            type="button"
            className="btn-ghost btn--with-icon"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            aria-label={`Move ${section.heading} up`}
          >
            <ArrowUp size={16} aria-hidden />
            Up
          </button>
          <button
            type="button"
            className="btn-ghost btn--with-icon"
            onClick={() => onMove(index, 1)}
            disabled={index === count - 1}
            aria-label={`Move ${section.heading} down`}
          >
            <ArrowDown size={16} aria-hidden />
            Down
          </button>
          <button
            type="button"
            className="btn-ghost btn--with-icon site-page-editor__remove"
            onClick={() => onRemove(index)}
          >
            <Trash2 size={16} aria-hidden />
            Remove
          </button>
        </div>
      </header>

      <label className="settings-form__group">
        <span className="settings-form__label">Section heading</span>
        <input
          value={section.heading}
          onChange={(event) => onChange(index, { heading: event.target.value })}
          maxLength={200}
          required
        />
      </label>

      <div className="settings-form__group">
        <span className="settings-form__label">Section content</span>
        <RichTextEditor
          key={`${pageKey}-${section.id}`}
          initialHtml={section.body_html}
          onHtmlChange={handleBodyChange}
          placeholder="Write this section…"
        />
      </div>
    </article>
  )
}

function SitePagesAdminPage() {
  const queryClient = useQueryClient()
  const [selectedSlug, setSelectedSlug] = useState<SitePageSlug>('privacy')
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [introHtml, setIntroHtml] = useState('')
  const [sections, setSections] = useState<SitePageSectionDto[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState<string | null>(null)

  const selectedOption = useMemo(
    () => PAGE_OPTIONS.find((option) => option.slug === selectedSlug)!,
    [selectedSlug],
  )

  const pageQuery = useQuery({
    queryKey: ['admin', 'site-page', selectedSlug],
    queryFn: () =>
      adminGet<SitePageDto>(`/admin/site-pages/${selectedSlug}`),
    refetchOnWindowFocus: false,
  })

  /* Intentional: load the selected server page into the editor form. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!pageQuery.data) return
    setTitle(pageQuery.data.title)
    setSubtitle(pageQuery.data.subtitle)
    setEffectiveDate(pageQuery.data.effective_date)
    setIntroHtml(pageQuery.data.intro_html)
    setSections(pageQuery.data.sections.map((section) => ({ ...section })))
    setFormError(null)
    setSavedFlash(null)
  }, [pageQuery.data])
  /* eslint-enable react-hooks/set-state-in-effect */

  const saveMutation = useMutation({
    mutationFn: (body: SitePageBodyDto) =>
      adminPatch<SitePageDto>(`/admin/site-pages/${selectedSlug}`, body),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ['admin', 'site-page', selectedSlug],
        data,
      )
      setSavedFlash(`Saved at ${new Date().toLocaleString()}`)
      setFormError(null)
    },
    onError: (error: unknown) => {
      setSavedFlash(null)
      if (error instanceof ApiError) {
        setFormError(error.message)
        return
      }
      setFormError(error instanceof Error ? error.message : 'Save failed')
    },
  })

  const updateSection = useCallback(
    (index: number, patch: Partial<SitePageSectionDto>) => {
      setSections((current) =>
        current.map((section, sectionIndex) =>
          sectionIndex === index ? { ...section, ...patch } : section,
        ),
      )
    },
    [],
  )

  const moveSection = useCallback((index: number, direction: -1 | 1) => {
    setSections((current) => {
      const destination = index + direction
      if (destination < 0 || destination >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(destination, 0, moved)
      return next
    })
  }, [])

  const removeSection = useCallback((index: number) => {
    setSections((current) =>
      current.filter((_, sectionIndex) => sectionIndex !== index),
    )
  }, [])

  const addSection = () => {
    const heading = 'New section'
    setSections((current) => [
      ...current,
      {
        id: makeSectionId(heading, current),
        heading,
        body_html: '<p></p>',
      },
    ])
  }

  const save = () => {
    const trimmedTitle = title.trim()
    const normalizedSections = sections.map((section) => ({
      ...section,
      heading: section.heading.trim(),
    }))
    if (!trimmedTitle) {
      setFormError('Page title is required.')
      return
    }
    if (normalizedSections.some((section) => !section.heading)) {
      setFormError('Every section must have a heading.')
      return
    }
    setFormError(null)
    saveMutation.mutate({
      title: trimmedTitle,
      subtitle: subtitle.trim(),
      effective_date: effectiveDate.trim(),
      intro_html: introHtml,
      sections: normalizedSections,
    })
  }

  const body = pageQuery.isLoading ? (
    <div className="settings-panel site-page-editor__loading">
      <Loader2 className="spin" size={20} aria-hidden />
      Loading {selectedOption.label.toLowerCase()} page…
    </div>
  ) : pageQuery.isError || !pageQuery.data ? (
    <div className="settings-panel">
      <p className="settings-form__error">
        {pageQuery.error instanceof Error
          ? pageQuery.error.message
          : 'Could not load page content.'}
      </p>
      <button
        type="button"
        className="btn-primary"
        onClick={() => void pageQuery.refetch()}
      >
        Retry
      </button>
    </div>
  ) : (
    <form
      className="site-page-editor"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <section className="settings-panel site-page-editor__settings">
        <label className="settings-form__group">
          <span className="settings-form__label">Page title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            required
          />
        </label>

        <label className="settings-form__group">
          <span className="settings-form__label">Page subtitle</span>
          <textarea
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            rows={3}
            maxLength={500}
          />
        </label>

        <label className="settings-form__group">
          <span className="settings-form__label">Effective date</span>
          <input
            value={effectiveDate}
            onChange={(event) => setEffectiveDate(event.target.value)}
            placeholder="For example, 23 July 2026"
            maxLength={80}
          />
          <span className="settings-form__hint">
            Leave blank on support or account-deletion pages if no date should appear.
          </span>
        </label>

        <div className="settings-form__group">
          <span className="settings-form__label">Introduction</span>
          <RichTextEditor
            key={`${selectedSlug}-intro-${pageQuery.data.updated_at}`}
            initialHtml={pageQuery.data.intro_html}
            onHtmlChange={setIntroHtml}
            placeholder="Write the page introduction…"
          />
        </div>
      </section>

      <section className="site-page-editor__sections">
        <div className="site-page-editor__sections-heading">
          <div>
            <h2>Page sections</h2>
            <p>
              Reorder sections with the controls. Headings also create the public
              page navigation.
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost btn--with-icon"
            onClick={addSection}
          >
            <Plus size={17} aria-hidden />
            Add section
          </button>
        </div>

        {sections.map((section, index) => (
          <SectionEditor
            key={section.id}
            section={section}
            index={index}
            count={sections.length}
            pageKey={`${selectedSlug}-${pageQuery.data.updated_at}`}
            onChange={updateSection}
            onMove={moveSection}
            onRemove={removeSection}
          />
        ))}
      </section>

      <footer className="site-page-editor__footer">
        <div>
          {formError ? (
            <p className="settings-form__error" role="alert">
              {formError}
            </p>
          ) : null}
          {savedFlash ? (
            <p className="settings-panel__saved" role="status">
              {savedFlash}
            </p>
          ) : null}
          <p className="settings-form__meta">
            Last updated{' '}
            {new Date(pageQuery.data.updated_at).toLocaleString()}
          </p>
        </div>
        <button
          type="submit"
          className="btn-primary btn--with-icon"
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="spin" size={17} aria-hidden />
          ) : (
            <Save size={17} aria-hidden />
          )}
          {saveMutation.isPending ? 'Saving…' : 'Save page'}
        </button>
      </footer>
    </form>
  )

  return (
    <>
      <PageHeader
        title="Policy & support pages"
        description="Super-admin-only content management for the four public legal and support routes."
        actions={
          <a
            className="btn-ghost btn--with-icon"
            href={selectedOption.publicPath}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} aria-hidden />
            View public page
          </a>
        }
      />

      <nav className="site-page-tabs" aria-label="Managed pages">
        {PAGE_OPTIONS.map((option) => (
          <button
            key={option.slug}
            type="button"
            className={option.slug === selectedSlug ? 'is-active' : ''}
            aria-current={option.slug === selectedSlug ? 'page' : undefined}
            onClick={() => setSelectedSlug(option.slug)}
          >
            {option.label}
          </button>
        ))}
      </nav>

      {body}
    </>
  )
}
