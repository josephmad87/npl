import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type {
  AboutContentBodyDto,
  AboutContentDto,
  AboutTeamMemberDto,
} from '@/lib/api-types'
import { adminGet, adminPatch } from '@/lib/admin-client'
import { ApiError } from '@/lib/api'
import { MediaUrlField } from '@/components/MediaUrlField'
import { PageHeader } from '@/components/PageHeader'

export const Route = createFileRoute('/_shell/about/')({
  component: AboutPage,
})

const emptyRow = (): AboutTeamMemberDto => ({ position: '', picture_url: '' })

type AboutFormProps = {
  data: AboutContentDto
}

function AboutForm({ data }: AboutFormProps) {
  const queryClient = useQueryClient()
  const [mission, setMission] = useState(data.mission)
  const [vision, setVision] = useState(data.vision)
  const [history, setHistory] = useState(data.history)
  const [teamRows, setTeamRows] = useState<AboutTeamMemberDto[]>(
    (data.team?.length ? data.team : [emptyRow()]).map((r) => ({
      position: r.position ?? '',
      picture_url: r.picture_url ?? '',
    })),
  )
  const [emailsText, setEmailsText] = useState(
    (data.contacts?.emails ?? []).join('\n'),
  )
  const [phone, setPhone] = useState(data.contacts?.phone ?? '')
  const [physicalAddress, setPhysicalAddress] = useState(
    data.physical_address ?? '',
  )
  const saveMutation = useMutation({
    mutationFn: (body: AboutContentBodyDto) =>
      adminPatch<AboutContentDto>('/admin/about', body),
    onSuccess: (next) => {
      queryClient.setQueryData(['admin', 'about'], next)
    },
  })

  const formError = saveMutation.isError
    ? saveMutation.error instanceof ApiError
      ? saveMutation.error.message
      : saveMutation.error instanceof Error
        ? saveMutation.error.message
        : 'Save failed'
    : null

  function setTeamField(
    i: number,
    patch: Partial<AboutTeamMemberDto>,
  ) {
    setTeamRows((rows) => {
      const next = rows.slice()
      const cur = next[i] ?? emptyRow()
      next[i] = { ...cur, ...patch }
      return next
    })
  }

  const handleSave = () => {
    const team =
      teamRows.length === 0
        ? []
        : teamRows.map((r) => ({
            position: r.position.trim(),
            picture_url: (r.picture_url ?? '').trim(),
          }))
    const body: AboutContentBodyDto = {
      mission: mission.trim(),
      vision: vision.trim(),
      history: history.trim(),
      team,
      contacts: {
        emails: emailsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        phone: phone.trim(),
      },
      physical_address: physicalAddress.trim(),
    }
    saveMutation.mutate(body)
  }

  return (
    <form
      className="settings-form"
      onSubmit={(e) => {
        e.preventDefault()
        handleSave()
      }}
    >
      <p className="settings-form__meta">
        Last updated: {new Date(data.updated_at).toLocaleString()}
      </p>

        <div className="settings-form__group">
          <h2 className="about-form__h2" id="section-mission">
            Mission
          </h2>
          <textarea
            id="mission"
            className="inline-edit__control"
            rows={5}
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            maxLength={20000}
            aria-labelledby="section-mission"
          />
        </div>

        <div className="settings-form__group">
          <h2 className="about-form__h2" id="section-vision">
            Vision
          </h2>
          <textarea
            id="vision"
            className="inline-edit__control"
            rows={5}
            value={vision}
            onChange={(e) => setVision(e.target.value)}
            maxLength={20000}
            aria-labelledby="section-vision"
          />
        </div>

        <div className="settings-form__group">
          <h2 className="about-form__h2" id="section-history">
            History
          </h2>
          <textarea
            id="history"
            className="inline-edit__control"
            rows={6}
            value={history}
            onChange={(e) => setHistory(e.target.value)}
            maxLength={40000}
            aria-labelledby="section-history"
          />
        </div>

        <div className="settings-form__group">
          <h2 className="about-form__h2" id="section-team">
            Team
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Position and picture for each person. Upload images or paste URLs.
          </p>
          {teamRows.map((row, i) => (
            <div
              className="about-form__team-row"
              key={`team-${i}`}
            >
              <div>
                <label
                  className="settings-form__label"
                  htmlFor={`pos-${i}`}
                >
                  Position
                </label>
                <input
                  id={`pos-${i}`}
                  className="inline-edit__control"
                  value={row.position}
                  onChange={(e) =>
                    setTeamField(i, { position: e.target.value })
                  }
                  placeholder="e.g. Chair, Operations"
                  maxLength={200}
                />
              </div>
              <div className="about-form__team-picture">
                <label
                  className="settings-form__label"
                  htmlFor={`pic-${i}`}
                >
                  Picture
                </label>
                <MediaUrlField
                  id={`pic-${i}`}
                  uploadKind="misc"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml,image/bmp,image/tiff,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.avif,.svg,.bmp,.tif,.tiff,.heic,.heif"
                  value={row.picture_url}
                  onChange={(u) => setTeamField(i, { picture_url: u ?? '' })}
                />
              </div>
              <div className="about-form__team-actions">
                <button
                  type="button"
                  className="btn-ghost btn--with-icon"
                  onClick={() =>
                    setTeamRows((rows) => rows.filter((_, j) => j !== i))
                  }
                  aria-label="Remove person"
                >
                  <Trash2 size={18} strokeWidth={2} aria-hidden />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary btn--with-icon"
            onClick={() => setTeamRows((rows) => [...rows, emptyRow()])}
          >
            <Plus size={18} strokeWidth={2} aria-hidden />
            Add person
          </button>
        </div>

        <div className="settings-form__group">
          <h2 className="about-form__h2" id="section-contacts">
            Contacts
          </h2>
          <div>
            <label
              className="settings-form__label"
              htmlFor="emails"
            >
              Emails
            </label>
            <textarea
              id="emails"
              className="inline-edit__control"
              rows={4}
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              placeholder="One email per line"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div>
            <label
              className="settings-form__label"
              htmlFor="phone"
            >
              Phone number
            </label>
            <input
              id="phone"
              className="inline-edit__control"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              autoComplete="tel"
              maxLength={64}
            />
          </div>
        </div>

        <div className="settings-form__group">
          <h2 className="about-form__h2" id="section-address">
            Physical address
          </h2>
          <textarea
            id="physical"
            className="inline-edit__control"
            rows={3}
            value={physicalAddress}
            onChange={(e) => setPhysicalAddress(e.target.value)}
            maxLength={2000}
            placeholder="Street, city, country"
            aria-labelledby="section-address"
          />
        </div>

        {formError ? <p className="settings-form__error">{formError}</p> : null}

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
          {saveMutation.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

function AboutPage() {
  const q = useQuery({
    queryKey: ['admin', 'about'],
    queryFn: () => adminGet<AboutContentDto>('/admin/about'),
    refetchOnWindowFocus: false,
  })
  let body: ReactNode
  if (q.isLoading) {
    body = <p className="muted settings-panel__intro">Loading about content…</p>
  } else if (q.isError) {
    body = (
      <p className="login-error settings-panel__intro">{q.error.message}</p>
    )
  } else if (q.data) {
    body = (
      <AboutForm
        key={q.data.updated_at}
        data={q.data}
      />
    )
  } else {
    body = null
  }

  return (
    <>
      <PageHeader
        title="About"
        descriptionAsTooltip
        description="GET/PATCH /admin/about. Mission, vision, history, team (position and picture), contact emails and phone, and physical address for the public site."
      />
      <div className="settings-panel">{body}</div>
    </>
  )
}
