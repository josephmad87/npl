import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import type { MerchandiseProductDto } from '@/lib/api-types'
import { adminListAll } from '@/lib/admin-client'
import { EntityTable } from '@/components/EntityTable'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { resolveAdminMediaUrl } from '@/lib/media-url'

export const Route = createFileRoute('/_shell/merchandise/')({
  component: MerchandisePage,
})

function MerchandisePage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')

  const q = useQuery({
    queryKey: ['admin', 'merchandise'],
    queryFn: () => adminListAll<MerchandiseProductDto>('/admin/merchandise'),
  })

  const rows = useMemo(() => q.data ?? [], [q.data])

  const filteredRows = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()

    if (!needle) {
      return rows
    }

    return rows.filter((r) =>
      [
        r.name,
        r.description,
        r.price_text,
        r.sizes_text,
        r.category,
        r.audience,
        String(r.team_id ?? ''),
        r.status,
        String(r.sort_order),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [rows, searchQuery])

  const columns: ColumnDef<MerchandiseProductDto>[] = [
    {
      accessorKey: 'name',
      header: 'Product',
    },
    {
      accessorKey: 'price_text',
      header: 'Price',
      cell: ({ getValue }) => String(getValue() || '—'),
    },

    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ getValue }) => String(getValue() || '—'),
    },
    {
      accessorKey: 'audience',
      header: 'Audience',
      cell: ({ getValue }) => String(getValue() || '—'),
    },
    
    {
      accessorKey: 'sizes_text',
      header: 'Sizes',
      cell: ({ getValue }) => String(getValue() || '—'),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
  <StatusBadge
    status={row.original.status === 'active' ? 'active' : 'inactive'}
  />
),

      
    },
    {
      accessorKey: 'sort_order',
      header: 'Order',
    },
    {
      id: 'image',
      header: 'Image',
      cell: ({ row }) => {
        const u = resolveAdminMediaUrl(row.original.image_url)

        if (!u) {
          return <span className="muted">—</span>
        }

        return (
            <div className="merchandise-admin-thumb">
              <img
                src={u}
                alt={row.original.name}
                loading="lazy"
                decoding="async"
              />
          </div>
              )
      },
    },
  ]

  return (
    <>
    <PageHeader
  title="Merchandise"
  description="Add and manage merchandise products for the public store."
  actions={
    <div className="admin-actions-row">
      <Link to="/merchandise/orders" className="btn-ghost">
        Orders
      </Link>

      <Link to="/merchandise/new" className="btn-primary">
        <Plus size={16} /> New product
      </Link>
    </div>
  }
/>

      {!q.isLoading && !q.isError ? (
        <div className="table-toolbar">
          <input
            className="admin-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search merchandise…"
            aria-label="Filter merchandise"
          />
        </div>
      ) : null}

      {q.isLoading ? (
        <p className="muted">Loading…</p>
      ) : q.isError ? (
        <p className="form-error">{q.error.message}</p>
      ) : (
        <EntityTable
          data={filteredRows}
          columns={columns}
          onRowClick={(row) => {
            void navigate({
              to: '/merchandise/$productId',
              params: { productId: String(row.id) },
            })
          }}
        />
      )}
    </>
  )
}
