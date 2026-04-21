import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { GalleryItemDto } from '@/lib/api-types'
import { adminPost } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { InlineEditForm } from '@/components/InlineEditForm'
import { MediaUrlField } from '@/components/MediaUrlField'
import { PageHeader } from '@/components/PageHeader'

export const Route = createFileRoute('/_shell/gallery/new')({
  component: NewGalleryItemPage,
})

const TYPES = ['image', 'video'] as const
type GalleryStatus = 'draft' | 'published'

function NewGalleryItemPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<(typeof TYPES)[number]>('image')
  const [status, setStatus] =
    useState<GalleryStatus>('draft')
  const [tagsText, setTagsText] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const save = async () => {
    if (isSaving) return
    const t = title.trim()
    const u = fileUrl?.trim() ?? ''
    if (!t) {
      setSaveError('Title is required.')
      return
    }
    if (!u) {
      setSaveError('Upload a file or enter a media URL.')
      return
    }
    const tags = tagsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    setSaveError(null)
    setIsSaving(true)
    try {
      const created = await adminPost<GalleryItemDto>('/admin/gallery', {
        title: t,
        file_url: u,
        thumbnail_url: thumbnailUrl?.trim() ?? null,
        media_type: mediaType,
        status,
        tags: tags.length > 0 ? tags : null,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'gallery'] })
      void navigate({
        to: '/gallery/$galleryId',
        params: { galleryId: String(created.id) },
      })
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="New gallery item"
        descriptionAsTooltip
        description="POST /admin/gallery"
        actions={
          <BackNavLink to="/gallery">Gallery</BackNavLink>
        }
      />
      <InlineEditForm
        error={saveError}
        isSaving={isSaving}
        saveLabel="Create item"
        savingLabel="Creating…"
        onCancel={() => void navigate({ to: '/gallery' })}
        onSave={() => void save()}
        fields={[
          {
            id: 'title',
            label: 'Title',
            control: (
              <input
                id="title"
                className="inline-edit__control"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSaving}
              />
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
                value={fileUrl}
                onChange={setFileUrl}
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
                value={thumbnailUrl}
                onChange={setThumbnailUrl}
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
                value={mediaType}
                onChange={(e) =>
                  setMediaType(e.target.value as (typeof TYPES)[number])
                }
                disabled={isSaving}
              >
                {TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {ty}
                  </option>
                ))}
              </select>
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
                  checked={status === 'published'}
                  onChange={(e) =>
                    setStatus(e.target.checked ? 'published' : 'draft')
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
                value={status}
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
    </>
  )
}
