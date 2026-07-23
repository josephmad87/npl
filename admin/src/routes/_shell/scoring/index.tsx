import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  CheckCircle2,
  Clock3,
  LockKeyhole,
  PlayCircle,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type {
  MatchDto,
  Paginated,
  ScorecardEditRequestDto,
  TeamDto,
} from '@/lib/api-types'
import { adminGet, adminPost } from '@/lib/admin-client'
import { apiFetch } from '@/lib/api'
import { getSession } from '@/lib/session'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'

export const Route = createFileRoute('/_shell/scoring/')({
  component: ScoringDashboardPage,
})

type MatchTab = 'assigned' | 'completed'

function adminAccessToken(): string | undefined {
  const session = getSession() as
    | { accessToken?: string; access_token?: string; token?: string }
    | null
    | undefined

  return session?.accessToken ?? session?.access_token ?? session?.token
}

async function adminPutJson<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PUT',
    accessToken: adminAccessToken(),
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

async function publicListAll<T>(path: string): Promise<T[]> {
  const items: T[] = []
  let page = 1

  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    const res = await apiFetch<Paginated<T>>(
      `${path}${sep}page=${page}&page_size=100`,
    )

    items.push(...res.items)

    if (page >= res.pages) break
    page += 1
  }

  return items
}

function matchWhen(match: MatchDto): string {
  if (match.match_date) return match.match_date
  if (match.start_time) return String(match.start_time).slice(0, 16).replace('T', ' ')
  return '—'
}

