import type { MerchandiseProduct } from './merchandise'

export type ProductOffer = {
  '@type': 'Offer'
  url: string
  priceCurrency: string
  price: string
  name?: string
  availability?: string
}

export function productOffers(product: MerchandiseProduct, canonicalUrl: string): ProductOffer[]
