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
const STATUSES = ['draft', 'published'] as const

function NewGalleryItemPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<(typeof TYPES)[number]>('image')
  const [status, setStatus] =
    useState<(typeof STATUSES)[number]>('draft')
  const [tagsText, setTagsText] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  const save = async () => {
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
                accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.jpg,.jpeg,.png,.webp,.gif"
                value={fileUrl}
                onChange={setFileUrl}
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
                value={thumbnailUrl}
                onChange={setThumbnailUrl}
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
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as (typeof STATUSES)[number])
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
    </>
  )
}
