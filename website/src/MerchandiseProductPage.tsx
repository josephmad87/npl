import { Link, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import nplLogoUrl from './assets/logo.png'
import { MerchandiseQuickOrderModal } from './components/MerchandiseQuickOrderModal'
import {
  merchandiseImages,
  merchandiseProductIdFromSegment,
  type MerchandiseProduct,
} from './lib/merchandise'
import { fetchJson, resolveMediaUrl } from './lib/publicApi'

export default function MerchandiseProductPage() {
  const { productId } = useParams({ from: '/merchandise/$productId' })
  const numericProductId = merchandiseProductIdFromSegment(productId)
  const productQ = useQuery({
    queryKey: ['public-merchandise-product', numericProductId],
    queryFn: () => fetchJson<MerchandiseProduct>(`/public/merchandise/${numericProductId}`),
    enabled: numericProductId !== null,
    retry: 1,
  })
  const product = productQ.data
  const images = useMemo(() => (product ? merchandiseImages(product) : []), [product])
  const [activeImage, setActiveImage] = useState(0)
  const [isOrdering, setIsOrdering] = useState(
    () => window.location.hash === '#order',
  )

  useEffect(() => {
    if (!product) return
    const previousTitle = document.title
    const description = product.description?.replace(/\s+/g, ' ').trim()
    document.title = `${product.name} | NPL Zimbabwe`

    let descriptionTag = document.querySelector('meta[name="description"]')
    const createdDescriptionTag = !descriptionTag
    if (!descriptionTag) {
      descriptionTag = document.createElement('meta')
      descriptionTag.setAttribute('name', 'description')
      document.head.append(descriptionTag)
    }
    const previousDescription = descriptionTag.getAttribute('content')
    descriptionTag.setAttribute(
      'content',
      description?.slice(0, 160) || `Buy ${product.name} from NPL Zimbabwe.`,
    )

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    const createdCanonical = !canonical
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.append(canonical)
    }
    const previousCanonical = canonical.href
    canonical.href = `${window.location.origin}${window.location.pathname}`

    return () => {
      document.title = previousTitle
      if (createdDescriptionTag) descriptionTag?.remove()
      else descriptionTag?.setAttribute('content', previousDescription ?? '')
      if (createdCanonical) canonical?.remove()
      else if (canonical) canonical.href = previousCanonical
    }
  }, [product])

  if (productQ.isLoading) return <main className="container"><p className="muted">Loading product…</p></main>
  if (productQ.isError || !product) return <main className="container"><p className="form-error">This product is no longer available.</p><Link to="/merchandise" search={{ team_id: null }}>Back to merchandise</Link></main>

  const activeImageUrl = images[activeImage] ?? images[0] ?? null
  return (
    <main className="container">
      <section className="merchandise-product-page">
        <Link to="/merchandise" search={{ team_id: null }} className="merchandise-product-page__back">← Back to merchandise</Link>
        <div className="merchandise-product-page__layout">
          <div className="merchandise-product-page__gallery">
            <div className="merchandise-product-page__main-image">
              <img src={activeImageUrl ? resolveMediaUrl(activeImageUrl) ?? nplLogoUrl : nplLogoUrl} alt={product.name} />
            </div>
            {images.length > 1 ? (
              <div className="merchandise-product-page__thumbnails" aria-label="Product images">
                {images.map((image, index) => (
                  <button type="button" key={image} className={index === activeImage ? 'is-active' : ''} onClick={() => setActiveImage(index)} aria-label={`Show image ${index + 1}`}>
                    <img src={resolveMediaUrl(image) ?? nplLogoUrl} alt="" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="merchandise-product-page__details">
            <h1>{product.name}</h1>
            {product.price_text ? <p className="merchandise-product-page__price">{product.price_text}</p> : null}
            {product.description ? <p className="merchandise-product-page__description">{product.description}</p> : null}
            {product.sizes_text ? <p><strong>Sizes:</strong> {product.sizes_text}</p> : null}
            <button type="button" className="hero-readmore-btn" onClick={() => setIsOrdering(true)}>Buy</button>
          </div>
        </div>
      </section>
      {isOrdering ? <MerchandiseQuickOrderModal product={product} onClose={() => setIsOrdering(false)} /> : null}
    </main>
  )
}
