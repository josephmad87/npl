import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import type { ContactMessageDto } from '@/lib/api-types'
import { adminGet, adminPatch } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { DetailFields } from '@/components/DetailFields'
import { PageHeader } from '@/components/PageHeader'

export const Route = createFileRoute('/_shell/contact-messages/$messageId')({
  component: ContactMessageDetailPage,
})

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function ContactMessageDetailPage() {
  const { messageId } = Route.useParams()
  const mid = Number(messageId)
  const queryClient = useQueryClient()
  const q = useQuery({
    queryKey: ['admin', 'contact-message', mid],
    queryFn: () => adminGet<ContactMessageDto>(`/admin/contact-messages/${mid}`),
    enabled: Number.isFinite(mid),
  })

  const item = q.data

  useEffect(() => {
    if (!item || item.read_at) return
    void (async () => {
      try {
        await adminPatch<ContactMessageDto>(`/admin/contact-messages/${mid}`, {
          read: true,
        })
        await queryClient.invalidateQueries({
          queryKey: ['admin', 'contact-messages'],
        })
        await queryClient.invalidateQueries({
          queryKey: ['admin', 'contact-message', mid],
        })
      } catch {
        /* non-blocking */
      }
    })()
  }, [item, mid, queryClient])

  const markUnread = async () => {
    if (!item) return
    await adminPatch<ContactMessageDto>(`/admin/contact-messages/${mid}`, {
      read: false,
    })
    await queryClient.invalidateQueries({ queryKey: ['admin', 'contact-messages'] })
    await queryClient.invalidateQueries({ queryKey: ['admin', 'contact-message', mid] })
  }

  if (q.isLoading) return <p className="muted">Loading…</p>
  if (q.isError) return <p className="login-error">{q.error.message}</p>
  if (!item || !Number.isFinite(mid)) {
    return (
      <>
        <PageHeader title="Message not found" />
        <BackNavLink to="/contact-messages">Contact messages</BackNavLink>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={item.full_name}
        description={`Received ${formatWhen(item.created_at)}`}
        actions={
          <>
            <BackNavLink to="/contact-messages">Contact messages</BackNavLink>
            {item.read_at ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => void markUnread()}
              >
                Mark unread
              </button>
            ) : null}
          </>
        }
      />
      <DetailFields
        items={[
          { label: 'Name', value: item.full_name },
          {
            label: 'Email',
            value: (
              <a href={`mailto:${item.email}`}>{item.email}</a>
            ),
          },
          { label: 'Phone', value: item.phone?.trim() ?? '—' },
          { label: 'Status', value: item.read_at ? 'Read' : 'Unread' },
          { label: 'Read at', value: formatWhen(item.read_at) },
          {
            label: 'Message',
            value: (
              <span style={{ whiteSpace: 'pre-wrap' }}>{item.message}</span>
            ),
          },
        ]}
      />
    </>
  )
}
