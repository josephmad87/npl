import { useEffect, useState } from 'react'
import { postJson } from '../lib/publicApi'
import { sizeOptions, type MerchandiseProduct } from '../lib/merchandise'

type MerchandiseOrder = {
  id: number
}

export function MerchandiseQuickOrderModal({
  product,
  onClose,
}: Readonly<{
  product: MerchandiseProduct
  onClose: () => void
}>) {
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [size, setSize] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSize(sizeOptions(product.sizes_text)[0] ?? '')
    setQuantity('1')
    setNotes('')
    setMessage(null)
    setError(null)
  }, [product])

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
      await postJson<MerchandiseOrder>('/public/merchandise/orders', {
        product_id: product.id,
        customer_name: customerName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        size: size.trim() || null,
        quantity: Number(quantity) || 1,
        notes: notes.trim() || null,
      })
      setMessage('Order request sent. The NPL team will contact you to confirm payment and collection or delivery.')
      setCustomerName('')
      setPhone('')
      setEmail('')
      setSize('')
      setQuantity('1')
      setNotes('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not submit order.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="merchandise-order-modal" role="dialog" aria-modal="true" aria-label={`Order ${product.name}`}>
      <div className="merchandise-order-modal__panel">
        <button type="button" className="merchandise-order-modal__close" onClick={onClose} disabled={isSubmitting} aria-label="Close order form">×</button>
        <h2>Buy {product.name}</h2>
        {product.price_text ? <p className="merchandise-card__price">{product.price_text}</p> : null}
        <label>
          <span>Full name *</span>
          <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} disabled={isSubmitting} placeholder="Enter your full name" autoComplete="name" />
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
          <span>Notes optional</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={isSubmitting} rows={3} placeholder="Add delivery, collection, colour, or other notes" />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="merchandise-order-modal__success">{message}</p> : null}
        <button type="button" className="hero-readmore-btn" onClick={() => void submitOrder()} disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Submit order request'}
        </button>
      </div>
    </div>
  )
}
