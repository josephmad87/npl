import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearch } from '@tanstack/react-router'
import { SeoHead } from './components/SeoHead'
import { fetchJson } from './lib/publicApi'

type Tracking = {
  order_number: string
  product_name: string
  variant_label: string | null
  quantity: number
  status: string
  payment_status: string
  fulfilment_method: string
  fulfilment_notes: string | null
  carrier: string | null
  tracking_number: string | null
  estimated_ready_at: string | null
  timeline: Array<{ status: string; public_message: string | null; created_at: string }>
}

export default function MerchandiseOrderTrackingPage() {
  const { orderNumber } = useParams({ from: '/merchandise/orders/$orderNumber' })
  const { token } = useSearch({ from: '/merchandise/orders/$orderNumber' })
  const trackingQ = useQuery({
    queryKey: ['order-tracking', orderNumber, token],
    queryFn: () => fetchJson<Tracking>(`/public/merchandise/order-tracking/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(token)}`),
    enabled: Boolean(orderNumber && token),
    retry: false,
  })
  return <main className="container merchandise-tracking-page">
    <SeoHead title="Track merchandise order" description="Private NPL merchandise order tracking." canonicalPath={`/merchandise/orders/${orderNumber}`} noIndex />
    <Link to="/merchandise">← Back to merchandise</Link>
    <h1>Track order</h1>
    {trackingQ.isLoading ? <p>Loading order…</p> : trackingQ.isError || !trackingQ.data ? <p className="form-error">This tracking link is invalid or has expired.</p> : <>
      <section className="merchandise-tracking-page__summary"><span>{trackingQ.data.order_number}</span><h2>{trackingQ.data.product_name}</h2>{trackingQ.data.variant_label ? <p>{trackingQ.data.variant_label}</p> : null}<dl><div><dt>Status</dt><dd>{trackingQ.data.status.replaceAll('_', ' ')}</dd></div><div><dt>Payment</dt><dd>{trackingQ.data.payment_status}</dd></div><div><dt>Fulfilment</dt><dd>{trackingQ.data.fulfilment_method}</dd></div>{trackingQ.data.tracking_number ? <div><dt>Tracking</dt><dd>{trackingQ.data.carrier ? `${trackingQ.data.carrier} · ` : ''}{trackingQ.data.tracking_number}</dd></div> : null}</dl></section>
      <section className="merchandise-tracking-page__timeline"><h2>Updates</h2><ol>{trackingQ.data.timeline.map((event, index) => <li key={`${event.created_at}-${index}`}><strong>{event.status.replaceAll('_', ' ')}</strong>{event.public_message ? <p>{event.public_message}</p> : null}<time>{new Date(event.created_at).toLocaleString()}</time></li>)}</ol></section>
    </>}
  </main>
}
