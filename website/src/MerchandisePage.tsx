import { Link, useSearch } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import nplLogoUrl from './assets/logo.png'
import { MerchandiseQuickOrderModal } from './components/MerchandiseQuickOrderModal'
import { PageHero } from './components/PageHero'
import {
  merchandiseExcerpt,
  merchandiseImages,
  type MerchandiseProduct,
} from './lib/merchandise'
import { fetchAllPaginatedList, resolveMediaUrl } from './lib/publicApi'

function MerchandiseCardImage({ product }: Readonly<{ product: MerchandiseProduct }>) {
  const mainImage = merchandiseImages(product)[0]
  return (
    <img
      src={mainImage ? resolveMediaUrl(mainImage) ?? nplLogoUrl : nplLogoUrl}
      alt={product.name}
      loading="lazy"
      decoding="async"
    />
  )
}

export default function MerchandisePage() {
  const { team_id: teamId } = useSearch({ from: '/merchandise' })
  const { data: products = [], isLoading, isError } = useQuery({
    queryKey: ['public-merchandise', teamId ?? 'all'],
    queryFn: () =>
      fetchAllPaginatedList<MerchandiseProduct>((page) => {
        const teamFilter = teamId ? `&team_id=${teamId}` : ''
        return `/public/merchandise?page=${page}&page_size=100${teamFilter}`
      }),
    retry: 1,
  })
  const activeProducts = useMemo(
    () => products.filter((product) => product.status === 'active').sort(
      (left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name),
    ),
    [products],
  )
  const [orderProduct, setOrderProduct] = useState<MerchandiseProduct | null>(null)

  return (
    <>
      <PageHero
        title={teamId ? 'Team Merchandise' : 'Official NPL Merchandise'}
        subtitle={teamId ? 'Shop merchandise linked to this team.' : 'Shop official National Premier League supporter gear, jerseys, caps and fan merchandise.'}
        variant="siteLogo"
        fallbackMode="none"
      />
      <main className="container">
        <section className="menu-page merchandise-page">
          <div className="menu-page__intro">
            <p className="muted">Browse official National Premier League merchandise and submit an order request for payment, collection or delivery.</p>
          </div>
          {isLoading ? <p className="muted">Loading merchandise…</p> : null}
          {isError ? <p className="form-error">Could not load merchandise.</p> : null}
          {!isLoading && activeProducts.length === 0 ? <p className="muted">{teamId ? 'No merchandise is available for this team yet.' : 'No merchandise is available yet.'}</p> : null}
          <div className="merchandise-grid">
            {activeProducts.map((product) => (
              <article key={product.id} className="merchandise-card">
                <Link to="/merchandise/$productId" params={{ productId: String(product.id) }} search={{ order: false }} className="merchandise-card__media" aria-label={`View ${product.name}`}>
                  <MerchandiseCardImage product={product} />
                </Link>
                <div className="merchandise-card__body">
                  <h2><Link to="/merchandise/$productId" params={{ productId: String(product.id) }} search={{ order: false }}>{product.name}</Link></h2>
                  {product.price_text.trim() ? <p className="merchandise-card__price">{product.price_text}</p> : null}
                  {merchandiseExcerpt(product.description) ? <p className="muted">{merchandiseExcerpt(product.description)}</p> : null}
                  {product.sizes_text?.trim() ? <p className="merchandise-card__sizes"><strong>Sizes:</strong> {product.sizes_text}</p> : null}
                  <button type="button" className="hero-readmore-btn merchandise-card__button" onClick={() => setOrderProduct(product)}>Buy</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      {orderProduct ? <MerchandiseQuickOrderModal product={orderProduct} onClose={() => setOrderProduct(null)} /> : null}
    </>
  )
}
