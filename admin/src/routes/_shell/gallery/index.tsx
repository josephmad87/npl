import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import type { GalleryItemDto } from '@/lib/api-types'
import { adminListAll } from '@/lib/admin-client'
import { CatalogFilterGrid } from '@/components/CatalogFilterGrid'
import { EntityTable } from '@/components/EntityTable'
import { ListViewModeSwitch } from '@/components/ListViewModeSwitch'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { useListViewMode } from '@/hooks/useListViewMode'
import { resolveAdminMediaUrl } from '@/lib/media-url'

export const Route = createFileRoute('/_shell/gallery/')({
  component: GalleryPage,
})

type GalleryRow = GalleryItemDto & { tags_display: string }

type GalleryCardMediaProps = {
  mediaUrl: string | null
  mediaType: string
}

function GalleryCardMedia({ mediaUrl, mediaType }: GalleryCardMediaProps) {
  const resolvedUrl = resolveAdminMediaUrl(mediaUrl)
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
    resolvedUrl ? 'loading' : 'error',
  )

  useEffect(() => {
    if (!resolvedUrl) return
    let active = true
    const img = new Image()
    img.onload = () => {
      if (active) setStatus('loaded')
    }
    img.onerror = () => {
      if (active) setStatus('error')
    }
    img.src = resolvedUrl
    return () => {
      active = false
    }
  }, [resolvedUrl])

  if (!resolvedUrl || status !== 'loaded') {
    return (
      <span
        className="entity-thumb-media-placeholder entity-thumb-media-placeholder--wide"
        aria-hidden
      >
        {mediaType.toUpperCase()}
      </span>
    )
  }

  return (
    <img
      src={resolvedUrl}
      alt=""
      className="entity-thumb-card__gallery-image"
      loading="lazy"
    />
  )
}

function GalleryPage() {
  const [mode, setMode] = useListViewMode('gallery')
  const navigate = useNavigate()
  const q = useQuery({
    queryKey: ['admin', 'gallery'],
    queryFn: () => adminListAll<GalleryItemDto>('/admin/gallery'),
  })

  const rows = useMemo((): GalleryRow[] => {
    return (q.data ?? []).map((g) => ({
      ...g,
      tags_display: (g.tags ?? []).join(', ') || '—',
    }))
  }, [q.data])

  const columns: ColumnDef<GalleryRow, unknown>[] = [
    { accessorKey: 'title', header: 'Title' },
    { accessorKey: 'media_type', header: 'Type' },
    { accessorKey: 'tags_display', header: 'Tags' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => (
        <StatusBadge status={getValue() as 'draft' | 'published'} />
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ getValue }) => String(getValue()).slice(0, 10),
    },
  ]

  return (
    <>
      <PageHeader
        title="Gallery"
        descriptionAsTooltip
        description="GET /admin/gallery."
        actions={
          <Link to="/gallery/new" className="btn-primary btn--with-icon">
            <Plus size={18} strokeWidth={2} aria-hidden />
            Add item
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
          items={rows}
          getKey={(r) => r.id}
          getSearchText={(r) =>
            [r.title, r.media_type, r.tags_display, r.status, r.created_at]
              .filter(Boolean)
              .join(' ')
          }
          searchPlaceholder="Search gallery…"
          renderCard={(g) => {
            const mediaUrl =
              g.thumbnail_url ??
              (g.media_type?.toLowerCase() === 'image' ? g.file_url : null)

            return (
              <Link
                to="/gallery/$galleryId"
                params={{ galleryId: String(g.id) }}
                className="entity-thumb-card entity-thumb-card--gallery"
              >
                <div className="entity-thumb-card__media entity-thumb-card__media--gallery">
                  <GalleryCardMedia
                    key={mediaUrl ?? 'no-media'}
                    mediaUrl={mediaUrl}
                    mediaType={g.media_type ?? 'MEDIA'}
                  />
                </div>
                <div className="entity-thumb-card__body">
                  <h3 className="entity-thumb-card__title">{g.title}</h3>
                  <p className="entity-thumb-card__meta muted">
                    {g.tags_display}
                    <br />
                    {String(g.created_at).slice(0, 10)}
                  </p>
                </div>
                <div className="entity-thumb-card__footer">
                  <StatusBadge status={g.status as 'draft' | 'published'} />
                </div>
              </Link>
            )
          }}
        />
      ) : (
        <EntityTable
          columns={columns}
          data={rows}
          globalFilterPlaceholder="Search gallery…"
          onRowClick={(row) =>
            void navigate({
              to: '/gallery/$galleryId',
              params: { galleryId: String(row.id) },
            })
          }
        />
      )}
    </>
  )
}
