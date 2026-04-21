import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import type { ArticleDto } from '@/lib/api-types'
import { adminListAll } from '@/lib/admin-client'
import { CatalogFilterGrid } from '@/components/CatalogFilterGrid'
import { EntityTable } from '@/components/EntityTable'
import { ListViewModeSwitch } from '@/components/ListViewModeSwitch'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { useListViewMode } from '@/hooks/useListViewMode'

export const Route = createFileRoute('/_shell/news/')({
  component: NewsPage,
})

const columns: ColumnDef<ArticleDto, unknown>[] = [
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'category', header: 'Category' },
  { accessorKey: 'author_name', header: 'Author' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => (
      <StatusBadge
        status={
          getValue() as
            | 'draft'
            | 'scheduled'
            | 'published'
            | 'archived'
        }
      />
    ),
  },
  {
    accessorKey: 'updated_at',
    header: 'Updated',
    cell: ({ getValue }) => String(getValue()).slice(0, 10),
  },
]

function NewsPage() {
  const [mode, setMode] = useListViewMode('news')
  const navigate = useNavigate()
  const q = useQuery({
    queryKey: ['admin', 'news'],
    queryFn: () => adminListAll<ArticleDto>('/admin/news'),
  })

  const data = q.data ?? []

  return (
    <>
      <PageHeader
        title="News"
        descriptionAsTooltip
        description="GET /admin/news."
        actions={
          <Link to="/news/new" className="btn-primary btn--with-icon">
            <Plus size={18} strokeWidth={2} aria-hidden />
            New article
          </Link>
        }
      />
      {!q.isLoading && !q.isError ? (
        <div className="catalog-page-toolbar">
          <ListViewModeSwitch value={mode} onChange={setMode} />
        </div>
      ) : null}
      {q.isLoading ? (
        <p className="muted">Loading…</p>
      ) : q.isError ? (
        <p className="login-error">{q.error.message}</p>
      ) : mode === 'cards' ? (
        <CatalogFilterGrid
          items={data}
          getKey={(r) => r.id}
          getSearchText={(r) =>
            [r.title, r.slug, r.category, r.author_name, r.status, r.updated_at]
              .filter(Boolean)
              .join(' ')
          }
          searchPlaceholder="Search articles…"
          renderCard={(a) => {
            const letter = (a.title?.trim().charAt(0) ?? '?').toUpperCase()
            return (
              <Link
                to="/news/$articleId"
                params={{ articleId: String(a.id) }}
                className="entity-thumb-card entity-thumb-card--news"
              >
                <div className="entity-thumb-card__media entity-thumb-card__media--news">
                  {a.featured_image_url ? (
                    <img
                      src={a.featured_image_url}
                      alt=""
                      className="entity-thumb-card__news-image"
                      loading="lazy"
                    />
                  ) : (
                    <span className="entity-thumb-media-placeholder" aria-hidden>
                      {letter}
                    </span>
                  )}
                </div>
                <div className="entity-thumb-card__body">
                  <h3 className="entity-thumb-card__title">{a.title}</h3>
                  <p className="entity-thumb-card__meta muted">
                    {a.category ?? '—'}
                    <br />
                    {a.author_name ?? '—'} ·{' '}
                    {String(a.updated_at).slice(0, 10)}
                  </p>
                </div>
                <div className="entity-thumb-card__footer">
                  <StatusBadge
                    status={
                      a.status as
                        | 'draft'
                        | 'scheduled'
                        | 'published'
                        | 'archived'
                    }
                  />
                </div>
              </Link>
            )
          }}
        />
      ) : (
        <EntityTable
          columns={columns}
          data={data}
          globalFilterPlaceholder="Search articles…"
          onRowClick={(row) =>
            void navigate({
              to: '/news/$articleId',
              params: { articleId: String(row.id) },
            })
          }
        />
      )}
    </>
  )
}
