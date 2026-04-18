import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { AuditLogDto } from '@/lib/api-types'
import { adminListAll } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { DetailFields } from '@/components/DetailFields'
import { PageHeader } from '@/components/PageHeader'

export const Route = createFileRoute('/_shell/audit/$auditId')({
  component: AuditDetailPage,
})

function AuditDetailPage() {
  const { auditId } = Route.useParams()
  const id = Number(auditId)
  const q = useQuery({
    queryKey: ['admin', 'audit-logs'],
    queryFn: () => adminListAll<AuditLogDto>('/admin/audit-logs'),
  })
  const entry = q.data?.find((e) => e.id === id)

  if (q.isLoading) {
    return <p className="muted">Loading…</p>
  }
  if (q.isError) {
    return <p className="login-error">{q.error.message}</p>
  }
  if (!entry || !Number.isFinite(id)) {
    return (
      <>
        <PageHeader title="Audit entry not found" />
        <BackNavLink to="/audit">Back to audit log</BackNavLink>
      </>
    )
  }

  const actor =
    entry.actor_email ??
    (entry.actor_user_id != null ? `User #${entry.actor_user_id}` : '—')

  return (
    <>
      <PageHeader
        title={`${entry.action} · ${entry.entity_type}`}
        description={`${String(entry.created_at).replace('T', ' ').slice(0, 19)} · ID ${entry.id}`}
        actions={
          <BackNavLink to="/audit">Audit log</BackNavLink>
        }
      />
      <DetailFields
        items={[
          { label: 'Actor', value: actor },
          { label: 'Action', value: entry.action },
          { label: 'Entity type', value: entry.entity_type },
          { label: 'Entity id', value: entry.entity_id },
          { label: 'Timestamp', value: entry.created_at },
          { label: 'Summary', value: entry.summary ?? '—' },
        ]}
      />
    </>
  )
}
