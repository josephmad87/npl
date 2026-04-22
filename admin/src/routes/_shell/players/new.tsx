import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { PlayerDto, TeamDto } from '@/lib/api-types'
import { adminListAll, adminPost } from '@/lib/admin-client'
import { CompetitionCategorySelect } from '@/components/CompetitionCategorySelect'
import { BackNavLink } from '@/components/BackNavLink'
import { InlineEditForm } from '@/components/InlineEditForm'
import { MediaUrlField } from '@/components/MediaUrlField'
import { PageHeader } from '@/components/PageHeader'

export const Route = createFileRoute('/_shell/players/new')({
  component: NewPlayerPage,
})

const STATUSES = ['active', 'inactive', 'injured'] as const

function NewPlayerPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const teamsQ = useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: () => adminListAll<TeamDto>('/admin/teams'),
  })

  const [fullName, setFullName] = useState('')
  const [slug, setSlug] = useState('')
  const [teamId, setTeamId] = useState<number | null>(null)
  const [category, setCategory] = useState('mens')
  const [role, setRole] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('active')
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const teamOptions = teamsQ.data ?? []

  const save = async () => {
    const fn = fullName.trim()
    const sl = slug.trim()
    const cat = category.trim()
    if (!fn) {
      setSaveError('Full name is required.')
      return
    }
    if (!sl) {
      setSaveError('Slug is required.')
      return
    }
    if (!cat) {
      setSaveError('Category is required.')
      return
    }
    const resolvedTeamId = teamId ?? teamOptions[0]?.id ?? 0
    if (!Number.isFinite(resolvedTeamId) || resolvedTeamId <= 0) {
      setSaveError('Select a team.')
      return
    }
    setSaveError(null)
    try {
      const created = await adminPost<PlayerDto>('/admin/players', {
        full_name: fn,
        slug: sl,
        team_id: resolvedTeamId,
        category: cat,
        role: role.trim() || null,
        jersey_number: jerseyNumber.trim() ? Number(jerseyNumber) : null,
        status,
        profile_photo_url: profilePhotoUrl?.trim() ?? null,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'players'] })
      void navigate({
        to: '/players/$playerId',
        params: { playerId: String(created.id) },
      })
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Create failed')
    }
  }

  if (teamsQ.isLoading) {
    return <p className="muted">Loading teams…</p>
  }
  if (teamsQ.isError) {
    return <p className="login-error">{teamsQ.error.message}</p>
  }
  if (teamOptions.length === 0) {
    return (
      <>
        <PageHeader
          title="New player"
          descriptionAsTooltip
          description="POST /admin/players"
        />
        <p className="login-error">Create at least one team before adding players.</p>
        <Link to="/teams/new" className="btn-primary btn--with-icon">
          <Plus size={18} strokeWidth={2} aria-hidden />
          New team
        </Link>
      </>
    )
  }

  const resolvedTeamId = teamId ?? teamOptions[0]?.id ?? 0

  return (
    <>
      <PageHeader
        title="New player"
        descriptionAsTooltip
        description="POST /admin/players"
        actions={
          <BackNavLink to="/players">Players</BackNavLink>
        }
      />
      <InlineEditForm
        error={saveError}
        onCancel={() => void navigate({ to: '/players' })}
        onSave={() => void save()}
        fields={[
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
            id: 'slug',
            label: 'Slug',
            control: (
              <input
                id="slug"
                className="inline-edit__control"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
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
                value={resolvedTeamId}
                onChange={(e) => setTeamId(Number(e.target.value))}
              >
                {teamOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ),
          },
          {
            id: 'category',
            label: 'Category',
            control: (
              <CompetitionCategorySelect
                id="category"
                className="inline-edit__control"
                value={category}
                onChange={setCategory}
              />
            ),
          },
          {
            id: 'role',
            label: 'Role',
            control: (
              <input
                id="role"
                className="inline-edit__control"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            ),
          },
          {
            id: 'jersey_number',
            label: 'Jersey number',
            control: (
              <input
                id="jersey_number"
                type="number"
                min={0}
                className="inline-edit__control"
                value={jerseyNumber}
                onChange={(e) => setJerseyNumber(e.target.value)}
              />
            ),
          },
          {
            id: 'profile_photo_url',
            label: 'Profile photo (image)',
            control: (
              <MediaUrlField
                id="profile_photo_url"
                uploadKind="players"
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                value={profilePhotoUrl}
                onChange={setProfilePhotoUrl}
              />
            ),
          },
          {
            id: 'status',
            label: 'Status',
            control: (
              <select
                id="status"
                className="inline-edit__control"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as (typeof STATUSES)[number])
                }
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
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
