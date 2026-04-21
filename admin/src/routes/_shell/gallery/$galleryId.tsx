import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Trash2, SquarePen } from 'lucide-react'
import { useState } from 'react'
import type { GalleryItemDto } from '@/lib/api-types'
import { adminDelete, adminListAll, adminPatch } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { DetailFields } from '@/components/DetailFields'
import { InlineEditForm } from '@/components/InlineEditForm'
import { MediaUrlField } from '@/components/MediaUrlField'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { parseDetailRouteSearch } from '@/lib/detail-route-search'
import { resolveAdminMediaUrl } from '@/lib/media-url'
export const Route = createFileRoute('/_shell/gallery/$galleryId')({
  validateSearch: parseDetailRouteSearch,
  component: GalleryDetailPage,
})

const TYPES = ['image', 'video'] as const

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
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [heroFailedFor, setHeroFailedFor] = useState<string | null>(null)

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
    if (isSaving) return
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
    setIsSaving(true)
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
    } finally {
      setIsSaving(false)
    }
  }

  const removeItem = async () => {
    if (isDeleting || !item) return
    const ok = globalThis.confirm(`Delete "${item.title}"? This cannot be undone.`)
    if (!ok) return
    setIsDeleting(true)
    setSaveError(null)
    try {
      await adminDelete(`/admin/gallery/${gid}`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'gallery'] })
      void navigate({ to: '/gallery' })
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Delete failed')
      setIsDeleting(false)
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
                disabled={isDeleting}
              >
                <SquarePen size={18} strokeWidth={2} aria-hidden />
                Edit item
              </button>
            ) : null}
            <button
              type="button"
              className="btn-ghost btn--with-icon"
              onClick={() => void removeItem()}
              disabled={isDeleting || isSaving}
            >
              <Trash2 size={18} strokeWidth={2} aria-hidden />
              {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      />
      {isEditing ? (
        <InlineEditForm
          error={saveError}
          isSaving={isSaving}
          savingLabel="Saving…"
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
                  disabled={isSaving}
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
                  disabled={isSaving}
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
                  accept="image/*,video/mp4,video/webm,video/quicktime,video/x-m4v,video/x-msvideo,video/x-matroska,video/mpeg,video/ogg,.jpg,.jpeg,.png,.webp,.gif,.avif,.svg,.bmp,.tif,.tiff,.heic,.heif,.mp4,.webm,.mov,.m4v,.avi,.mkv,.mpeg,.mpg,.ogv"
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
                  disabled={isSaving}
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
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml,image/bmp,image/tiff,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.avif,.svg,.bmp,.tif,.tiff,.heic,.heif"
                  value={merged.thumbnail_url ?? null}
                  onChange={(next) =>
                    setPatch((p) => ({ ...p, thumbnail_url: next }))
                  }
                  disabled={isSaving}
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
                  disabled={isSaving}
                />
              ),
            },
            {
              id: 'publish',
              label: 'Publish',
              control: (
                <label className="inline-check">
                  <input
                    id="publish"
                    type="checkbox"
                    checked={merged.status === 'published'}
                    onChange={(e) =>
                      setPatch((p) => ({
                        ...p,
                        status: e.target.checked ? 'published' : 'draft',
                      }))
                    }
                    disabled={isSaving}
                  />
                  <span>Published</span>
                </label>
              ),
            },
            {
              id: 'status',
              label: 'Status (read-only)',
              control: (
                <input
                  id="status"
                  className="inline-edit__control"
                  value={merged.status}
                  readOnly
                  aria-readonly
                  disabled
                />
              ),
            },
            {
              id: 'media-format-help',
              label: 'Supported formats',
              control: (
                <p className="muted" style={{ margin: 0 }}>
                  Images: JPG, JPEG, PNG, GIF, WebP, AVIF, SVG, BMP, TIFF, HEIC,
                  HEIF. Videos: MP4, WebM, MOV, M4V, AVI, MKV, MPEG, MPG, OGV.
                </p>
              ),
            },
          ]}
        />
      ) : (
        <>
          {resolveAdminMediaUrl(item.thumbnail_url ?? item.file_url) &&
          heroFailedFor !== resolveAdminMediaUrl(item.thumbnail_url ?? item.file_url) ? (
            <div className="article-view__hero">
              {item.media_type === 'video' ? (
                <video
                  src={resolveAdminMediaUrl(item.file_url) ?? undefined}
                  controls
                  preload="metadata"
                  className="article-view__hero-img"
                />
              ) : (
                <img
                  src={resolveAdminMediaUrl(item.thumbnail_url ?? item.file_url) ?? ''}
                  alt=""
                  className="article-view__hero-img"
                  onError={() =>
                    setHeroFailedFor(
                      resolveAdminMediaUrl(item.thumbnail_url ?? item.file_url),
                    )
                  }
                />
              )}
            </div>
          ) : null}
          <DetailFields
            items={[
              { label: 'Type', value: item.media_type },
              { label: 'Tags', value: (item.tags ?? []).join(', ') || '—' },
              {
                label: 'Media URL',
                value: item.file_url,
              },
              {
                label: 'Thumbnail URL',
                value: item.thumbnail_url ?? '—',
              },
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
        </>
      )}
      {saveError && !isEditing ? (
        <p className="login-error" style={{ marginTop: '0.75rem' }}>
          {saveError}
        </p>
      ) : null}
    </>
  )
}
