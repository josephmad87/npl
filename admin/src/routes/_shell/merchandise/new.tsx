import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { MerchandiseProductDto } from '@/lib/api-types'
import { adminListAll, adminPost } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { InlineEditForm } from '@/components/InlineEditForm'
import { MediaUrlField } from '@/components/MediaUrlField'
import { PageHeader } from '@/components/PageHeader'
import {
  MerchandiseVariantEditor,
  type MerchandiseVariantDraft,
} from '@/components/MerchandiseVariantEditor'

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
  const [teamIds, setTeamIds] = useState<number[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priceText, setPriceText] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageUrl2, setImageUrl2] = useState<string | null>(null)
  const [imageUrl3, setImageUrl3] = useState<string | null>(null)
  const [sizesText, setSizesText] = useState('')
  const [status, setStatus] = useState('active')
  const [sortOrder, setSortOrder] = useState('0')
  const [variants, setVariants] = useState<MerchandiseVariantDraft[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const toggleTeam = (teamId: number) => {
    setTeamIds((current) =>
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId],
    )
  }

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
    image_url_2: (imageUrl2 ?? '').trim(),
    image_url_3: (imageUrl3 ?? '').trim(),
    sizes_text: sizesText.trim() || null,
      category,
      audience,
      team_ids: teamIds,
      status,
      sort_order: Number(sortOrder) || 0,
      variants,
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
      accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
    />
  ),
},
{
  id: 'image_url_2',
  label: 'Second image optional',
  control: (
    <MediaUrlField
      id="image_url_2"
      value={imageUrl2}
      onChange={setImageUrl2}
      disabled={isSaving}
      uploadKind="merchandise"
      accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
    />
  ),
},
{
  id: 'image_url_3',
  label: 'Third image optional',
  control: (
    <MediaUrlField
      id="image_url_3"
      value={imageUrl3}
      onChange={setImageUrl3}
      disabled={isSaving}
      uploadKind="merchandise"
      accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
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
            id: 'variants',
            label: 'Product options and stock',
            control: (
              <MerchandiseVariantEditor value={variants} onChange={setVariants} disabled={isSaving} />
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
            id: 'team_ids',
            label: 'Teams optional',
            control: (
              <div id="team_ids" className="merchandise-team-selector">
                <p className="merchandise-team-selector__hint">
                  Leave all unchecked for general merchandise.
                </p>
                {(teamsQ.data ?? []).map((team) => (
                  <label key={team.id} className="merchandise-team-selector__option">
                    <input
                      type="checkbox"
                      checked={teamIds.includes(team.id)}
                      onChange={() => toggleTeam(team.id)}
                      disabled={isSaving || teamsQ.isLoading}
                    />
                    <span>{team.name}</span>
                  </label>
                ))}
              </div>
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
