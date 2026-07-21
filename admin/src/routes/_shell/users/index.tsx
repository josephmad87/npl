import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import type { UserDto } from '@/lib/api-types'
import { adminListAll, adminPatch } from '@/lib/admin-client'
import { CatalogFilterGrid } from '@/components/CatalogFilterGrid'
import { EntityTable } from '@/components/EntityTable'
import { ListViewModeSwitch } from '@/components/ListViewModeSwitch'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { useListViewMode } from '@/hooks/useListViewMode'

export const Route = createFileRoute('/_shell/users/')({
  component: UsersPage,
})

function userInitials(u: UserDto): string {
  const name = u.full_name?.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }
  const em = u.email?.trim() ?? '?'
  return em.slice(0, 2).toUpperCase()
}

const baseColumns: ColumnDef<UserDto, unknown>[] = [
  {
    accessorKey: 'full_name',
    header: 'Name',
    cell: ({ row }) => row.original.full_name ?? row.original.email,
  },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'role', header: 'Role' },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ getValue }) => (
      <StatusBadge status={getValue() ? 'active' : 'inactive'} />
    ),
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    cell: ({ getValue }) => String(getValue()).slice(0, 10),
  },
]

function UsersPage() {
  const [mode, setMode] = useListViewMode('users')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusError, setStatusError] = useState<string | null>(null)
  const q = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminListAll<UserDto>('/admin/users'),
  })

  const userStatusMutation = useMutation({
    mutationFn: ({ user, isActive }: { user: UserDto; isActive: boolean }) =>
      adminPatch<UserDto>(`/admin/users/${user.id}`, { is_active: isActive }),
    onSuccess: async () => {
      setStatusError(null)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: (error: Error) => setStatusError(error.message),
  })

  const changeScorerStatus = (user: UserDto, isActive: boolean) => {
    const label = user.full_name?.trim() || user.email
    const ok = window.confirm(
      isActive
        ? `Reactivate scorer account for ${label}?`
        : `Deactivate scorer account for ${label}? This will also remove the scorer from open fixtures.`,
    )

    if (!ok) return

    userStatusMutation.mutate({ user, isActive })
  }

  const columns = useMemo<ColumnDef<UserDto, unknown>[]>(
    () => [
      ...baseColumns,
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const user = row.original

          if (user.role !== 'scorer') {
            return <span className="muted">—</span>
          }

          return (
            <button
              type="button"
              className="btn-ghost"
              onClick={(event) => {
                event.stopPropagation()
                changeScorerStatus(user, !user.is_active)
              }}
              disabled={userStatusMutation.isPending}
            >
              {user.is_active ? 'Deactivate scorer' : 'Reactivate scorer'}
            </button>
          )
        },
      },
    ],
    [userStatusMutation.isPending],
  )

  const data = q.data ?? []
  const queryFilteredData = useMemo(() => {
    const source = q.data ?? []
    const needle = searchQuery.trim().toLowerCase()
    if (!needle) return source
    return source.filter((r) =>
      [r.full_name, r.email, r.role, String(r.is_active), r.created_at]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [q.data, searchQuery])

  return (
    <>
      <PageHeader
        title="Admin users"
        descriptionAsTooltip
        description="GET /admin/users (super admin only)."
        actions={
          <Link to="/users/new" className="btn-primary btn--with-icon">
            <Plus size={18} strokeWidth={2} aria-hidden />
            Invite user
          </Link>
        }
      />
      {statusError ? <p className="login-error">{statusError}</p> : null}
      {!q.isLoading && !q.isError && mode === 'table' ? (
        <div className="catalog-browse">
          <div className="catalog-toolbar">
            <div className="catalog-toolbar__leading">
              <ListViewModeSwitch value={mode} onChange={setMode} />
            </div>
            <input
              type="search"
              className="catalog-toolbar__search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users…"
              aria-label="Filter results"
            />
          </div>
        </div>
      ) : null}
      {q.isLoading ? (
        <p className="muted">Loading…</p>
      ) : q.isError ? (
        <p className="login-error">{q.error.message}</p>
      ) : mode === 'cards' ? (
        <CatalogFilterGrid
          items={data}
          getKey={(r) => r.id}
          getSearchText={(r) =>
            [r.full_name, r.email, r.role, String(r.is_active), r.created_at]
              .filter(Boolean)
              .join(' ')
          }
          searchPlaceholder="Search users…"
          toolbarLeading={
            <ListViewModeSwitch value={mode} onChange={setMode} />
          }
          query={searchQuery}
          onQueryChange={setSearchQuery}
          renderCard={(u) => (
            <Link
              to="/users/$userId"
              params={{ userId: String(u.id) }}
              className="entity-thumb-card"
            >
              <div className="entity-thumb-card__media">
                <span className="entity-thumb-media-placeholder" aria-hidden>
                  {userInitials(u)}
                </span>
              </div>
              <div className="entity-thumb-card__body">
                <h3 className="entity-thumb-card__title">
                  {u.full_name?.trim() || u.email}
                </h3>
                <p className="entity-thumb-card__meta muted">
                  {u.email}
                  <br />
                  {u.role} · {String(u.created_at).slice(0, 10)}
                </p>
              </div>
              <div className="entity-thumb-card__footer">
                <StatusBadge status={u.is_active ? 'active' : 'inactive'} />
                {u.role === 'scorer' ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      changeScorerStatus(u, !u.is_active)
                    }}
                    disabled={userStatusMutation.isPending}
                  >
                    {u.is_active ? 'Deactivate scorer' : 'Reactivate scorer'}
                  </button>
                ) : null}
              </div>
            </Link>
          )}
        />
      ) : (
        <EntityTable
          columns={columns}
          data={queryFilteredData}
          hideToolbar
          onRowClick={(row) =>
            void navigate({
              to: '/users/$userId',
              params: { userId: String(row.id) },
            })
          }
        />
      )}
    </>
  )
}
