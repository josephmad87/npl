import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SiteLink } from '../components/app-link'
import { formatDate } from '../components/match-card'
import { MediaImage } from '../components/native-media'
import { Action, Field, LoadState, Notice, Screen, Segments, ui } from '../components/native-ui'
import { RichText } from '../components/rich-text'
import { publicRequest, usePublic } from '../lib/public-resource'
import { supporterPublicRequest } from '../lib/supporter-account'
import type { Club } from '../lib/team-data'
import { usePagedPublic } from '../lib/use-paged-public'

type Product = {
  id: number; name: string; description: string | null; image_url?: string; image_url_2?: string; image_url_3?: string;
  sizes_text?: string | null; variants?: { id: number; label: string }[];
}
type Tracking = { order_number: string; product_name: string; status: string; payment_status: string;
  fulfilment_notes?: string | null; timeline: { status: string; public_message?: string; created_at: string }[];
}
type Receipt = { order_number: string; tracking_token: string }

export function MerchandiseScreen({ product, team, teamId, order, token }: { product?: number; team?: string; teamId?: number; order?: string; token?: string }) {
  if (order) return <OrderTracking number={order} initialToken={token} />
  if (product) return <ProductScreen id={product} />
  return <Catalog team={team} teamId={teamId} />
}

function Catalog({ team, teamId }: { team?: string; teamId?: number }) {
  const club = usePublic<Club>(team ? '/teams/' + encodeURIComponent(team) : null)
  return <Screen back="Back" title={club.data ? club.data.name + ' merchandise' : 'Merchandise'}>
    <LoadState loading={club.loading && !club.data} error={club.error} retry={() => void club.refresh()} />
    {!team || club.data ? <ProductList teamId={club.data?.id ?? teamId} /> : null}
  </Screen>
}

function ProductList({ teamId }: { teamId?: number }) {
  const list = usePagedPublic<Product>('/merchandise' + (teamId ? '?team_id=' + teamId : ''), 10)
  return <>
    <LoadState loading={list.loading && !list.data} error={list.error} retry={() => void list.refresh()}
      empty={list.data && !list.items.length ? 'No merchandise has been published.' : undefined} />
    {list.items.map(item => <SiteLink key={item.id} path={'/merchandise/' + item.id} asChild>
      <Pressable accessibilityRole="link" style={ui.panel}>
        <MediaImage source={item.image_url} aspect={2} fit="contain" />
        <Text style={ui.heading}>{item.name}</Text>
      </Pressable>
    </SiteLink>)}
    {list.moreError ? <Notice error>{list.moreError}</Notice> : null}
    {list.hasMore ? <Action tone="secondary" label="View more" busy={list.loadingMore} onPress={() => void list.more()} /> : null}
  </>
}

function ProductScreen({ id }: { id: number }) {
  const resource = usePublic<Product>('/merchandise/' + id)
  const [showForm, setShowForm] = useState(false)
  const item = resource.data
  return <Screen back="Merchandise" title={item?.name || 'Merchandise'}>
    <LoadState loading={resource.loading && !item} error={resource.error} retry={() => void resource.refresh()} />
    {item ? <>
      {[item.image_url, item.image_url_2, item.image_url_3].filter(Boolean).map((image, index) => <MediaImage key={index} source={image} fit="contain" />)}
      <RichText content={item.description} basePath={'/merchandise/' + id} />
      {item.sizes_text ? <Text style={ui.muted}>{item.sizes_text}</Text> : null}
      {!showForm ? <Action label="Enquire about this item" onPress={() => setShowForm(true)} /> : <OrderForm product={item} />}
    </> : null}
  </Screen>
}

const methods = [{ value: 'collection', label: 'Collection' }, { value: 'delivery', label: 'Delivery' }] as const

