// Keep the Product offers in the edge-rendered HTML and browser metadata identical.
function offerPrice(variant, fallbackPriceText) {
  const minor = variant?.price_minor
  if (Number.isSafeInteger(minor)) {
    return minor > 0 ? (minor / 100).toFixed(2) : null
  }

  const priceText = (variant?.price_text || fallbackPriceText || '').trim()
  const match = priceText.match(/^(?:(?:USD|US\$)\s*)?\$?\s*(\d+(?:\.\d{1,2})?)\s*(?:USD)?$/i)
  if (!match) return null
  const price = Number(match[1])
  return Number.isFinite(price) && price > 0 ? price.toFixed(2) : null
}

function availability(variant) {
  if (variant?.stock_quantity == null) return undefined
  if (variant.stock_quantity > 0) return 'https://schema.org/InStock'
  return variant.allow_backorder
    ? 'https://schema.org/BackOrder'
    : 'https://schema.org/OutOfStock'
}

export function productOffers(product, canonicalUrl) {
  const variants = product.variants?.filter((variant) => variant.status === 'active') ?? []
  const candidates = variants.length ? variants : [null]
  return candidates.flatMap((variant) => {
    const price = offerPrice(variant, product.price_text)
    if (!price) return []
    const currency = variant?.currency || 'USD'
    if (!/^[A-Z]{3}$/.test(currency)) return []
    const stockAvailability = availability(variant)
    return [{
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: currency,
      price,
      ...(variant?.label ? { name: variant.label } : {}),
      ...(stockAvailability ? { availability: stockAvailability } : {}),
    }]
  })
}
