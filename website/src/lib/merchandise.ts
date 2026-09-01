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
