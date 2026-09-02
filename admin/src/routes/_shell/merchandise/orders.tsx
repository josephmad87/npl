import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import type { MerchandiseOrderDto } from '@/lib/api-types'
import { adminListAll, adminPatch } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { EntityTable } from '@/components/EntityTable'
import { PageHeader } from '@/components/PageHeader'

export const Route = createFileRoute('/_shell/merchandise/orders')({
  component: MerchandiseOrdersPage,
})

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function OrderStatusBadge({ status }: Readonly<{ status: string }>) {
  const label = status.replaceAll('_', ' ')

  return (
    <span className="badge badge--archived">
      {label}
    </span>
  )
}

function FulfilmentEditor({
  order,
  onSaved,
}: Readonly<{
  order: MerchandiseOrderDto
  onSaved: () => Promise<void>
}>) {
  const [status, setStatus] = useState(order.status)
  const [paymentStatus, setPaymentStatus] = useState(order.payment_status)
  const [method, setMethod] = useState(order.fulfilment_method)
  const [carrier, setCarrier] = useState(order.carrier ?? '')
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number ?? '')
  const [estimatedReadyAt, setEstimatedReadyAt] = useState(order.estimated_ready_at?.slice(0, 16) ?? '')
  const [notes, setNotes] = useState(order.fulfilment_notes ?? '')
  const [publicMessage, setPublicMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await adminPatch<MerchandiseOrderDto>(`/admin/merchandise/orders/${order.id}`, {
        status,
        payment_status: paymentStatus,
        fulfilment_method: method,
        carrier: carrier.trim() || null,
        tracking_number: trackingNumber.trim() || null,
        estimated_ready_at: estimatedReadyAt ? new Date(estimatedReadyAt).toISOString() : null,
        fulfilment_notes: notes.trim() || null,
        public_message: publicMessage.trim() || null,
      })
      setPublicMessage('')
      await onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update order.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <details className="order-fulfilment" onClick={(event) => event.stopPropagation()}>
      <summary>Manage</summary>
      <div className="order-fulfilment__panel">
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="new">New</option><option value="confirmed">Confirmed</option><option value="preparing">Preparing</option><option value="ready_for_collection">Ready for collection</option><option value="dispatched">Dispatched</option><option value="fulfilled">Fulfilled</option><option value="cancelled">Cancelled</option></select></label>
        <label>Payment<select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option value="pending">Pending</option><option value="paid">Paid</option><option value="refunded">Refunded</option><option value="failed">Failed</option></select></label>
        <label>Fulfilment<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="collection">Collection</option><option value="delivery">Delivery</option></select></label>
        <label>Carrier<input value={carrier} onChange={(event) => setCarrier(event.target.value)} /></label>
        <label>Tracking number<input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} /></label>
        <label>Estimated ready<input type="datetime-local" value={estimatedReadyAt} onChange={(event) => setEstimatedReadyAt(event.target.value)} /></label>
        <label>Internal fulfilment notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} /></label>
        <label>Customer update<textarea value={publicMessage} onChange={(event) => setPublicMessage(event.target.value)} rows={2} placeholder="Shown in order tracking" /></label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save update'}</button>
      </div>
    </details>
  )
}

function MerchandiseOrdersPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const q = useQuery({
    queryKey: ['admin', 'merchandise-orders', statusFilter],
    queryFn: () =>
      adminListAll<MerchandiseOrderDto>(
        statusFilter
          ? `/admin/merchandise/orders?status=${encodeURIComponent(statusFilter)}`
          : '/admin/merchandise/orders',
      ),
  })

  const rows = useMemo(() => q.data ?? [], [q.data])

  const filteredRows = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()

    if (!needle) {
      return rows
    }

    return rows.filter((r) =>
      [
        r.product_name,
        r.customer_name,
        r.phone,
        r.email,
        r.size,
        String(r.quantity),
        r.notes,
        r.status,
        formatWhen(r.created_at),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [rows, searchQuery])

  const refreshOrders = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['admin', 'merchandise-orders'],
    })
  }

  const columns: ColumnDef<MerchandiseOrderDto>[] = [
    {
      accessorKey: 'order_number',
      header: 'Order',
    },
    {
      accessorKey: 'created_at',
      header: 'Received',
      cell: ({ row }) => formatWhen(row.original.created_at),
    },
    {
      accessorKey: 'product_name',
      header: 'Product',
    },
    {
      accessorKey: 'customer_name',
      header: 'Customer',
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ getValue }) => String(getValue() || '—'),
    },
    {
      accessorKey: 'size',
      header: 'Size',
      cell: ({ getValue }) => String(getValue() || '—'),
    },
    {
      accessorKey: 'quantity',
      header: 'Qty',
    },
    {
      accessorKey: 'notes',
      header: 'Notes',
      cell: ({ getValue }) => String(getValue() || '—'),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'payment_status',
      header: 'Payment',
      cell: ({ getValue }) => String(getValue() || 'pending').replaceAll('_', ' '),
    },
    {
      accessorKey: 'fulfilment_method',
      header: 'Fulfilment',
      cell: ({ row }) => (
        <span>{row.original.fulfilment_method.replaceAll('_', ' ')}{row.original.tracking_number ? ` · ${row.original.tracking_number}` : ''}</span>
      ),
    },
    {
      id: 'update_status',
      header: 'Update',
      cell: ({ row }) => (
        <FulfilmentEditor order={row.original} onSaved={refreshOrders} />
      ),
    },
  ]

  return (
    <>
      <PageHeader
          title="Merchandise orders"
          description="View and manage customer merchandise order requests."
          actions={<BackNavLink to="/merchandise">Merchandise</BackNavLink>}
      />

      {!q.isLoading && !q.isError ? (
        <div className="table-toolbar">
          <input
            className="admin-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders…"
            aria-label="Filter merchandise orders"
          />

          <select
            className="admin-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by order status"
          >
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="confirmed">Confirmed</option>
            <option value="preparing">Preparing</option>
            <option value="ready_for_collection">Ready for collection</option>
            <option value="dispatched">Dispatched</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      ) : null}

      {q.isLoading ? (
        <p className="muted">Loading…</p>
      ) : q.isError ? (
        <p className="form-error">{q.error.message}</p>
      ) : (
        <EntityTable data={filteredRows} columns={columns} />
      )}
    </>
  )
}
