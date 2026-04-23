import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Save } from 'lucide-react'
import { useState } from 'react'
import type { UserMe, UserMePatch } from '@/lib/api-types'
import { ApiError } from '@/lib/api'
import { adminGet, adminPatch } from '@/lib/admin-client'
import { DetailFields } from '@/components/DetailFields'
import { PageHeader } from '@/components/PageHeader'
import { SectionHintTip } from '@/components/SectionHintTip'
import { StatusBadge } from '@/components/StatusBadge'
import { parseAdminRole, patchSession, roleLabel } from '@/lib/session'

export const Route = createFileRoute('/_shell/profile')({
  component: MyProfilePage,
})

function MyProfilePage() {
  const queryClient = useQueryClient()
  const q = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => adminGet<UserMe>('/auth/me'),
    refetchOnWindowFocus: false,
  })

  const [nameOverride, setNameOverride] = useState<string | null>(null)
  const fullName =
    nameOverride !== null ? nameOverride : (q.data?.full_name ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: (body: UserMePatch) => adminPatch<UserMe>('/auth/me', body),
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data)
      patchSession({
        name: data.full_name ?? data.email,
      })
      setNameOverride(null)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setFormError(null)
      setSavedFlash(`Profile updated at ${new Date().toLocaleString()}`)
    },
    onError: (e: unknown) => {
      setSavedFlash(null)
      if (e instanceof ApiError) {
        setFormError(e.message)
        return
      }
      setFormError(e instanceof Error ? e.message : 'Save failed')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSavedFlash(null)

    const body: UserMePatch = {}
    const trimmedName = fullName.trim()
    const serverName = (q.data?.full_name ?? '').trim()
    if (trimmedName !== serverName) {
      body.full_name = trimmedName.length > 0 ? trimmedName : null
    }

    const wantPw =
      newPassword.length > 0 ||
      currentPassword.length > 0 ||
      confirmPassword.length > 0
    if (wantPw) {
      if (!currentPassword) {
        setFormError('Enter your current password to set a new one.')
        return
      }
      if (newPassword.length < 8) {
        setFormError('New password must be at least 8 characters.')
        return
      }
      if (newPassword !== confirmPassword) {
        setFormError('New password and confirmation do not match.')
        return
      }
      body.current_password = currentPassword
      body.new_password = newPassword
    }

    if (Object.keys(body).length === 0) {
      setFormError('No changes to save.')
      return
    }

    saveMutation.mutate(body)
  }

  return (
    <>
      <PageHeader
        title="My profile"
        descriptionAsTooltip
        description="Update your display name and password. Email and role are managed by an administrator. PATCH /auth/me."
      />

      {q.isLoading ? (
        <p className="muted">Loading…</p>
      ) : q.isError ? (
        <p className="login-error">{q.error.message}</p>
      ) : q.data ? (
        <section className="profile-page profile-page--split">
          <div className="profile-page__column">
            <h2 className="profile-page__eyebrow">Account</h2>
            <DetailFields
              items={[
                { label: 'Email', value: q.data.email },
                {
                  label: 'Role',
                  value: (
                    <span className="badge badge--role">
                      {roleLabel(parseAdminRole(q.data.role))}
                    </span>
                  ),
                },
                {
                  label: 'Status',
                  value: (
                    <StatusBadge
                      status={q.data.is_active ? 'active' : 'inactive'}
                    />
                  ),
                },
                {
                  label: 'Member since',
                  value: new Date(q.data.created_at).toLocaleString(),
                },
              ]}
            />
          </div>

          <div className="profile-page__column">
            <div className="settings-panel profile-page__panel">
              <h2 className="profile-page__eyebrow">Profile & security</h2>
              <form
                className="settings-form profile-page__form"
                onSubmit={handleSubmit}
              >
                <div className="settings-form__group">
                  <label
                    className="settings-form__label settings-form__label--with-tip"
                    htmlFor="profile_full_name"
                  >
                    <span>Display name</span>
                    <SectionHintTip ariaHelp="Shown in the header after you save. Leave blank to clear.">
                      <span className="section-hint-tip__text">
                        Shown in the header after you save. Leave blank to clear.
                      </span>
                    </SectionHintTip>
                  </label>
                  <input
                    id="profile_full_name"
                    className="inline-edit__control"
                    value={fullName}
                    onChange={(e) => setNameOverride(e.target.value)}
                    maxLength={255}
                    autoComplete="name"
                  />
                </div>

                <div className="profile-page__divider" />

                <h3 className="profile-section-title">Change password</h3>
                <p className="profile-page__hint muted">
                  Optional. Leave all three fields empty to keep your current
                  password.
                </p>

                <div className="settings-form__group">
                  <label
                    className="settings-form__label"
                    htmlFor="profile_current_pw"
                  >
                    Current password
                  </label>
                  <input
                    id="profile_current_pw"
                    type="password"
                    className="inline-edit__control"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div className="settings-form__group">
                  <label
                    className="settings-form__label"
                    htmlFor="profile_new_pw"
                  >
                    New password
                  </label>
                  <input
                    id="profile_new_pw"
                    type="password"
                    className="inline-edit__control"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>
                <div className="settings-form__group">
                  <label
                    className="settings-form__label"
                    htmlFor="profile_confirm_pw"
                  >
                    Confirm new password
                  </label>
                  <input
                    id="profile_confirm_pw"
                    type="password"
                    className="inline-edit__control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                {formError ? (
                  <p className="settings-form__error">{formError}</p>
                ) : null}
                {savedFlash ? (
                  <p className="settings-panel__saved">{savedFlash}</p>
                ) : null}

                <div className="settings-form__actions">
                  <button
                    type="submit"
                    className="btn-primary btn--with-icon"
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? (
                      <Loader2
                        size={18}
                        strokeWidth={2}
                        className="npl-icon-spin"
                        aria-hidden
                      />
                    ) : (
                      <Save size={18} strokeWidth={2} aria-hidden />
                    )}
                    {saveMutation.isPending ? 'Saving…' : 'Save profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      ) : null}
    </>
  )
}
