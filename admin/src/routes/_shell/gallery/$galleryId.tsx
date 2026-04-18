import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SquarePen } from 'lucide-react'
import { useState } from 'react'
import type { GalleryItemDto } from '@/lib/api-types'
import { adminListAll, adminPatch } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { DetailFields } from '@/components/DetailFields'
import { InlineEditForm } from '@/components/InlineEditForm'
import { MediaUrlField } from '@/components/MediaUrlField'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { parseDetailRouteSearch } from '@/lib/detail-route-search'

export const Route = createFileRoute('/_shell/gallery/$galleryId')({
  validateSearch: parseDetailRouteSearch,
  component: GalleryDetailPage,
})

const TYPES = ['image', 'video'] as const
const STATUSES = ['draft', 'published'] as const

function GalleryDetailPage() {
  const { galleryId } = Route.useParams()
  const gid = Number(galleryId)
  const { mode } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const listQ = useQuery({
    queryKey: ['admin', 'gallery'],
    queryFn: () => adminListAll<GalleryItemDto>('/admin/gallery'),
  })
  const item = listQ.data?.find((g) => g.id === gid)
  const isEditing = mode === 'edit'
  const [patch, setPatch] = useState<Partial<GalleryItemDto>>({})
  const [tagsText, setTagsText] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  const merged: GalleryItemDto | null =
    item ? { ...item, ...patch } : null

  const goView = () => {
    if (!item) return
    setPatch({})
    setTagsText('')
    setSaveError(null)
    void navigate({
      to: '/gallery/$galleryId',
      params: { galleryId: String(item.id) },
      search: {},
    })
  }

  const beginEdit = () => {
    if (!item) return
    setPatch({})
    setTagsText((item.tags ?? []).join(', '))
    setSaveError(null)
    void navigate({
      to: '/gallery/$galleryId',
      params: { galleryId: String(item.id) },
      search: { mode: 'edit' },
    })
  }

  const save = async () => {
    if (!merged || !item || !Number.isFinite(gid)) return
    const title = merged.title.trim()
    if (!title) {
      setSaveError('Title is required.')
      return
    }
    const tags = tagsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      await adminPatch<GalleryItemDto>(`/admin/gallery/${gid}`, {
        title: merged.title,
        media_type: merged.media_type,
        status: merged.status,
        tags: tags.length > 0 ? tags : null,
        file_url: merged.file_url,
        thumbnail_url: merged.thumbnail_url ?? null,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'gallery'] })
      goView()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  if (listQ.isLoading) {
    return <p className="muted">Loading…</p>
  }
  if (listQ.isError) {
    return <p className="login-error">{listQ.error.message}</p>
  }
  if (!item || !merged || !Number.isFinite(gid)) {
    return (
      <>
        <PageHeader title="Gallery item not found" />
        <BackNavLink to="/gallery">Back to gallery</BackNavLink>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={isEditing ? merged.title : item.title}
        description={`ID ${item.id}`}
        actions={
          <>
            <BackNavLink to="/gallery">Gallery</BackNavLink>
            {!isEditing ? (
              <button
                type="button"
                className="btn-primary btn--with-icon"
                onClick={beginEdit}
              >
                <SquarePen size={18} strokeWidth={2} aria-hidden />
                Edit item
              </button>
            ) : null}
          </>
        }
      />
      {isEditing ? (
        <InlineEditForm
          error={saveError}
          onCancel={goView}
          onSave={() => void save()}
          fields={[
            {
              id: 'title',
              label: 'Title',
              control: (
                <input
                  id="title"
                  className="inline-edit__control"
                  value={merged.title}
                  onChange={(e) =>
                    setPatch((p) => ({ ...p, title: e.target.value }))
                  }
                />
              ),
            },
            {
              id: 'media_type',
              label: 'Media type',
              control: (
                <select
                  id="media_type"
                  className="inline-edit__control"
                  value={merged.media_type}
                  onChange={(e) =>
                    setPatch((p) => ({ ...p, media_type: e.target.value }))
                  }
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ),
            },
            {
              id: 'file_url',
              label: 'Media file (image or video)',
              control: (
                <MediaUrlField
                  id="file_url"
                  uploadKind="gallery"
                  accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.jpg,.jpeg,.png,.webp,.gif"
                  value={merged.file_url}
                  onChange={(next) =>
                    setPatch((p) => ({
                      ...p,
                      file_url:
                        next != null && next.length > 0
                          ? next
                          : (p.file_url ?? item.file_url),
                    }))
                  }
                />
              ),
            },
            {
              id: 'thumbnail_url',
              label: 'Thumbnail (image, optional)',
              control: (
                <MediaUrlField
                  id="thumbnail_url"
                  uploadKind="gallery"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  value={merged.thumbnail_url ?? null}
                  onChange={(next) =>
                    setPatch((p) => ({ ...p, thumbnail_url: next }))
                  }
                />
              ),
            },
            {
              id: 'tags',
              label: 'Tags (comma-separated)',
              control: (
                <input
                  id="tags"
                  className="inline-edit__control"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                />
              ),
            },
            {
              id: 'status',
              label: 'Status',
              control: (
                <select
                  id="status"
                  className="inline-edit__control"
                  value={merged.status}
                  onChange={(e) =>
                    setPatch((p) => ({ ...p, status: e.target.value }))
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ),
            },
          ]}
        />
      ) : (
        <DetailFields
          items={[
            { label: 'Type', value: item.media_type },
            { label: 'Tags', value: (item.tags ?? []).join(', ') || '—' },
            {
              label: 'Created',
              value: String(item.created_at).slice(0, 19),
            },
            {
              label: 'Status',
              value: (
                <StatusBadge status={item.status as 'draft' | 'published'} />
              ),
            },
          ]}
        />
      )}
    </>
  )
}
