import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { UserMe } from '@/lib/api-types'
import { adminPost } from '@/lib/admin-client'
import type { AdminRole } from '@/lib/session'
import { BackNavLink } from '@/components/BackNavLink'
import { InlineEditForm } from '@/components/InlineEditForm'
import { PageHeader } from '@/components/PageHeader'

export const Route = createFileRoute('/_shell/users/new')({
  component: NewAdminUserPage,
})

const ROLES: { value: AdminRole; label: string }[] = [
  { value: 'super_admin', label: 'Super admin' },
  { value: 'competition_manager', label: 'Competition manager' },
  { value: 'content_editor', label: 'Content editor' },
  { value: 'read_only_admin', label: 'Read-only admin' },
]

function NewAdminUserPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<AdminRole>('read_only_admin')
  const [saveError, setSaveError] = useState<string | null>(null)

  const save = async () => {
    const em = email.trim()
    if (!em) {
      setSaveError('Email is required.')
      return
    }
    if (password.length < 8) {
      setSaveError('Password must be at least 8 characters.')
      return
    }
    setSaveError(null)
    try {
      const created = await adminPost<UserMe>('/admin/users', {
        email: em,
        password,
        full_name: fullName.trim() || null,
        role,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      void navigate({
        to: '/users/$userId',
        params: { userId: String(created.id) },
      })
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Create failed')
    }
  }

  return (
    <>
      <PageHeader
        title="Invite admin user"
        descriptionAsTooltip
        description="POST /admin/users (super admin only)"
        actions={
          <BackNavLink to="/users">Users</BackNavLink>
        }
      />
      <InlineEditForm
        error={saveError}
        onCancel={() => void navigate({ to: '/users' })}
        onSave={() => void save()}
        fields={[
          {
            id: 'email',
            label: 'Email',
            control: (
              <input
                id="email"
                type="email"
                autoComplete="off"
                className="inline-edit__control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            ),
          },
          {
            id: 'password',
            label: 'Temporary password',
            control: (
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                className="inline-edit__control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            ),
          },
          {
            id: 'full_name',
            label: 'Full name',
            control: (
              <input
                id="full_name"
                className="inline-edit__control"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            ),
          },
          {
            id: 'role',
            label: 'Role',
            control: (
              <select
                id="role"
                className="inline-edit__control"
                value={role}
                onChange={(e) => setRole(e.target.value as AdminRole)}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            ),
          },
        ]}
      />
    </>
  )
}
