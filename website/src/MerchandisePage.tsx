import { Link, useParams } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import nplLogoUrl from './assets/logo-optimized.png'
import { MerchandiseQuickOrderModal } from './components/MerchandiseQuickOrderModal'
import { PageHero } from './components/PageHero'
import { ResponsiveImage } from './components/ResponsiveImage'
import { SectionHeader } from './components/SectionHeader'
import {
  merchandiseExcerpt,
  merchandiseImages,
  merchandiseProductSegment,
  type MerchandiseProduct,
} from './lib/merchandise'
import { fetchAllPaginatedList, fetchJson, resolveMediaUrl } from './lib/publicApi'
import { managedSection, useSitePageContent } from './lib/siteContent'
import { ManagedSiteHtml } from './components/ManagedSiteHtml'

type MerchandiseTeam = {
  id: number
  name: string
  slug: string
}

function MerchandiseCardImage({ product }: Readonly<{ product: MerchandiseProduct }>) {
  const mainImage = merchandiseImages(product)[0]
  return (
    <ResponsiveImage
      src={mainImage ? resolveMediaUrl(mainImage) ?? nplLogoUrl : nplLogoUrl}
      alt={product.name}
      widths={[320, 480, 640, 800]}
      sizes="(max-width: 700px) 100vw, 33vw"
      fallbackWidth={640}
    />
  )
}

function MerchandiseCatalog({
  teamId,
  teamName,
}: Readonly<{
  teamId?: number
  teamName?: string
}>) {
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
  const contentQ = useSitePageContent('merchandise')
  const productsContent = managedSection(
    contentQ.data,
    'products',
    'Merchandise',
    '<p>Browse products and submit an order request for payment, collection or delivery.</p>',
  )

  return (
    <>
      <PageHero
        title={teamName ? `${teamName} merchandise` : contentQ.data?.title || 'Official NPL Merchandise'}
        subtitle={teamId ? 'Shop merchandise linked to this team.' : contentQ.data?.subtitle}
        variant="siteLogo"
        fallbackMode="none"
      />
      <main className="container">
        <section className="menu-page merchandise-page">
          <SectionHeader
            title={productsContent.heading}
            description={<ManagedSiteHtml html={productsContent.body_html} />}
          />
          {isLoading ? <p className="muted">Loading merchandise…</p> : null}
          {isError ? <p className="form-error">Could not load merchandise.</p> : null}
          {!isLoading && activeProducts.length === 0 ? <p className="muted">{teamId ? 'No merchandise is available for this team yet.' : 'No merchandise is available yet.'}</p> : null}
          <div className="merchandise-grid">
            {activeProducts.map((product) => (
              <article key={product.id} className="merchandise-card">
                <Link to="/merchandise/$productId" params={{ productId: merchandiseProductSegment(product) }} className="merchandise-card__media" aria-label={`View ${product.name}`}>
                  <MerchandiseCardImage product={product} />
                </Link>
                <div className="merchandise-card__body">
                  <h2><Link to="/merchandise/$productId" params={{ productId: merchandiseProductSegment(product) }}>{product.name}</Link></h2>
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
      {orderProduct ? <MerchandiseQuickOrderModal key={orderProduct.id} product={orderProduct} onClose={() => setOrderProduct(null)} /> : null}
    </>
  )
}

export default function MerchandisePage() {
  return <MerchandiseCatalog />
}

export function TeamMerchandisePage() {
  const { teamSlug } = useParams({ from: '/merchandise/teams/$teamSlug' })
  const teamQ = useQuery({
    queryKey: ['team-merchandise-page', teamSlug],
    queryFn: () => fetchJson<MerchandiseTeam>(`/public/teams/${teamSlug}`),
    retry: 1,
  })

  if (teamQ.isLoading) {
    return <main className="container"><p className="muted">Loading team merchandise…</p></main>
  }

  if (teamQ.isError || !teamQ.data) {
    return <main className="container"><p className="form-error">Could not load merchandise for this team.</p></main>
  }

  return <MerchandiseCatalog teamId={teamQ.data.id} teamName={teamQ.data.name} />
}
