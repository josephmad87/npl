import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { TeamDto } from '@/lib/api-types'
import { adminPost } from '@/lib/admin-client'
import { CompetitionCategorySelect } from '@/components/CompetitionCategorySelect'
import { BackNavLink } from '@/components/BackNavLink'
import { InlineEditForm } from '@/components/InlineEditForm'
import { MediaUrlField } from '@/components/MediaUrlField'
import { PageHeader } from '@/components/PageHeader'

export const Route = createFileRoute('/_shell/teams/new')({
  component: NewTeamPage,
})

const STATUSES = ['active', 'inactive'] as const

function NewTeamPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [category, setCategory] = useState('mens')
  const [shortName, setShortName] = useState('')
  const [homeGround, setHomeGround] = useState('')
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('active')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const save = async () => {
    const n = name.trim()
    const s = slug.trim()
    const c = category.trim()
    if (!n) {
      setSaveError('Name is required.')
      return
    }
    if (!s) {
      setSaveError('Slug is required.')
      return
    }
    if (!c) {
      setSaveError('Category is required.')
      return
    }
    setSaveError(null)
    try {
      const created = await adminPost<TeamDto>('/admin/teams', {
        name: n,
        slug: s,
        category: c,
        short_name: shortName.trim() || null,
        home_ground: homeGround.trim() || null,
        status,
        logo_url: logoUrl?.trim() ?? null,
        cover_image_url: coverUrl?.trim() ?? null,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'teams'] })
      void navigate({
        to: '/teams/$teamId',
        params: { teamId: String(created.id) },
      })
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Create failed')
    }
  }

  return (
    <>
      <PageHeader
        title="New team"
        descriptionAsTooltip
        description="POST /admin/teams"
        actions={
          <BackNavLink to="/teams">Teams</BackNavLink>
        }
      />
      <InlineEditForm
        error={saveError}
        onCancel={() => void navigate({ to: '/teams' })}
        onSave={() => void save()}
        fields={[
          {
            id: 'name',
            label: 'Name',
            control: (
              <input
                id="name"
                className="inline-edit__control"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            ),
          },
          {
            id: 'slug',
            label: 'Slug',
            control: (
              <input
                id="slug"
                className="inline-edit__control"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            ),
          },
          {
            id: 'category',
            label: 'Category',
            control: (
              <CompetitionCategorySelect
                id="category"
                className="inline-edit__control"
                value={category}
                onChange={setCategory}
              />
            ),
          },
          {
            id: 'short_name',
            label: 'Short name',
            control: (
              <input
                id="short_name"
                className="inline-edit__control"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
              />
            ),
          },
          {
            id: 'home_ground',
            label: 'Home ground',
            control: (
              <input
                id="home_ground"
                className="inline-edit__control"
                value={homeGround}
                onChange={(e) => setHomeGround(e.target.value)}
              />
            ),
          },
          {
            id: 'logo_url',
            label: 'Team badge (image)',
            control: (
              <MediaUrlField
                id="logo_url"
                uploadKind="teams"
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                value={logoUrl}
                onChange={setLogoUrl}
              />
            ),
          },
          {
            id: 'cover_image_url',
            label: 'Cover / hero (image)',
            control: (
              <MediaUrlField
                id="cover_image_url"
                uploadKind="teams"
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                value={coverUrl}
                onChange={setCoverUrl}
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
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
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
