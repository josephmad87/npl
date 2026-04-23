import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import type { SponsorDto } from '@/lib/api-types'
import { adminListAll } from '@/lib/admin-client'
import { EntityTable } from '@/components/EntityTable'
import { PageHeader } from '@/components/PageHeader'
import { resolveAdminMediaUrl } from '@/lib/media-url'

export const Route = createFileRoute('/_shell/sponsors/')({
  component: SponsorsPage,
})

type SponsorRow = SponsorDto & { team_label: string }

function SponsorsPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const q = useQuery({
    queryKey: ['admin', 'sponsors'],
    queryFn: () => adminListAll<SponsorDto>('/admin/sponsors'),
  })

  const rows = useMemo((): SponsorRow[] => {
    return (q.data ?? []).map((s) => ({
      ...s,
      team_label: s.team_name ?? (s.team_id != null ? `#${s.team_id}` : '—'),
    }))
  }, [q.data])

  const queryFilteredRows = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((r) =>
      [r.name, r.team_label, r.image_url, String(r.created_at)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [rows, searchQuery])

  const columns: ColumnDef<SponsorRow, unknown>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'team_label', header: 'Team' },
    {
      id: 'image',
      header: 'Image',
      cell: ({ row }) => {
        const u = resolveAdminMediaUrl(row.original.image_url)
        if (!u) {
          return <span className="muted">—</span>
        }
        return (
          <img
            src={u}
            alt=""
            style={{ maxHeight: 40, maxWidth: 56, objectFit: 'contain' }}
            loading="lazy"
          />
        )
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ getValue }) => String(getValue()).slice(0, 10),
    },
  ]

  return (
    <>
      <PageHeader
        title="Sponsors"
        descriptionAsTooltip
        description="GET /admin/sponsors. Per sponsor: name, optional team, and an image (upload via misc uploads or paste a URL). Use New sponsor to add a record."
        actions={
          <Link to="/sponsors/new" className="btn-primary btn--with-icon">
            <Plus size={18} strokeWidth={2} aria-hidden />
            New sponsor
          </Link>
        }
      />
      {!q.isLoading && !q.isError ? (
        <div className="catalog-browse">
          <div className="catalog-toolbar">
            <input
              type="search"
              className="catalog-toolbar__search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sponsors…"
              aria-label="Filter results"
            />
          </div>
        </div>
      ) : null}
      {q.isLoading ? (
        <p className="muted">Loading…</p>
      ) : q.isError ? (
        <p className="login-error">{q.error.message}</p>
      ) : (
        <EntityTable
          columns={columns}
          data={queryFilteredRows}
          hideToolbar
          onRowClick={(row) =>
            void navigate({
              to: '/sponsors/$sponsorId',
              params: { sponsorId: String(row.id) },
            })
          }
        />
      )}
    </>
  )
}
