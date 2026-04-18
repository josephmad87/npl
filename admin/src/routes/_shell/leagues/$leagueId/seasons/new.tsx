import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { LeagueDto, SeasonDto } from '@/lib/api-types'
import { adminListAll, adminPost } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { InlineEditForm } from '@/components/InlineEditForm'
import { PageHeader } from '@/components/PageHeader'

export const Route = createFileRoute('/_shell/leagues/$leagueId/seasons/new')({
  component: NewSeasonPage,
})

const STATUSES = ['upcoming', 'active', 'completed', 'archived'] as const

function NewSeasonPage() {
  const { leagueId } = Route.useParams()
  const lid = Number(leagueId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const leaguesQ = useQuery({
    queryKey: ['admin', 'leagues'],
    queryFn: () => adminListAll<LeagueDto>('/admin/leagues'),
  })

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('upcoming')
  const [teamIdsText, setTeamIdsText] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  const league = leaguesQ.data?.find((l) => l.id === lid)

  const save = async () => {
    const n = name.trim()
    const s = slug.trim()
    if (!n) {
      setSaveError('Season name is required.')
      return
    }
    if (!s) {
      setSaveError('Season slug is required.')
      return
    }
    const team_ids = teamIdsText
      .split(/[,\s]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x))
    setSaveError(null)
    try {
      const created = await adminPost<SeasonDto>(`/admin/leagues/${lid}/seasons`, {
        name: n,
        slug: s,
        start_date: startDate.trim() || null,
        end_date: endDate.trim() || null,
        status,
        team_ids: team_ids.length > 0 ? team_ids : null,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'seasons', lid] })
      void navigate({
        to: '/leagues/$leagueId/seasons/$seasonId',
        params: { leagueId: String(lid), seasonId: String(created.id) },
      })
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Create failed')
    }
  }

  if (!Number.isFinite(lid)) {
    return <p className="login-error">Invalid league.</p>
  }
  if (leaguesQ.isLoading) {
    return <p className="muted">Loading…</p>
  }
  if (leaguesQ.isError) {
    return <p className="login-error">{leaguesQ.error.message}</p>
  }
  if (!league) {
    return <p className="login-error">League not found.</p>
  }

  return (
    <>
      <PageHeader
        title={`New season — ${league.name}`}
        descriptionAsTooltip
        description="POST /admin/leagues/{id}/seasons"
        actions={
          <BackNavLink
            to="/leagues/$leagueId/seasons"
            params={{ leagueId: String(lid) }}
          >
            Seasons
          </BackNavLink>
        }
      />
      <InlineEditForm
        error={saveError}
        onCancel={() =>
          void navigate({
            to: '/leagues/$leagueId/seasons',
            params: { leagueId: String(lid) },
          })
        }
        onSave={() => void save()}
        fields={[
          {
            id: 'name',
            label: 'Season name',
            control: (
              <input
                id="name"
                className="inline-edit__control"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            ),
          },
          {
            id: 'slug',
            label: 'Season slug (unique within this league)',
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
            id: 'start_date',
            label: 'Start date',
            control: (
              <input
                id="start_date"
                type="date"
                className="inline-edit__control"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            ),
          },
          {
            id: 'end_date',
            label: 'End date',
            control: (
              <input
                id="end_date"
                type="date"
                className="inline-edit__control"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
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
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            ),
          },
          {
            id: 'team_ids',
            label: 'Team IDs (comma-separated, optional)',
            control: (
              <input
                id="team_ids"
                className="inline-edit__control"
                value={teamIdsText}
                onChange={(e) => setTeamIdsText(e.target.value)}
                placeholder="e.g. 1, 2, 3"
              />
            ),
          },
        ]}
      />
    </>
  )
}