function dateTimeLabel(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function ScoringDashboardPage() {
  const queryClient = useQueryClient()
  const session = getSession()
  const isScorer = session?.role === 'scorer'
  const isSuperAdmin = session?.role === 'super_admin'
  const [activeTab, setActiveTab] = useState<MatchTab>('assigned')

  const matchesQ = useQuery({
    queryKey: ['admin', 'scorer', 'matches'],
    queryFn: () => adminGet<MatchDto[]>('/admin/scorer/matches'),
    refetchInterval: 15000,
    retry: 1,
  })

  const editRequestsQ = useQuery({
    queryKey: ['admin', 'scorecard-edit-requests', 'pending'],
    queryFn: () =>
      adminGet<ScorecardEditRequestDto[]>(
        '/admin/scorecard-edit-requests?status=pending',
      ),
    enabled: isSuperAdmin,
    refetchInterval: 15000,
    retry: 1,
  })

  const teamsQ = useQuery({
    queryKey: ['public', 'teams', 'all-for-scoring'],
    queryFn: () => publicListAll<TeamDto>('/public/teams?include_inactive=true'),
    retry: 1,
  })

  const teamById = useMemo(
    () => new Map((teamsQ.data ?? []).map((team) => [team.id, team] as const)),
    [teamsQ.data],
  )

  const rows = matchesQ.data ?? []
  const assignedRows = rows.filter((match) => match.status !== 'completed')
  const completedRows = rows.filter((match) => match.status === 'completed')
  const visibleRows = activeTab === 'assigned' ? assignedRows : completedRows

  const requestEditMutation = useMutation({
    mutationFn: (matchId: number) =>
      adminPost<ScorecardEditRequestDto>(
        `/admin/matches/${matchId}/scorecard-edit-requests`,
        {},
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'scorer', 'matches'],
      })
    },
  })

  const decideRequestMutation = useMutation({
    mutationFn: ({
      requestId,
      approved,
    }: {
      requestId: number
      approved: boolean
    }) =>
      adminPutJson<ScorecardEditRequestDto>(
        `/admin/scorecard-edit-requests/${requestId}`,
        { approved },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'scorecard-edit-requests'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'scorer', 'matches'],
      })
    },
  })

  return (
    <>
      <style>{`
        .scoring-dashboard-tabs {
          display: flex;
          gap: 0.65rem;
          margin-bottom: 1rem;
        }
        .scoring-dashboard-tab {
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--bg-panel);
          color: var(--text);
          cursor: pointer;
          font: inherit;
          font-weight: 800;
          padding: 0.7rem 1.1rem;
        }
        .scoring-dashboard-tab.is-active {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
        }
        .scoring-dashboard-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }
        .scoring-match-card {
          min-width: 0;
        }
        .scoring-match-card__link {
          color: inherit;
          display: block;
          text-decoration: none;
        }
        .scoring-match-card__access {
          align-items: flex-start;
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          padding: 0.85rem 1rem 1rem;
        }
        .scoring-match-card__access p {
          margin: 0;
        }
        .scoring-match-card__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
        }
        .scorecard-request-list {
          display: grid;
          gap: 0.8rem;
          margin-top: 1rem;
        }
        .scorecard-request {
          align-items: center;
          background: var(--bg-panel);
          border: 1px solid var(--border);
          border-radius: 14px;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
          padding: 1rem;
        }
        .scorecard-request p {
          margin: 0.25rem 0 0;
        }
        @media (max-width: 1100px) {
          .scoring-dashboard-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 720px) {
          .scoring-dashboard-grid {
            grid-template-columns: 1fr;
          }
          .scorecard-request {
            align-items: stretch;
            flex-direction: column;
          }
        }
      `}</style>

      <PageHeader
        title="Live scoring"
        description="Assigned and completed matches for ball-by-ball scoring."
      />

      {isSuperAdmin ? (
        <section className="team-hub-section">
          <div className="team-hub-section-head">
            <div className="team-hub-section-head__lead">
              <h2 className="team-hub-section__title">
                Scorecard edit requests
              </h2>
              <p className="muted">
                Approvals reopen a locked scorecard for that scorer for 120
                minutes.
              </p>
            </div>
          </div>

          {editRequestsQ.isLoading ? (
            <p className="muted">Loading edit requests…</p>
          ) : null}
          {editRequestsQ.isError ? (
            <p className="login-error">{editRequestsQ.error.message}</p>
          ) : null}
          {!editRequestsQ.isLoading &&
          !editRequestsQ.isError &&
          (editRequestsQ.data?.length ?? 0) === 0 ? (
            <p className="muted">No pending scorecard edit requests.</p>
          ) : null}

          {(editRequestsQ.data?.length ?? 0) > 0 ? (
            <div className="scorecard-request-list">
              {editRequestsQ.data?.map((request) => {
                const home =
                  teamById.get(request.home_team_id)?.name ??
                  `Team ${request.home_team_id}`
                const away =
                  teamById.get(request.away_team_id)?.name ??
                  `Team ${request.away_team_id}`
                return (
                  <article key={request.id} className="scorecard-request">
                    <div>
                      <strong>
                        {home} vs {away}
                      </strong>
                      <p className="muted">
                        {request.requester_full_name ||
                          request.requester_email}{' '}
                        · requested {dateTimeLabel(request.requested_at)}
                      </p>
                      {request.reason ? <p>{request.reason}</p> : null}
                    </div>
                    <div className="scoring-match-card__actions">
                      <button
                        type="button"
                        className="btn-primary btn--with-icon"
                        disabled={decideRequestMutation.isPending}
                        onClick={() =>
                          decideRequestMutation.mutate({
                            requestId: request.id,
                            approved: true,
                          })
                        }
                      >
                        <CheckCircle2 size={18} aria-hidden />
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn--with-icon"
                        disabled={decideRequestMutation.isPending}
                        onClick={() =>
                          decideRequestMutation.mutate({
                            requestId: request.id,
                            approved: false,
                          })
                        }
                      >
                        <XCircle size={18} aria-hidden />
                        Deny
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="scoring-dashboard-tabs" role="tablist" aria-label="Scorer matches">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'assigned'}
          className={`scoring-dashboard-tab${activeTab === 'assigned' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('assigned')}
        >
          Assigned matches ({assignedRows.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'completed'}
          className={`scoring-dashboard-tab${activeTab === 'completed' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed matches ({completedRows.length})
        </button>
      </div>

      {matchesQ.isLoading ? <p className="muted">Loading matches…</p> : null}
      {matchesQ.isError ? <p className="login-error">{matchesQ.error.message}</p> : null}
      {requestEditMutation.isError ? (
        <p className="login-error">{requestEditMutation.error.message}</p>
      ) : null}
      {decideRequestMutation.isError ? (
        <p className="login-error">{decideRequestMutation.error.message}</p>
      ) : null}

      {!matchesQ.isLoading && !matchesQ.isError && visibleRows.length === 0 ? (
        <p className="muted">
          {activeTab === 'assigned'
            ? 'No assigned matches are available for scoring.'
            : 'No completed matches yet.'}
        </p>
      ) : null}

      {visibleRows.length > 0 ? (
        <div className="scoring-dashboard-grid">
          {visibleRows.map((match) => {
            const home = teamById.get(match.home_team_id)
            const away = teamById.get(match.away_team_id)
            const homeName = home?.name ?? `Team ${match.home_team_id}`
            const awayName = away?.name ?? `Team ${match.away_team_id}`
            const isCompleted = match.status === 'completed'
            const isLocked = Boolean(match.scorecard_locked)
            const canEdit = match.can_edit_scorecard !== false
            const requestPending = match.edit_request_status === 'pending'

            return (
              <article
                key={match.id}
                className="entity-thumb-card scoring-match-card"
              >
                <Link
                  to="/scoring/$matchId"
                  params={{ matchId: String(match.id) }}
                  className="scoring-match-card__link"
                >
                  <div className="entity-thumb-card__body">
                    <h3 className="entity-thumb-card__title">
                      {homeName} vs {awayName}
                    </h3>
                    <p className="entity-thumb-card__meta muted">
                      {matchWhen(match)}
                      <br />
                      {match.season
                        ? `${match.season.league.name} — ${match.season.name}`
                        : 'No season'}
                      <br />
                      {match.venue ?? '—'}
                    </p>
                  </div>
                </Link>
                <div className="entity-thumb-card__footer">
                  <StatusBadge
                    status={
                      match.status as
                        | 'scheduled'
                        | 'live'
                        | 'completed'
                        | 'postponed'
                        | 'abandoned'
                        | 'cancelled'
                    }
                  />
                  <Link
                    to="/scoring/$matchId"
                    params={{ matchId: String(match.id) }}
                    className="btn-ghost btn--with-icon"
                  >
                    {isLocked && !canEdit ? (
                      <LockKeyhole size={18} aria-hidden />
                    ) : (
                      <PlayCircle size={18} aria-hidden />
                    )}
                    {isLocked && !canEdit
                      ? 'View scorecard'
                      : isCompleted
                        ? 'Edit scorecard'
                        : 'Score'}
                  </Link>
                </div>

                {isCompleted ? (
                  <div className="scoring-match-card__access">
                    {isLocked ? (
                      <p className="muted">
                        <LockKeyhole size={15} aria-hidden /> Locked after{' '}
                        {dateTimeLabel(match.scorecard_locks_at)}
                      </p>
                    ) : (
                      <p className="muted">
                        <Clock3 size={15} aria-hidden /> Editable until{' '}
                        {dateTimeLabel(match.scorecard_locks_at)}
                      </p>
                    )}
                    {canEdit && match.edit_access_until ? (
                      <p className="muted">
                        Approved access ends{' '}
                        {dateTimeLabel(match.edit_access_until)}
                      </p>
                    ) : null}
                    {isScorer && isLocked && !canEdit ? (
                      <button
                        type="button"
                        className="btn-primary btn--with-icon"
                        disabled={
                          requestPending || requestEditMutation.isPending
                        }
                        onClick={() => requestEditMutation.mutate(match.id)}
                      >
                        <LockKeyhole size={18} aria-hidden />
                        {requestPending
                          ? 'Permission requested'
                          : 'Request edit permission'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : null}
    </>
  )
}
