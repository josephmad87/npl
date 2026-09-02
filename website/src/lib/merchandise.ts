export type MerchandiseProduct = {
  id: number
  name: string
  description: string | null
  price_text: string
  image_url: string
  image_url_2: string
  image_url_3: string
  sizes_text: string | null
  team_id: number | null
  team_ids: number[]
  status: string
  sort_order: number
  variants: MerchandiseProductVariant[]
}

export type MerchandiseProductVariant = {
  id: number
  product_id: number
  sku: string
  label: string
  size: string | null
  colour: string | null
  price_text: string
  price_minor: number | null
  currency: string
  stock_quantity: number | null
  allow_backorder: boolean
  status: 'active' | 'inactive'
  sort_order: number
}

export function sizeOptions(sizesText: string | null): string[] {
  return (sizesText ?? '')
    .split(',')
    .map((size) => size.trim())
    .filter(Boolean)
}

export function merchandiseImages(product: MerchandiseProduct): string[] {
  return [product.image_url, product.image_url_2, product.image_url_3]
    .map((url) => url?.trim())
    .filter((url): url is string => Boolean(url))
}

export function merchandiseExcerpt(description: string | null, limit = 150): string | null {
  const normalized = description?.replace(/\s+/g, ' ').trim() ?? ''
  if (!normalized) return null
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit).trimEnd()}…`
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function merchandiseProductSegment(product: Pick<MerchandiseProduct, 'id' | 'name'>): string {
  return `${slugify(product.name) || 'product'}-${product.id}`
}

export function merchandiseProductPath(product: Pick<MerchandiseProduct, 'id' | 'name'>): string {
  return `/merchandise/${merchandiseProductSegment(product)}`
}

export function merchandiseProductIdFromSegment(segment: string): number | null {
  const matched = segment.match(/(?:^|-)(\d+)$/)
  if (!matched) return null
  const id = Number(matched[1])
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
