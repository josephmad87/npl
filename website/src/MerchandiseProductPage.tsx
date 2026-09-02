import { Link, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import nplLogoUrl from './assets/logo-optimized.png'
import { MerchandiseQuickOrderModal } from './components/MerchandiseQuickOrderModal'
import { ResponsiveImage } from './components/ResponsiveImage'
import { Breadcrumbs } from './components/Breadcrumbs'
import { SeoHead } from './components/SeoHead'
import {
  merchandiseImages,
  merchandiseProductIdFromSegment,
  type MerchandiseProduct,
} from './lib/merchandise'
import { fetchJson, resolveMediaUrl } from './lib/publicApi'
import { recordFanEngagement } from './lib/supporterApi'

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
    if (product?.id) recordFanEngagement('product_view', 'product', product.id)
  }, [product?.id])

  if (productQ.isLoading) return <main className="container"><p className="muted">Loading product…</p></main>
  if (productQ.isError || !product) return <main className="container"><p className="form-error">This product is no longer available.</p><Link to="/merchandise">Back to merchandise</Link></main>

  const activeImageUrl = images[activeImage] ?? images[0] ?? null
  const canonicalPath = `/merchandise/${productId}`
  const description =
    product.description?.replace(/\s+/g, ' ').trim().slice(0, 160) ||
    `Buy ${product.name} from NPL Zimbabwe.`
  const breadcrumbs = [
    { name: 'Home', path: '/' },
    { name: 'Merchandise', path: '/merchandise' },
    { name: product.name, path: canonicalPath },
  ]
  return (
    <main className="container">
      <SeoHead
        title={product.name}
        description={description}
        canonicalPath={canonicalPath}
        image={activeImageUrl ? resolveMediaUrl(activeImageUrl) : nplLogoUrl}
        type="product"
        breadcrumbs={breadcrumbs}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description,
          image: images.map((image) => resolveMediaUrl(image) ?? image),
        }}
      />
      <section className="merchandise-product-page">
        <Breadcrumbs items={breadcrumbs} />
        <Link to="/merchandise" className="merchandise-product-page__back">← Back to merchandise</Link>
        <div className="merchandise-product-page__layout">
          <div className="merchandise-product-page__gallery">
            <div className="merchandise-product-page__main-image">
              <ResponsiveImage
                src={activeImageUrl ? resolveMediaUrl(activeImageUrl) ?? nplLogoUrl : nplLogoUrl}
                alt={product.name}
                widths={[480, 768, 1024, 1280]}
                sizes="(max-width: 800px) 100vw, 55vw"
                fallbackWidth={1024}
                priority
              />
            </div>
            {images.length > 1 ? (
              <div className="merchandise-product-page__thumbnails" aria-label="Product images">
                {images.map((image, index) => (
                  <button type="button" key={image} className={index === activeImage ? 'is-active' : ''} onClick={() => setActiveImage(index)} aria-label={`Show image ${index + 1}`}>
                    <ResponsiveImage
                      src={resolveMediaUrl(image) ?? nplLogoUrl}
                      alt=""
                      widths={[96, 160, 240]}
                      sizes="96px"
                      fallbackWidth={160}
                    />
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
            {product.variants?.length ? <div className="merchandise-product-page__variants"><h2>Available options</h2><ul>{product.variants.filter((variant) => variant.status === 'active').map((variant) => <li key={variant.id}><span>{variant.label}</span><strong>{variant.price_text || product.price_text}</strong><small>{variant.stock_quantity == null ? 'Available to order' : variant.stock_quantity > 0 ? `${variant.stock_quantity} in stock` : variant.allow_backorder ? 'Available on backorder' : 'Out of stock'}</small></li>)}</ul></div> : null}
            <button type="button" className="hero-readmore-btn" onClick={() => setIsOrdering(true)}>Buy</button>
          </div>
        </div>
      </section>
      {isOrdering ? <MerchandiseQuickOrderModal key={product.id} product={product} onClose={() => setIsOrdering(false)} /> : null}
    </main>
  )
}
