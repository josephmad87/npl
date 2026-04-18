import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { UserDto } from '@/lib/api-types'
import { adminListAll } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { DetailFields } from '@/components/DetailFields'
import { PageHeader } from '@/components/PageHeader'
import { SectionHintTip } from '@/components/SectionHintTip'
import { StatusBadge } from '@/components/StatusBadge'

export const Route = createFileRoute('/_shell/users/$userId')({
  component: UserDetailPage,
})

function UserDetailPage() {
  const { userId } = Route.useParams()
  const uid = Number(userId)
  const listQ = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminListAll<UserDto>('/admin/users'),
  })
  const user = listQ.data?.find((u) => u.id === uid)

  if (listQ.isLoading) {
    return <p className="muted">Loading…</p>
  }
  if (listQ.isError) {
    return <p className="login-error">{listQ.error.message}</p>
  }
  if (!user || !Number.isFinite(uid)) {
    return (
      <>
        <PageHeader title="User not found" />
        <BackNavLink to="/users">Back to users</BackNavLink>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={user.full_name ?? user.email}
        description={user.email}
        actions={
          <BackNavLink to="/users">Users</BackNavLink>
        }
        titleAccessory={
          <SectionHintTip ariaHelp="User updates are not exposed on this admin route yet; manage accounts via the API or future PATCH /admin/users/{id}.">
            <span className="section-hint-tip__text">
              User updates are not exposed on this admin route yet; manage
              accounts via the API or future{' '}
              <code>PATCH /admin/users/&#123;id&#125;</code>.
            </span>
          </SectionHintTip>
        }
      />
      <DetailFields
        items={[
          { label: 'Role', value: user.role },
          {
            label: 'Status',
            value: (
              <StatusBadge status={user.is_active ? 'active' : 'inactive'} />
            ),
          },
          {
            label: 'Created',
            value: String(user.created_at).slice(0, 19),
          },
          { label: 'ID', value: String(user.id) },
        ]}
      />
    </>
  )
}