function OrderForm({ product }: { product: Product }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [size, setSize] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [variant, setVariant] = useState<number>()
  const [method, setMethod] = useState<typeof methods[number]['value']>('collection')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [receipt, setReceipt] = useState<Receipt>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function send() {
    if (busy) return
    if (!name.trim() || !phone.trim() || !/^[1-9][0-9]?$/.test(quantity) || method === 'delivery' && !address.trim()) {
      setError('Enter your name, phone number, quantity and delivery address if needed.')
      return
    }
    setBusy(true)
    setError('')
    try {
      setReceipt(await supporterPublicRequest<Receipt>('/merchandise/orders', {
        method: 'POST', body: JSON.stringify({
          product_id: product.id, variant_id: variant, customer_name: name.trim(), phone: phone.trim(),
          email: email.trim() || null, size: size.trim() || null, quantity: Number(quantity),
          notes: notes.trim() || null, fulfilment_method: method, delivery_address: method === 'delivery' ? address.trim() : null,
        }),
      }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send your enquiry.') }
    finally { setBusy(false) }
  }

  if (receipt) return <>
    <Notice>Your enquiry was sent. Reference {receipt.order_number}.</Notice>
    <OrderStatus number={receipt.order_number} token={receipt.tracking_token} />
  </>
  return <View style={ui.panel}>
    <Text style={ui.heading}>Merchandise enquiry</Text>
    {error ? <Notice error>{error}</Notice> : null}
    <Field label="Name" value={name} onChangeText={setName} autoComplete="name" maxLength={255} />
    <Field label="Phone number" value={phone} onChangeText={setPhone} inputMode="tel" maxLength={64} />
    <Field label="Email (optional)" value={email} onChangeText={setEmail} inputMode="email" autoCapitalize="none" maxLength={255} />
    <Field label="Quantity" value={quantity} onChangeText={setQuantity} inputMode="numeric" maxLength={2} />
    {product.variants?.length ? product.variants.map(item => <Action key={item.id} label={item.label} tone={variant === item.id ? 'primary' : 'secondary'} onPress={() => setVariant(item.id)} />)
      : <Field label="Size (optional)" value={size} onChangeText={setSize} maxLength={64} />}
    <Segments options={methods} value={method} onChange={setMethod} />
    {method === 'delivery' ? <Field label="Delivery address" value={address} onChangeText={setAddress} multiline maxLength={1000} /> : null}
    <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline maxLength={2000} />
    <Action label="Send enquiry" busy={busy} onPress={() => void send()} />
  </View>
}

function OrderTracking({ number, initialToken }: { number: string; initialToken?: string }) {
  const [token, setToken] = useState(initialToken || '')
  const [submitted, setSubmitted] = useState(initialToken || '')
  return <Screen back="Back" title="Order tracking">
    <Text style={ui.muted}>{number}</Text>
    <Field label="Tracking code" value={token} onChangeText={setToken} autoCapitalize="none" secureTextEntry maxLength={256} />
    <Action label="Check status" disabled={token.trim().length < 16} onPress={() => setSubmitted(token.trim())} />
    {submitted ? <OrderStatus key={submitted} number={number} token={submitted} /> : null}
  </Screen>
}

function OrderStatus({ number, token }: { number: string; token: string }) {
  const [order, setOrder] = useState<Tracking>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function load() {
    setLoading(true)
    setError('')
    try {
      setOrder(await publicRequest<Tracking>('/merchandise/order-tracking/' + encodeURIComponent(number) + '?token=' + encodeURIComponent(token)))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load order status.') }
    finally { setLoading(false) }
  }
  return <View style={ui.panel}>
    <Text style={ui.heading}>{order?.product_name || 'Order ' + number}</Text>
    {order ? <>
      <Text style={ui.rowTitle}>{[order.status, order.payment_status].join(' · ').replaceAll('_', ' ')}</Text>
      {order.fulfilment_notes ? <Text style={ui.muted}>{order.fulfilment_notes}</Text> : null}
      {order.timeline.map((event, index) => <Text key={index} style={ui.muted}>
        {[formatDate(event.created_at), event.status.replaceAll('_', ' '), event.public_message].filter(Boolean).join(' · ')}
      </Text>)}
    </> : null}
    {error ? <Notice error>{error}</Notice> : null}
    <Action tone="secondary" label={order ? 'Refresh status' : 'View order status'} busy={loading} onPress={() => void load()} />
  </View>
}
