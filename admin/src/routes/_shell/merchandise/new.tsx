import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { MerchandiseProductDto } from '@/lib/api-types'
import { adminListAll, adminPost } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { InlineEditForm } from '@/components/InlineEditForm'
import { MediaUrlField } from '@/components/MediaUrlField'
import { PageHeader } from '@/components/PageHeader'

const MERCHANDISE_CATEGORIES = ['Shirts', 'Bottoms', 'Caps', 'Other']
const MERCHANDISE_AUDIENCES = ['Kids', 'Adults', 'Ladies', 'Mens', 'Unisex']

type MerchandiseTeamOption = {
  id: number
  name: string
}

export const Route = createFileRoute('/_shell/merchandise/new')({
  component: NewMerchandisePage,
})

function NewMerchandisePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
    const teamsQ = useQuery({
    queryKey: ['admin', 'teams', 'merchandise-options'],
    queryFn: () => adminListAll<MerchandiseTeamOption>('/admin/teams'),
    retry: 1,
  })
  const [category, setCategory] = useState('Shirts')
  const [audience, setAudience] = useState('Unisex')
  const [teamId, setTeamId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priceText, setPriceText] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [sizesText, setSizesText] = ('')
  const [status, setStatus] = useState('active')
  const [sortOrder, setSortOrder] = useState('0')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const save = async () => {
    if (isSaving) return

    const n = name.trim()

    if (!n) {
      setSaveError('Name is required.')
      return
    }

    setSaveError(null)
    setIsSaving(true)

    try {

      await adminPost<MerchandiseProductDto>(
  '/admin/merchandise',
  {
    name: n,
    description: description.trim() || null,
    price_text: priceText.trim(),
    image_url: (imageUrl ?? '').trim(),
    sizes_text: sizesText.trim() || null,
      category,
      audience,
      team_id: teamId ? Number(teamId) : null,
      status,
      sort_order: Number(sortOrder) || 0,
  },
)

await queryClient.invalidateQueries({
  queryKey: ['admin', 'merchandise'],
})

void navigate({
  to: '/merchandise',
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
  title="New merchandise product"
  description="Add an item that can be shown on the public merchandise page."
  actions={<BackNavLink to="/merchandise">Merchandise</BackNavLink>}
/>

    <InlineEditForm
        error={saveError}
        isSaving={isSaving}
        onCancel={() => void navigate({ to: '/merchandise' })}
        onSave={() => void save()}
        fields={[
          {
            id: 'name',
            label: 'Name',
            control: (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSaving}
                maxLength={255}
                autoComplete="off"
              />
            ),
          },
          {
            id: 'description',
            label: 'Description',
            control: (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSaving}
                rows={4}
              />
            ),
          },
          {
            id: 'price_text',
            label: 'Price text',
            control: (
              <input
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                disabled={isSaving}
                maxLength={64}
                placeholder="e.g. USD 15"
              />
            ),
          },
          {
            id: 'image_url',
            label: 'Image',
            control: (
              <MediaUrlField
                id="image_url"
                value={imageUrl}
                onChange={setImageUrl}
                disabled={isSaving}
                uploadKind="merchandise"
                accept="image/*"
              />
            ),
          },
          {
            id: 'sizes_text',
            label: 'Sizes',
            control: (
              <input
                value={sizesText}
                onChange={(e) => setSizesText(e.target.value)}
                disabled={isSaving}
                maxLength={255}
                placeholder="e.g. S, M, L, XL"
              />
            ),
          },
          {
            id: 'category',
            label: 'Category',
            control: (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isSaving}
              >
                {MERCHANDISE_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ),
          },
          {
            id: 'audience',
            label: 'Audience',
            control: (
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                disabled={isSaving}
              >
                {MERCHANDISE_AUDIENCES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ),
          },
          {
            id: 'team_id',
            label: 'Team optional',
            control: (
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                disabled={isSaving || teamsQ.isLoading}
              >
                <option value="">No team / general merchandise</option>
                {(teamsQ.data ?? []).map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            ),
          },

          
          {
            id: 'status',
            label: 'Status',
            control: (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={isSaving}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            ),
          },
          {
            id: 'sort_order',
            label: 'Sort order',
            control: (
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                disabled={isSaving}
              />
            ),
          },
        ]}
      />
    </>
  )
}
