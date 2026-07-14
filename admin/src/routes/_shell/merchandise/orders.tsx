import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import type { MerchandiseOrderDto } from '@/lib/api-types'
import { adminListAll, adminPatch } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { EntityTable } from '@/components/EntityTable'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'

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

  const updateStatus = async (orderId: number, status: string) => {
    await adminPatch<MerchandiseOrderDto>(
      `/admin/merchandise/orders/${orderId}`,
      { status },
    )

    await queryClient.invalidateQueries({
      queryKey: ['admin', 'merchandise-orders'],
    })
  }

  const columns: ColumnDef<MerchandiseOrderDto>[] = [
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
      cell: ({ row }) => <StatusBadge value={row.original.status} />,
    },
    {
      id: 'update_status',
      header: 'Update',
      cell: ({ row }) => (
        <select
          value={row.original.status}
          onChange={(e) => {
            void updateStatus(row.original.id, e.target.value)
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="cancelled">Cancelled</option>
        </select>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Merchandise orders"
        subtitle="View and manage customer merchandise order requests."
        eyebrow={<BackNavLink to="/merchandise">Merchandise</BackNavLink>}
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
            <option value="contacted">Contacted</option>
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
