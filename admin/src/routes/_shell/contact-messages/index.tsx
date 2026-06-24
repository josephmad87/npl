import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import type { ContactMessageDto } from '@/lib/api-types'
import { adminListAll } from '@/lib/admin-client'
import { EntityTable } from '@/components/EntityTable'
import { PageHeader } from '@/components/PageHeader'

export const Route = createFileRoute('/_shell/contact-messages/')({
  component: ContactMessagesPage,
})

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function ContactMessagesPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const q = useQuery({
    queryKey: ['admin', 'contact-messages'],
    queryFn: () => adminListAll<ContactMessageDto>('/admin/contact-messages'),
  })

  const rows = q.data ?? []

  const queryFilteredRows = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((r) =>
      [r.full_name, r.email, r.phone, r.message, formatWhen(r.created_at)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [rows, searchQuery])

  const columns: ColumnDef<ContactMessageDto, unknown>[] = [
    { accessorKey: 'full_name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    {
      id: 'created_at',
      header: 'Received',
      cell: ({ row }) => formatWhen(row.original.created_at),
    },
    {
      id: 'read',
      header: 'Status',
      cell: ({ row }) => (row.original.read_at ? 'Read' : 'Unread'),
    },
  ]

  return (
    <>
      <PageHeader
        title="Contact messages"
        description="Enquiries submitted from the public contact form."
      />
      {!q.isLoading && !q.isError ? (
        <div className="catalog-browse">
          <div className="catalog-toolbar">
            <input
              type="search"
              className="catalog-toolbar__search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages…"
              aria-label="Filter messages"
            />
          </div>
        </div>
      ) : null}
      {q.isLoading ? <p className="muted">Loading…</p> : null}
      {q.isError ? <p className="login-error">{q.error.message}</p> : null}
      {!q.isLoading && !q.isError ? (
        <EntityTable
          columns={columns}
          data={queryFilteredRows}
          hideToolbar
          onRowClick={(row) =>
            void navigate({
              to: '/contact-messages/$messageId',
              params: { messageId: String(row.id) },
            })
          }
        />
      ) : null}
    </>
  )
}
