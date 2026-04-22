import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import type { AuditLogDto } from '@/lib/api-types'
import { adminListAll } from '@/lib/admin-client'
import { CatalogFilterGrid } from '@/components/CatalogFilterGrid'
import { EntityTable } from '@/components/EntityTable'
import { ListViewModeSwitch } from '@/components/ListViewModeSwitch'
import { PageHeader } from '@/components/PageHeader'
import { useListViewMode } from '@/hooks/useListViewMode'

export const Route = createFileRoute('/_shell/audit/')({
  component: AuditPage,
})

type AuditRow = AuditLogDto & {
  actor_display: string
  at_short: string
}

function AuditPage() {
  const [mode, setMode] = useListViewMode('audit', 'table')
  const navigate = useNavigate()
  const q = useQuery({
    queryKey: ['admin', 'audit-logs'],
    queryFn: () => adminListAll<AuditLogDto>('/admin/audit-logs'),
  })

  const rows: AuditRow[] = (q.data ?? []).map((e) => ({
    ...e,
    actor_display: e.actor_email ?? (e.actor_user_id != null ? `#${e.actor_user_id}` : '—'),
    at_short: String(e.created_at).replace('T', ' ').slice(0, 19),
  }))

  const columns: ColumnDef<AuditRow, unknown>[] = [
    { accessorKey: 'at_short', header: 'When' },
    { accessorKey: 'actor_display', header: 'Actor' },
    { accessorKey: 'action', header: 'Action' },
    { accessorKey: 'entity_type', header: 'Entity' },
    { accessorKey: 'entity_id', header: 'ID' },
    { accessorKey: 'summary', header: 'Summary' },
  ]

  return (
    <>
      <PageHeader
        title="Audit log"
        descriptionAsTooltip
        description="GET /admin/audit-logs. Cards group each entry for quick scanning; table view stays best for dense review."
      />
      {!q.isLoading && !q.isError && mode !== 'cards' ? (
        <div className="catalog-page-toolbar">
          <ListViewModeSwitch value={mode} onChange={setMode} />
        </div>
      ) : null}
      {q.isLoading ? (
        <p className="muted">Loading…</p>
      ) : q.isError ? (
        <p className="login-error">{q.error.message}</p>
      ) : mode === 'cards' ? (
        <CatalogFilterGrid
          items={rows}
          getKey={(r) => r.id}
          getSearchText={(r) =>
            [
              r.at_short,
              r.actor_display,
              r.action,
              r.entity_type,
              r.entity_id,
              r.summary,
            ]
              .filter(Boolean)
              .join(' ')
          }
          searchPlaceholder="Search audit entries…"
          toolbarLeading={
            <ListViewModeSwitch value={mode} onChange={setMode} />
          }
          renderCard={(e) => (
            <button
              type="button"
              className="entity-thumb-card"
              onClick={() =>
                void navigate({
                  to: '/audit/$auditId',
                  params: { auditId: String(e.id) },
                })
              }
            >
              <div className="entity-thumb-card__media">
                <span className="entity-thumb-media-placeholder" aria-hidden>
                  {(e.action?.charAt(0) ?? 'A').toUpperCase()}
                </span>
              </div>
              <div className="entity-thumb-card__body">
                <h3 className="entity-thumb-card__title">{e.action}</h3>
                <p className="entity-thumb-card__meta muted">
                  {e.at_short}
                  <br />
                  {e.actor_display} · {e.entity_type} #{e.entity_id}
                </p>
              </div>
              <div className="entity-thumb-card__footer">
                <span className="entity-thumb-card__link-hint">
                  {e.summary
                    ? e.summary.length > 72
                      ? `${e.summary.slice(0, 72)}…`
                      : e.summary
                    : '—'}
                </span>
              </div>
            </button>
          )}
        />
      ) : (
        <EntityTable
          columns={columns}
          data={rows}
          globalFilterPlaceholder="Search audit entries…"
          onRowClick={(row) =>
            void navigate({
              to: '/audit/$auditId',
              params: { auditId: String(row.id) },
            })
          }
        />
      )}
    </>
  )
}
