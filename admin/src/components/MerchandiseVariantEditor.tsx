import { Plus, Trash2 } from 'lucide-react'
import type { MerchandiseProductVariantDto } from '@/lib/api-types'

export type MerchandiseVariantDraft = Omit<
  MerchandiseProductVariantDto,
  'id' | 'product_id' | 'created_at' | 'updated_at'
>

const emptyMerchandiseVariant = (): MerchandiseVariantDraft => ({
  sku: '',
  label: '',
  size: null,
  colour: null,
  price_text: '',
  price_minor: null,
  currency: 'USD',
  stock_quantity: null,
  allow_backorder: false,
  status: 'active',
  sort_order: 0,
})

export function MerchandiseVariantEditor({
  value,
  onChange,
  disabled = false,
}: Readonly<{
  value: MerchandiseVariantDraft[]
  onChange: (value: MerchandiseVariantDraft[]) => void
  disabled?: boolean
}>) {
  const patch = (index: number, next: Partial<MerchandiseVariantDraft>) => {
    onChange(value.map((row, rowIndex) => (rowIndex === index ? { ...row, ...next } : row)))
  }

  return (
    <div className="merchandise-variant-editor">
      <p className="muted">
        Add a SKU for each size or colour customers can order. Leave empty when the product has no variants.
      </p>
      {value.map((row, index) => (
        <fieldset key={index} className="merchandise-variant-editor__row">
          <legend>Option {index + 1}</legend>
          <label><span>SKU *</span><input value={row.sku} onChange={(event) => patch(index, { sku: event.target.value })} disabled={disabled} /></label>
          <label><span>Label *</span><input value={row.label} onChange={(event) => patch(index, { label: event.target.value })} disabled={disabled} placeholder="Adult · Maroon · L" /></label>
          <label><span>Size</span><input value={row.size ?? ''} onChange={(event) => patch(index, { size: event.target.value || null })} disabled={disabled} /></label>
          <label><span>Colour</span><input value={row.colour ?? ''} onChange={(event) => patch(index, { colour: event.target.value || null })} disabled={disabled} /></label>
          <label><span>Price</span><input value={row.price_text} onChange={(event) => patch(index, { price_text: event.target.value })} disabled={disabled} placeholder="USD 15" /></label>
          <label><span>Stock</span><input type="number" min="0" value={row.stock_quantity ?? ''} onChange={(event) => patch(index, { stock_quantity: event.target.value === '' ? null : Number(event.target.value) })} disabled={disabled} /></label>
          <label><span>Status</span><select value={row.status} onChange={(event) => patch(index, { status: event.target.value as 'active' | 'inactive' })} disabled={disabled}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <label className="merchandise-variant-editor__check"><input type="checkbox" checked={row.allow_backorder} onChange={(event) => patch(index, { allow_backorder: event.target.checked })} disabled={disabled} /><span>Allow backorders</span></label>
          <button type="button" className="btn-danger btn--with-icon" onClick={() => onChange(value.filter((_, rowIndex) => rowIndex !== index))} disabled={disabled}>
            <Trash2 size={17} aria-hidden /> Remove
          </button>
        </fieldset>
      ))}
      <button type="button" className="btn-ghost btn--with-icon" onClick={() => onChange([...value, emptyMerchandiseVariant()])} disabled={disabled}>
        <Plus size={17} aria-hidden /> Add product option
      </button>
    </div>
  )
}
