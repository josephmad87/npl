import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SquarePen, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { SponsorDto, TeamDto } from '@/lib/api-types'
import { adminDelete, adminGet, adminListAll, adminPatch } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { DetailFields } from '@/components/DetailFields'
import { InlineEditForm } from '@/components/InlineEditForm'
import { MediaUrlField } from '@/components/MediaUrlField'
import { PageHeader } from '@/components/PageHeader'
import { parseDetailRouteSearch } from '@/lib/detail-route-search'
import { resolveAdminMediaUrl } from '@/lib/media-url'

export const Route = createFileRoute('/_shell/sponsors/$sponsorId')({
  validateSearch: parseDetailRouteSearch,
  component: SponsorDetailPage,
})

function SponsorDetailPage() {
  const { sponsorId } = Route.useParams()
  const sid = Number(sponsorId)
  const { mode } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const q = useQuery({
    queryKey: ['admin', 'sponsor', sid],
    queryFn: () => adminGet<SponsorDto>(`/admin/sponsors/${sid}`),
    enabled: Number.isFinite(sid),
  })
  const teamsQ = useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: () => adminListAll<TeamDto>('/admin/teams'),
  })
  const item = q.data
  const isEditing = mode === 'edit'
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [teamId, setTeamId] = useState<number | ''>('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const editPrimed = useRef<number | null>(null)

  const teamOptions = teamsQ.data ?? []

  useEffect(() => {
    if (!isEditing) {
      editPrimed.current = null
      return
    }
    if (!item) return
    if (editPrimed.current === item.id) return
    setName(item.name)
    setImageUrl(item.image_url || null)
    setTeamId(item.team_id != null ? item.team_id : '')
    setSaveError(null)
    editPrimed.current = item.id
  }, [isEditing, item])

  const goView = () => {
    setSaveError(null)
    void navigate({
      to: '/sponsors/$sponsorId',
      params: { sponsorId: String(sid) },
      search: {},
    })
  }

  const beginEdit = () => {
    if (!item) return
    void navigate({
      to: '/sponsors/$sponsorId',
      params: { sponsorId: String(item.id) },
      search: { mode: 'edit' },
    })
  }

  const save = async () => {
    if (isSaving || !item || !Number.isFinite(sid)) return
    const n = name.trim()
    if (!n) {
      setSaveError('Name is required.')
      return
    }
    setIsSaving(true)
    setSaveError(null)
    try {
      await adminPatch<SponsorDto>(`/admin/sponsors/${sid}`, {
        name: n,
        image_url: (imageUrl ?? '').trim(),
        team_id: teamId === '' ? null : teamId,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'sponsors'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'sponsor', sid] })
      void navigate({
        to: '/sponsors/$sponsorId',
        params: { sponsorId: String(sid) },
        search: {},
      })
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async () => {
    if (isDeleting || !item) return
    const ok = globalThis.confirm(
      `Delete sponsor "${item.name}"? This cannot be undone.`,
    )
    if (!ok) return
    setIsDeleting(true)
    setSaveError(null)
    try {
      await adminDelete(`/admin/sponsors/${sid}`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'sponsors'] })
      void navigate({ to: '/sponsors' })
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Delete failed')
      setIsDeleting(false)
    }
  }

  if (q.isLoading || teamsQ.isLoading) {
    return <p className="muted">Loading…</p>
  }
  if (q.isError) {
    return <p className="login-error">{q.error.message}</p>
  }
  if (!item || !Number.isFinite(sid)) {
    return (
      <>
        <PageHeader title="Sponsor not found" />
        <BackNavLink to="/sponsors">Back to sponsors</BackNavLink>
      </>
    )
  }

  const resolvedImg = resolveAdminMediaUrl(item.image_url)

  return (
    <>
      <PageHeader
        title={isEditing ? (name || item.name) : item.name}
        description={`ID ${item.id}`}
        actions={
          <>
            <BackNavLink to="/sponsors">Sponsors</BackNavLink>
            {!isEditing ? (
              <button
                type="button"
                className="btn-primary btn--with-icon"
                onClick={beginEdit}
                disabled={isDeleting}
              >
                <SquarePen size={18} strokeWidth={2} aria-hidden />
                Edit
              </button>
            ) : null}
            <button
              type="button"
              className="btn-ghost btn--with-icon"
              onClick={() => void remove()}
              disabled={isDeleting || isSaving}
            >
              <Trash2 size={18} strokeWidth={2} aria-hidden />
              {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      />
      {isEditing ? (
        <InlineEditForm
          error={saveError}
          isSaving={isSaving}
          savingLabel="Saving…"
          onCancel={goView}
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
      ) : (
        <DetailFields
          items={[
            { label: 'Name', value: item.name },
            { label: 'Team', value: item.team_name ?? '—' },
            {
              label: 'Image',
              value: resolvedImg ? (
                <img
                  src={resolvedImg}
                  alt=""
                  style={{ maxWidth: 200, maxHeight: 80, objectFit: 'contain' }}
                />
              ) : (
                '—'
              ),
            },
            {
              label: 'Image URL',
              value: item.image_url || '—',
            },
            {
              label: 'Created',
              value: String(item.created_at).slice(0, 19).replace('T', ' '),
            },
          ]}
        />
      )}
    </>
  )
}
