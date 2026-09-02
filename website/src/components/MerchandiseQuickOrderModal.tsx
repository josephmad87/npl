import { useEffect, useId, useRef, useState } from 'react'
import { sizeOptions, type MerchandiseProduct } from '../lib/merchandise'
import { recordFanEngagement, supporterFetch } from '../lib/supporterApi'

type MerchandiseOrder = {
  id: number
  order_number: string
  tracking_token: string
  status: string
}

export function MerchandiseQuickOrderModal({
  product,
  onClose,
}: Readonly<{
  product: MerchandiseProduct
  onClose: () => void
}>) {
  const titleId = useId()
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [size, setSize] = useState(() => sizeOptions(product.sizes_text)[0] ?? '')
  const availableVariants = product.variants?.filter((variant) => variant.status === 'active') ?? []
  const firstOrderableVariant = availableVariants.find(
    (variant) => variant.stock_quantity === null || variant.stock_quantity > 0 || variant.allow_backorder,
  )
  const hasOrderableVariant = availableVariants.length === 0 || Boolean(firstOrderableVariant)
  const [variantId, setVariantId] = useState(() => firstOrderableVariant?.id ? String(firstOrderableVariant.id) : '')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [fulfilmentMethod, setFulfilmentMethod] = useState<'collection' | 'delivery'>('collection')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [website, setWebsite] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tracking, setTracking] = useState<{ orderNumber: string; token: string } | null>(null)
  const recordedOpen = useRef(false)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!recordedOpen.current) {
      recordedOpen.current = true
      recordFanEngagement('add_to_order', 'product', product.id)
    }
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [product.id])

  const submitOrder = async () => {
    if (isSubmitting) return
    if (!customerName.trim()) {
      setError('Please enter your name.')
      return
    }
    if (!phone.trim()) {
      setError('Please enter your phone number.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const created = await supporterFetch<MerchandiseOrder>('/public/merchandise/orders', {
        method: 'POST',
        body: JSON.stringify({
        product_id: product.id,
        variant_id: variantId ? Number(variantId) : null,
        customer_name: customerName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        size: size.trim() || null,
        quantity: Number(quantity) || 1,
        notes: notes.trim() || null,
        fulfilment_method: fulfilmentMethod,
        delivery_address: fulfilmentMethod === 'delivery' ? deliveryAddress.trim() || null : null,
        website,
        }),
      })
      setTracking({ orderNumber: created.order_number, token: created.tracking_token })
      setMessage(`Order ${created.order_number} received. Keep the private tracking link below.`)
      recordFanEngagement('order_submitted', 'product', product.id, { fulfilment_method: fulfilmentMethod })
      setCustomerName('')
      setPhone('')
      setEmail('')
      setSize('')
      setQuantity('1')
      setNotes('')
      setWebsite('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not submit order.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="merchandise-order-modal">
      <div
        className="merchandise-order-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button type="button" className="merchandise-order-modal__close" onClick={onClose} disabled={isSubmitting} aria-label="Close order form" data-dialog-close>×</button>
        <h2 id={titleId}>Buy {product.name}</h2>
        <input
          className="merchandise-order-modal__honeypot"
          name="website"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
        />
        {product.price_text ? <p className="merchandise-card__price">{product.price_text}</p> : null}
        {availableVariants.length > 0 ? (
          <label>
            <span>Product option *</span>
            <select value={variantId} onChange={(event) => setVariantId(event.target.value)} disabled={isSubmitting}>
              {availableVariants.map((variant) => (
                <option key={variant.id} value={variant.id} disabled={variant.stock_quantity === 0 && !variant.allow_backorder}>
                  {variant.label}{variant.price_text ? ` · ${variant.price_text}` : ''}{variant.stock_quantity === 0 && !variant.allow_backorder ? ' · Out of stock' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {!hasOrderableVariant ? <p className="form-error" role="status">All product options are currently out of stock.</p> : null}
        <label>
          <span>Full name *</span>
          <input data-dialog-initial-focus value={customerName} onChange={(event) => setCustomerName(event.target.value)} disabled={isSubmitting} placeholder="Enter your full name" autoComplete="name" />
        </label>
        <label>
          <span>Phone number *</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} disabled={isSubmitting} placeholder="Enter your WhatsApp or phone number" autoComplete="tel" />
        </label>
        <label>
          <span>Email address optional</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={isSubmitting} placeholder="Enter your email address" autoComplete="email" />
        </label>
        {sizeOptions(product.sizes_text).length > 0 ? (
          <label>
            <span>Size</span>
            <select value={size} onChange={(event) => setSize(event.target.value)} disabled={isSubmitting}>
              {sizeOptions(product.sizes_text).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        ) : null}
        <label>
          <span>Quantity</span>
          <input type="number" min="1" max="99" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={isSubmitting} />
        </label>
        <label>
          <span>Collection or delivery</span>
          <select value={fulfilmentMethod} onChange={(event) => setFulfilmentMethod(event.target.value as 'collection' | 'delivery')} disabled={isSubmitting}>
            <option value="collection">Collection</option>
            <option value="delivery">Delivery</option>
          </select>
        </label>
        {fulfilmentMethod === 'delivery' ? <label><span>Delivery address</span><textarea value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} disabled={isSubmitting} rows={3} /></label> : null}
        <label>
          <span>Notes optional</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={isSubmitting} rows={3} placeholder="Add delivery, collection, colour, or other notes" />
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {message ? <p className="merchandise-order-modal__success" role="status">{message}</p> : null}
        {tracking ? <a className="merchandise-order-modal__tracking" href={`/merchandise/orders/${encodeURIComponent(tracking.orderNumber)}?token=${encodeURIComponent(tracking.token)}`}>Track {tracking.orderNumber}</a> : null}
        <button type="button" className="hero-readmore-btn" onClick={() => void submitOrder()} disabled={isSubmitting || !hasOrderableVariant}>
          {isSubmitting ? 'Sending…' : 'Submit order request'}
        </button>
      </div>
    </div>
  )
}
