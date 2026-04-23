import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { SponsorDto, TeamDto } from '@/lib/api-types'
import { adminListAll, adminPost } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { InlineEditForm } from '@/components/InlineEditForm'
import { MediaUrlField } from '@/components/MediaUrlField'
import { PageHeader } from '@/components/PageHeader'

export const Route = createFileRoute('/_shell/sponsors/new')({
  component: NewSponsorPage,
})

function NewSponsorPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const teamsQ = useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: () => adminListAll<TeamDto>('/admin/teams'),
  })
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [teamId, setTeamId] = useState<number | ''>('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const teamOptions = teamsQ.data ?? []

  const save = async () => {
    if (isSaving) return
    const n = name.trim()
    if (!n) {
      setSaveError('Name is required.')
      return
    }
    setSaveError(null)
    setIsSaving(true)
    try {
      const created = await adminPost<SponsorDto>('/admin/sponsors', {
        name: n,
        image_url: (imageUrl ?? '').trim(),
        team_id: teamId === '' ? null : teamId,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'sponsors'] })
      void navigate({
        to: '/sponsors/$sponsorId',
        params: { sponsorId: String(created.id) },
      })
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setIsSaving(false)
    }
  }

  if (teamsQ.isLoading) {
    return <p className="muted">Loading teams…</p>
  }
  if (teamsQ.isError) {
    return <p className="login-error">{teamsQ.error.message}</p>
  }

  return (
    <>
      <PageHeader
        title="New sponsor"
        descriptionAsTooltip
        description="POST /admin/sponsors"
        actions={
          <BackNavLink to="/sponsors">Sponsors</BackNavLink>
        }
      />
      <InlineEditForm
        error={saveError}
        isSaving={isSaving}
        saveLabel="Create sponsor"
        savingLabel="Creating…"
        onCancel={() => void navigate({ to: '/sponsors' })}
        onSave={() => void save()}
        fields={[
          {
            id: 'name',
            label: 'Name',
            control: (
              <input
                id="name"
                className="inline-edit__control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSaving}
                maxLength={255}
                autoComplete="organization"
              />
            ),
          },
          {
            id: 'image_url',
            label: 'Image',
            control: (
              <MediaUrlField
                id="image_url"
                uploadKind="misc"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml,image/bmp,image/tiff,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.avif,.svg,.bmp,.tif,.tiff,.heic,.heif"
                value={imageUrl}
                onChange={setImageUrl}
                disabled={isSaving}
              />
            ),
          },
          {
            id: 'team_id',
            label: 'Team',
            control: (
              <select
                id="team_id"
                className="inline-edit__control"
                value={teamId === '' ? '' : String(teamId)}
                onChange={(e) => {
                  const v = e.target.value
                  setTeamId(v === '' ? '' : Number(v))
                }}
                disabled={isSaving}
              >
                <option value="">— None —</option>
                {teamOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
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
