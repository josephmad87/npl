import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { LeagueDto } from '@/lib/api-types'
import { adminPost } from '@/lib/admin-client'
import type { CompetitionCategoryValue } from '@/lib/competitionCategories'
import { CompetitionCategorySelect } from '@/components/CompetitionCategorySelect'
import { BackNavLink } from '@/components/BackNavLink'
import { InlineEditForm } from '@/components/InlineEditForm'
import { MediaUrlField } from '@/components/MediaUrlField'
import { PageHeader } from '@/components/PageHeader'

export const Route = createFileRoute('/_shell/leagues/new')({
  component: NewLeaguePage,
})

function NewLeaguePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [category, setCategory] = useState<CompetitionCategoryValue>('mens')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
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
      const created = await adminPost<LeagueDto>('/admin/leagues', {
        name: n,
        slug: s,
        category: c,
        description: description.trim() || null,
        logo_url: logoUrl?.trim() ?? null,
        banner_url: bannerUrl?.trim() ?? null,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'leagues'] })
      void navigate({
        to: '/leagues/$leagueId',
        params: { leagueId: String(created.id) },
      })
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Create failed')
    }
  }

  return (
    <>
      <PageHeader
        title="New league"
        descriptionAsTooltip
        description="POST /admin/leagues — create the competition once, then add seasons."
        actions={
          <BackNavLink to="/leagues">Leagues</BackNavLink>
        }
      />
      <InlineEditForm
        error={saveError}
        onCancel={() => void navigate({ to: '/leagues' })}
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
            id: 'description',
            label: 'Description',
            control: (
              <textarea
                id="description"
                className="inline-edit__control"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            ),
          },
          {
            id: 'logo_url',
            label: 'Logo (image)',
            control: (
              <MediaUrlField
                id="logo_url"
                uploadKind="leagues"
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                value={logoUrl}
                onChange={setLogoUrl}
              />
            ),
          },
          {
            id: 'banner_url',
            label: 'Banner (image)',
            control: (
              <MediaUrlField
                id="banner_url"
                uploadKind="leagues"
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                value={bannerUrl}
                onChange={setBannerUrl}
              />
            ),
          },
        ]}
      />
    </>
  )
}
