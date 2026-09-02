import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import type { MerchandiseProductDto } from '@/lib/api-types'
import { adminDelete, adminGet, adminListAll, adminPatch } from '@/lib/admin-client'
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
  const [imageUrl3, setImageUrl3] = useState<string | null>(null)
  const [sizesText, setSizesText] = useState('')
  const [status, setStatus] = useState('active')
  const [sortOrder, setSortOrder] = useState('0')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [category, setCategory] = useState('Shirts')
  const [audience, setAudience] = useState('Unisex')
  const [teamIds, setTeamIds] = useState<number[]>([])
  const [variants, setVariants] = useState<MerchandiseVariantDraft[]>([])
  
 useEffect(() => {
  if (!product) return

  setName(product.name)
  setDescription(product.description ?? '')
  setPriceText(product.price_text)
  setImageUrl(product.image_url || null)
  setImageUrl2(product.image_url_2 || null)
  setImageUrl3(product.image_url_3 || null)
  setSizesText(product.sizes_text ?? '')
  setCategory(product.category || 'Other')
  setAudience(product.audience || 'Unisex')
  setTeamIds(
    product.team_ids?.length > 0
      ? product.team_ids
      : product.team_id
        ? [product.team_id]
        : [],
  )
  setStatus(product.status)
  setSortOrder(String(product.sort_order))
  setVariants((product.variants ?? []).map(({ sku, label, size, colour, price_text, price_minor, currency, stock_quantity, allow_backorder, status, sort_order }) => ({
    sku,
    label,
    size,
    colour,
    price_text,
    price_minor,
    currency,
    stock_quantity,
    allow_backorder,
    status,
    sort_order,
  })))
}, [product])

  const toggleTeam = (teamId: number) => {
    setTeamIds((current) =>
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId],
    )
  }

  const removeProduct = async () => {
    if (!product || isDeleting) return
    const confirmed = globalThis.confirm(
      `Delete "${product.name}"? Existing order records will be kept, but this product cannot be restored.`,
    )
    if (!confirmed) return
    setIsDeleting(true)
    setSaveError(null)
    try {
      await adminDelete(`/admin/merchandise/${product.id}`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'merchandise'] })
      void navigate({ to: '/merchandise' })
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Delete failed')
      setIsDeleting(false)
    }
  }

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

      await queryClient.invalidateQueries({
        queryKey: ['admin', 'merchandise', productId],
      })

      setName(updated.name)
      setDescription(updated.description ?? '')
      setPriceText(updated.price_text)
      setImageUrl(updated.image_url || null)
      setImageUrl2(updated.image_url_2 || null)
      setImageUrl3(updated.image_url_3 || null)
      setSizesText(updated.sizes_text ?? '')
      setStatus(updated.status)
      setCategory(updated.category || 'Other')
      setAudience(updated.audience || 'Unisex')
      setTeamIds(
        updated.team_ids?.length > 0
          ? updated.team_ids
          : updated.team_id
            ? [updated.team_id]
            : [],
      )
      setSortOrder(String(updated.sort_order))
      setVariants((updated.variants ?? []).map(({ sku, label, size, colour, price_text, price_minor, currency, stock_quantity, allow_backorder, status, sort_order }) => ({
        sku,
        label,
        size,
        colour,
        price_text,
        price_minor,
        currency,
        stock_quantity,
        allow_backorder,
        status,
        sort_order,
      })))
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
          actions={
            <>
              <BackNavLink to="/merchandise">Merchandise</BackNavLink>
              <button type="button" className="btn-danger btn--with-icon" onClick={() => void removeProduct()} disabled={isSaving || isDeleting}>
                <Trash2 size={18} strokeWidth={2} aria-hidden />
                {isDeleting ? 'Deleting…' : 'Delete product'}
              </button>
            </>
          }
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
