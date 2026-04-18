import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SquarePen } from 'lucide-react'
import { useState } from 'react'
import type { SeasonDto } from '@/lib/api-types'
import { adminListAll, adminPatch } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { DetailFields } from '@/components/DetailFields'
import { InlineEditForm } from '@/components/InlineEditForm'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { parseDetailRouteSearch } from '@/lib/detail-route-search'

export const Route = createFileRoute(
  '/_shell/leagues/$leagueId/seasons/$seasonId',
)({
  validateSearch: parseDetailRouteSearch,
  component: SeasonDetailPage,
})

const STATUSES = ['upcoming', 'active', 'completed', 'archived'] as const

function SeasonDetailPage() {
  const { leagueId, seasonId } = Route.useParams()
  const lid = Number(leagueId)
  const sid = Number(seasonId)
  const { mode } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const seasonsQ = useQuery({
    queryKey: ['admin', 'seasons', lid],
    queryFn: () =>
      adminListAll<SeasonDto>(`/admin/seasons?league_id=${lid}`),
    enabled: Number.isFinite(lid),
  })

  const season = seasonsQ.data?.find((s) => s.id === sid)
  const isEditing = mode === 'edit'
  const [patch, setPatch] = useState<Partial<SeasonDto>>({})
  const [teamIdsText, setTeamIdsText] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  const merged: SeasonDto | null =
    season ? { ...season, ...patch } : null

  const goView = () => {
    if (!season) return
    setPatch({})
    setTeamIdsText('')
    setSaveError(null)
    void navigate({
      to: '/leagues/$leagueId/seasons/$seasonId',
      params: { leagueId: String(lid), seasonId: String(season.id) },
      search: {},
    })
  }

  const beginEdit = () => {
    if (!season) return
    setPatch({})
    setTeamIdsText((season.team_ids ?? []).join(', '))
    setSaveError(null)
    void navigate({
      to: '/leagues/$leagueId/seasons/$seasonId',
      params: { leagueId: String(lid), seasonId: String(season.id) },
      search: { mode: 'edit' },
    })
  }

  const save = async () => {
    if (!merged || !season || !Number.isFinite(sid)) return
    const name = merged.name.trim()
    if (!name) {
      setSaveError('Season name is required.')
      return
    }
    const team_ids = teamIdsText
      .split(/[,\s]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x))
    try {
      await adminPatch<SeasonDto>(`/admin/seasons/${sid}`, {
        name: merged.name,
        slug: merged.slug,
        start_date: merged.start_date,
        end_date: merged.end_date,
        status: merged.status,
        team_ids: team_ids.length > 0 ? team_ids : [],
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'seasons', lid] })
      goView()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  if (!Number.isFinite(lid) || !Number.isFinite(sid)) {
    return <p className="login-error">Invalid route.</p>
  }

  if (seasonsQ.isLoading) {
    return <p className="muted">Loading…</p>
  }
  if (seasonsQ.isError) {
    return <p className="login-error">{seasonsQ.error.message}</p>
  }
  if (!season || !merged) {
    return (
      <>
        <PageHeader title="Season not found" />
        <BackNavLink
          to="/leagues/$leagueId/seasons"
          params={{ leagueId: String(lid) }}
        >
          Seasons
        </BackNavLink>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={isEditing ? merged.name : season.name}
        description={`Slug: ${(isEditing ? merged.slug : season.slug) ?? ''} · Season id ${season.id}`}
        actions={
          <>
            <BackNavLink
              to="/leagues/$leagueId/seasons"
              params={{ leagueId: String(lid) }}
            >
              Seasons
            </BackNavLink>
            {!isEditing ? (
              <button
                type="button"
                className="btn-primary btn--with-icon"
                onClick={beginEdit}
              >
                <SquarePen size={18} strokeWidth={2} aria-hidden />
                Edit season
              </button>
            ) : null}
          </>
        }
      />
      {isEditing ? (
        <InlineEditForm
          error={saveError}
          onCancel={goView}
          onSave={() => void save()}
          fields={[
            {
              id: 'name',
              label: 'Season name',
              control: (
                <input
                  id="name"
                  className="inline-edit__control"
                  value={merged.name}
                  onChange={(e) =>
                    setPatch((p) => ({ ...p, name: e.target.value }))
                  }
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
                  value={merged.slug}
                  onChange={(e) =>
                    setPatch((p) => ({ ...p, slug: e.target.value }))
                  }
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
                  value={merged.start_date ?? ''}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      start_date: e.target.value || null,
                    }))
                  }
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
                  value={merged.end_date ?? ''}
                  onChange={(e) =>
                    setPatch((p) => ({
                      ...p,
                      end_date: e.target.value || null,
                    }))
                  }
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
                  value={merged.status}
                  onChange={(e) =>
                    setPatch((p) => ({ ...p, status: e.target.value }))
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
            {
              id: 'team_ids',
              label: 'Team IDs (comma-separated)',
              control: (
                <input
                  id="team_ids"
                  className="inline-edit__control"
                  value={teamIdsText}
                  onChange={(e) => setTeamIdsText(e.target.value)}
                />
              ),
            },
          ]}
        />
      ) : (
        <DetailFields
          items={[
            { label: 'Slug', value: season.slug },
            { label: 'Start', value: season.start_date ?? '—' },
            { label: 'End', value: season.end_date ?? '—' },
            {
              label: 'Status',
              value: (
                <StatusBadge
                  status={season.status as (typeof STATUSES)[number]}
                />
              ),
            },
            {
              label: 'Teams (ids)',
              value: season.team_ids?.join(', ') ?? '—',
            },
          ]}
        />
      )}
    </>
  )
}
