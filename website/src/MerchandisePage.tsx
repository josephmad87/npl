import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import nplLogoUrl from './assets/logo.png'
import { PageHero } from './components/PageHero'
import { fetchAllPaginatedList, postJson, resolveMediaUrl } from './lib/publicApi'

type MerchandiseProduct = {
  id: number
  name: string
  description: string | null
  price_text: string
  image_url: string
  sizes_text: string | null
  status: string
  sort_order: number
}

type MerchandiseOrder = {
  id: number
  product_id: number | null
  product_name: string
  customer_name: string
  phone: string
  email: string | null
  size: string | null
  quantity: number
  notes: string | null
  status: string
  created_at: string
}

function sizeOptions(sizesText: string | null): string[] {
  return (sizesText ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function MerchandiseImage({ product }: Readonly<{ product: MerchandiseProduct }>) {
  const src = resolveMediaUrl(product.image_url) ?? nplLogoUrl

  return (
    <img
      src={src}
      alt={product.name}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        e.currentTarget.onerror = null
        e.currentTarget.src = nplLogoUrl
      }}
    />
  )
}

export default function MerchandisePage() {
  const { data: products = [], isLoading, isError } = useQuery({
    queryKey: ['public-merchandise'],
    queryFn: () =>
      fetchAllPaginatedList<MerchandiseProduct>(
        (page) => `/public/merchandise?page=${page}&page_size=100`,
      ),
    retry: 1,
  })

  const activeProducts = useMemo(
    () =>
      products
        .filter((p) => p.status === 'active')
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [products],
  )

  const [selectedProduct, setSelectedProduct] =
    useState<MerchandiseProduct | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [size, setSize] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderMessage, setOrderMessage] = useState<string | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)

  const openOrder = (product: MerchandiseProduct) => {
    setSelectedProduct(product)
    setSize(sizeOptions(product.sizes_text)[0] ?? '')
    setQuantity('1')
    setNotes('')
    setOrderMessage(null)
    setOrderError(null)
  }

  const closeOrder = () => {
    if (isSubmitting) return
    setSelectedProduct(null)
  }

  const submitOrder = async () => {
    if (!selectedProduct || isSubmitting) return

    if (!customerName.trim()) {
      setOrderError('Please enter your name.')
      return
    }

    if (!phone.trim()) {
      setOrderError('Please enter your phone number.')
      return
    }

    setIsSubmitting(true)
    setOrderError(null)
    setOrderMessage(null)

    try {
      await postJson<MerchandiseOrder>('/public/merchandise/orders', {
        product_id: selectedProduct.id,
        customer_name: customerName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        size: size.trim() || null,
        quantity: Number(quantity) || 1,
        notes: notes.trim() || null,
      })

      setOrderMessage(
        'Order request sent. The NPL team will contact you to confirm payment and collection/delivery.',
      )
      setCustomerName('')
      setPhone('')
      setEmail('')
      setSize('')
      setQuantity('1')
      setNotes('')
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : 'Could not submit order.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <PageHero
        title="Merchandise"
        subtitle="Official NPL merchandise and supporter gear."
        variant="siteLogo"
        fallbackMode="none"
      />

      <main className="container">
        <section className="menu-page merchandise-page">
          <div className="menu-page__intro">
            <p className="muted">
              Browse available merchandise and submit an order request. We will
              contact you to confirm payment and collection or delivery.
            </p>
          </div>

          {isLoading ? <p className="muted">Loading merchandise…</p> : null}
          {isError ? (
            <p className="form-error">Could not load merchandise.</p>
          ) : null}

          {!isLoading && activeProducts.length === 0 ? (
            <p className="muted">No merchandise is available yet.</p>
          ) : null}

          <div className="merchandise-grid">
            {activeProducts.map((product) => (
              <article key={product.id} className="merchandise-card">
                <div className="merchandise-card__media">
                  <MerchandiseImage product={product} />
                </div>

                <div className="merchandise-card__body">
                  <h2>{product.name}</h2>

                  {product.price_text.trim() ? (
                    <p className="merchandise-card__price">
                      {product.price_text}
                    </p>
                  ) : null}

                  {product.description?.trim() ? (
                    <p className="muted">{product.description.trim()}</p>
                  ) : null}

                  {product.sizes_text?.trim() ? (
                    <p className="merchandise-card__sizes">
                      <strong>Sizes:</strong> {product.sizes_text}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    className="hero-readmore-btn merchandise-card__button"
                    onClick={() => openOrder(product)}
                  >
                    Order this item
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      {selectedProduct ? (
        <div className="merchandise-order-modal" role="dialog" aria-modal="true">
          <div className="merchandise-order-modal__panel">
            <button
              type="button"
              className="merchandise-order-modal__close"
              onClick={closeOrder}
              aria-label="Close order form"
            >
              ×
            </button>

            <h2>Order {selectedProduct.name}</h2>

            {selectedProduct.price_text ? (
              <p className="merchandise-card__price">
                {selectedProduct.price_text}
              </p>
            ) : null}

            <label>
              <span>Name</span>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={isSubmitting}
              />
            </label>

            <label>
              <span>Phone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isSubmitting}
              />
            </label>

            <label>
              <span>Email optional</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </label>

            {sizeOptions(selectedProduct.sizes_text).length > 0 ? (
              <label>
                <span>Size</span>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  disabled={isSubmitting}
                >
                  {sizeOptions(selectedProduct.sizes_text).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              <span>Quantity</span>
              <input
                type="number"
                min="1"
                max="99"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isSubmitting}
              />
            </label>

            <label>
              <span>Notes optional</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
                rows={3}
              />
            </label>

            {orderError ? <p className="form-error">{orderError}</p> : null}
            {orderMessage ? (
              <p className="merchandise-order-modal__success">{orderMessage}</p>
            ) : null}

            <button
              type="button"
              className="hero-readmore-btn"
              onClick={() => void submitOrder()}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending…' : 'Submit order request'}
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
