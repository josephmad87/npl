import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { LeagueDto, MatchDto, SeasonDto, TeamDto } from '@/lib/api-types'
import { adminListAll, adminPost } from '@/lib/admin-client'
import { BackNavLink } from '@/components/BackNavLink'
import { InlineEditForm } from '@/components/InlineEditForm'
import { MediaUrlField } from '@/components/MediaUrlField'
import { PageHeader } from '@/components/PageHeader'

export const Route = createFileRoute('/_shell/matches/new')({
  component: NewMatchPage,
})

const STATUSES = [
  'scheduled',
  'live',
  'completed',
  'postponed',
  'abandoned',
  'cancelled',
] as const

function NewMatchPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const teamsQ = useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: () => adminListAll<TeamDto>('/admin/teams'),
  })
  const seasonsQ = useQuery({
    queryKey: ['admin', 'seasons', 'all'],
    queryFn: () => adminListAll<SeasonDto>('/admin/seasons'),
  })
  const leaguesQ = useQuery({
    queryKey: ['admin', 'leagues'],
    queryFn: () => adminListAll<LeagueDto>('/admin/leagues'),
  })

  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [category, setCategory] = useState('men')
  const [homeTeamId, setHomeTeamId] = useState<number | null>(null)
  const [awayTeamId, setAwayTeamId] = useState<number | null>(null)
  const [venue, setVenue] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [status, setStatus] =
    useState<(typeof STATUSES)[number]>('scheduled')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)

  const teamOptions = teamsQ.data ?? []
  const seasonOptions = seasonsQ.data ?? []
  const leagueById = useMemo(() => {
    const m = new Map<number, string>()
    for (const l of leaguesQ.data ?? []) {
      m.set(l.id, l.name)
    }
    return m
  }, [leaguesQ.data])

  const defaultHome = teamOptions[0]?.id ?? 0
  const defaultAway = teamOptions[1]?.id ?? teamOptions[0]?.id ?? 0
  const resolvedHome = homeTeamId ?? defaultHome
  const resolvedAway = awayTeamId ?? defaultAway
  const defaultSeasonId = seasonOptions[0]?.id ?? 0
  const resolvedSeasonId = seasonId ?? defaultSeasonId

  const save = async () => {
    const cat = category.trim()
    if (!cat) {
      setSaveError('Category is required.')
      return
    }
    if (resolvedHome === resolvedAway) {
      setSaveError('Home and away teams must differ.')
      return
    }
    if (!Number.isFinite(resolvedHome) || !Number.isFinite(resolvedAway)) {
      setSaveError('Select home and away teams.')
      return
    }
    if (!Number.isFinite(resolvedSeasonId) || resolvedSeasonId <= 0) {
      setSaveError('Select a season (create one under Leagues if needed).')
      return
    }
    setSaveError(null)
    try {
      const created = await adminPost<MatchDto>('/admin/matches', {
        season_id: resolvedSeasonId,
        category: cat,
        home_team_id: resolvedHome,
        away_team_id: resolvedAway,
        title: null,
        venue: venue.trim() || null,
        match_date: matchDate.trim() || null,
        status,
        cover_image_url: coverImageUrl?.trim() ?? null,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches'] })
      void navigate({
        to: '/matches/$matchId',
        params: { matchId: String(created.id) },
      })
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Create failed')
    }
  }

  if (teamsQ.isLoading || seasonsQ.isLoading || leaguesQ.isLoading) {
    return <p className="muted">Loading…</p>
  }
  if (teamsQ.isError || seasonsQ.isError || leaguesQ.isError) {
    const msg =
      teamsQ.error?.message ??
      seasonsQ.error?.message ??
      leaguesQ.error?.message ??
      'Error'
    return <p className="login-error">{msg}</p>
  }
  if (teamOptions.length < 2) {
    return (
      <>
        <PageHeader
          title="New fixture"
          descriptionAsTooltip
          description="POST /admin/matches"
        />
        <p className="login-error">Need at least two teams to schedule a match.</p>
        <Link to="/teams/new" className="btn-primary btn--with-icon">
          <Plus size={18} strokeWidth={2} aria-hidden />
          New team
        </Link>
      </>
    )
  }
  if (seasonOptions.length === 0) {
    return (
      <>
        <PageHeader
          title="New fixture"
          descriptionAsTooltip
          description="POST /admin/matches"
        />
        <p className="login-error">
          Create a league and at least one season before scheduling matches.
        </p>
        <Link to="/leagues" className="btn-primary btn--with-icon">
          <Trophy size={18} strokeWidth={2} aria-hidden />
          Leagues
        </Link>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="New fixture"
        descriptionAsTooltip
        description="POST /admin/matches — each match belongs to one season (and thus one league)."
        actions={
          <BackNavLink to="/matches">Fixtures</BackNavLink>
        }
      />
      <InlineEditForm
        error={saveError}
        onCancel={() => void navigate({ to: '/matches' })}
        onSave={() => void save()}
        fields={[
          {
            id: 'season_id',
            label: 'Season',
            control: (
              <select
                id="season_id"
                className="inline-edit__control"
                value={resolvedSeasonId}
                onChange={(e) => setSeasonId(Number(e.target.value))}
              >
                {seasonOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {(leagueById.get(s.league_id) ?? `League ${s.league_id}`) +
                      ' — ' +
                      s.name}
                  </option>
                ))}
              </select>
            ),
          },
          {
            id: 'category',
            label: 'Category',
            control: (
              <input
                id="category"
                className="inline-edit__control"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            ),
          },
          {
            id: 'home_team_id',
            label: 'Home team',
            control: (
              <select
                id="home_team_id"
                className="inline-edit__control"
                value={resolvedHome}
                onChange={(e) => setHomeTeamId(Number(e.target.value))}
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
            id: 'away_team_id',
            label: 'Away team',
            control: (
              <select
                id="away_team_id"
                className="inline-edit__control"
                value={resolvedAway}
                onChange={(e) => setAwayTeamId(Number(e.target.value))}
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
            id: 'venue',
            label: 'Venue',
            control: (
              <input
                id="venue"
                className="inline-edit__control"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
              />
            ),
          },
          {
            id: 'match_date',
            label: 'Match date',
            control: (
              <input
                id="match_date"
                type="date"
                className="inline-edit__control"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
              />
            ),
          },
          {
            id: 'cover_image_url',
            label: 'Cover image (optional)',
            control: (
              <MediaUrlField
                id="cover_image_url"
                uploadKind="matches"
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                value={coverImageUrl}
                onChange={setCoverImageUrl}
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
