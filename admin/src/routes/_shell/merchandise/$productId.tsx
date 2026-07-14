import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import type { MerchandiseProductDto } from '@/lib/api-types'
import { adminGet, adminListAll, adminPatch } from '@/lib/admin-client'
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

export const Route = createFileRoute('/_shell/merchandise/$productId')({
  component: EditMerchandisePage,
})

function EditMerchandisePage() {
  const { productId } = useParams({ from: '/_shell/merchandise/$productId' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const teamsQ = useQuery({
    queryKey: ['admin', 'teams', 'merchandise-options'],
    queryFn: () => adminListAll<MerchandiseTeamOption>('/admin/teams'),
    retry: 1,
  })
  
  const productQ = useQuery({
    queryKey: ['admin', 'merchandise', productId],
    queryFn: () =>
      adminGet<MerchandiseProductDto>(`/admin/merchandise/${productId}`),
    enabled: Boolean(productId),
    retry: 1,
  })

  const product = productQ.data

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priceText, setPriceText] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageUrl2, setImageUrl2] = useState<string | null>(null)
  const [sizesText, setSizesText] = useState('')
  const [status, setStatus] = useState('active')
  const [sortOrder, setSortOrder] = useState('0')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [category, setCategory] = useState('Shirts')
  const [audience, setAudience] = useState('Unisex')
  const [teamId, setTeamId] = useState('')
  
 useEffect(() => {
  if (!product) return

  setName(product.name)
  setDescription(product.description ?? '')
  setPriceText(product.price_text)
  setImageUrl(product.image_url || null)
  setImageUrl2(product.image_url_2 || null)
  setSizesText(product.sizes_text ?? '')
  setCategory(product.category || 'Other')
  setAudience(product.audience || 'Unisex')
  setTeamId(product.team_id ? String(product.team_id) : '')
  setStatus(product.status)
  setSortOrder(String(product.sort_order))
}, [product])

  const save = async () => {
    if (isSaving || !product) return

    const n = name.trim()

    if (!n) {
      setSaveError('Name is required.')
      return
    }

    setSaveError(null)
    setIsSaving(true)

    try {
      const updated = await adminPatch<MerchandiseProductDto>(
        `/admin/merchandise/${product.id}`,
        {
          name: n,
          description: description.trim() || null,
          price_text: priceText.trim(),
          image_url: (imageUrl ?? '').trim(),
          image_url_2: (imageUrl2 ?? '').trim(),
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

      await queryClient.invalidateQueries({
        queryKey: ['admin', 'merchandise', productId],
      })

      setName(updated.name)
      setDescription(updated.description ?? '')
      setPriceText(updated.price_text)
      setImageUrl(updated.image_url || null)
      setImageUrl2(updated.image_url_2 || null)
      setSizesText(updated.sizes_text ?? '')
      setStatus(updated.status)
      setCategory(updated.category || 'Other')
      setAudience(updated.audience || 'Unisex')
      setTeamId(updated.team_id ? String(updated.team_id) : '')
      setSortOrder(String(updated.sort_order))
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

 if (productQ.isLoading) {
  return <p className="muted">Loading merchandise product…</p>
}

  if (productQ.isError || !product) {
  return <p className="form-error">Could not load merchandise product.</p>
}

  return (
    <>
     <PageHeader
          title={product.name}
          description="Edit merchandise product details."
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
  id: 'image_url_2',
  label: 'Second image optional',
  control: (
    <MediaUrlField
      id="image_url_2"
      value={imageUrl2}
      onChange={setImageUrl2}
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
