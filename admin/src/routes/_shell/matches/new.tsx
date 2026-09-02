import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { MatchDto, SeasonDto, TeamDto } from '@/lib/api-types'
import { adminListAll, adminPost } from '@/lib/admin-client'
import type { CompetitionCategoryValue } from '@/lib/competitionCategories'
import { CompetitionCategorySelect } from '@/components/CompetitionCategorySelect'
import { BackNavLink } from '@/components/BackNavLink'
import { InlineEditForm } from '@/components/InlineEditForm'
import { MediaUrlField } from '@/components/MediaUrlField'
import { PageHeader } from '@/components/PageHeader'

type NewMatchRouteSearch = {
  seasonId?: number | null
}

function parseNewMatchRouteSearch(
  raw: Record<string, unknown>,
): NewMatchRouteSearch {
  const value = raw.seasonId
  const seasonId =
    typeof value === 'number' && Number.isFinite(value)
      ? value
      : typeof value === 'string' && value.trim() && Number.isFinite(Number(value))
        ? Number(value)
        : null
  return { seasonId }
}

export const Route = createFileRoute('/_shell/matches/new')({
  validateSearch: parseNewMatchRouteSearch,
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
  const { seasonId: requestedSeasonId } = Route.useSearch()
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
  const [category, setCategory] = useState<CompetitionCategoryValue>('mens')
  const [homeTeamId, setHomeTeamId] = useState<number | null>(null)
  const [awayTeamId, setAwayTeamId] = useState<number | null>(null)
  const [venue, setVenue] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [status, setStatus] =
    useState<(typeof STATUSES)[number]>('scheduled')
  const [isPublished, setIsPublished] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)

  const teamOptions = useMemo(() => teamsQ.data ?? [], [teamsQ.data])
  const seasonOptions = useMemo(() => seasonsQ.data ?? [], [seasonsQ.data])
  const selectedSeason = seasonOptions.find(
    (season) => season.id === requestedSeasonId,
  )
  const resolvedSeasonId = selectedSeason?.id ?? 0
  const enrolledTeamOptions = useMemo(() => {
    if (!selectedSeason) return []
    const enrolledTeamIds = new Set(selectedSeason.team_ids)
    return teamOptions.filter((team) => enrolledTeamIds.has(team.id))
  }, [selectedSeason, teamOptions])
  const defaultHome = enrolledTeamOptions[0]?.id ?? 0
  const defaultAway = enrolledTeamOptions[1]?.id ?? enrolledTeamOptions[0]?.id ?? 0
  const resolvedHome =
    homeTeamId != null &&
    enrolledTeamOptions.some((team) => team.id === homeTeamId)
    ? homeTeamId
    : defaultHome
  const resolvedAway =
    awayTeamId != null &&
    enrolledTeamOptions.some((team) => team.id === awayTeamId)
    ? awayTeamId
    : defaultAway

  const save = async () => {
    const cat = category.trim()
    if (!cat) {
      setSaveError('Category is required.')
      return
    }
    if (enrolledTeamOptions.length < 2) {
      setSaveError(
        'Enroll at least two teams in the selected season before creating a fixture.',
      )
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
        is_published: isPublished,
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

  if (teamsQ.isLoading || seasonsQ.isLoading) {
    return <p className="muted">Loading…</p>
  }
  if (teamsQ.isError || seasonsQ.isError) {
    const msg =
      teamsQ.error?.message ??
      seasonsQ.error?.message ??
      'Error'
    return <p className="login-error">{msg}</p>
  }
  if (requestedSeasonId == null || !selectedSeason) {
    return (
      <>
        <PageHeader
          title="Choose a season first"
          descriptionAsTooltip
          description="Fixtures are created from a specific season page."
        />
        <p className="muted">
          Open the required league and season, then use its <strong>New fixture</strong>{' '}
          action.
        </p>
        <Link to="/leagues" className="btn-primary btn--with-icon">
          <Trophy size={18} strokeWidth={2} aria-hidden />
          Leagues and seasons
        </Link>
      </>
    )
  }
  if (enrolledTeamOptions.length < 2) {
    return (
      <>
        <PageHeader
          title="New fixture"
          descriptionAsTooltip
          description={`Fixtures for ${selectedSeason.name}`}
        />
        <p className="login-error">
          Enroll at least two teams in this season before scheduling a fixture.
        </p>
        <BackNavLink
          to="/leagues/$leagueId/seasons/$seasonId"
          params={{
            leagueId: String(selectedSeason.league_id),
            seasonId: String(selectedSeason.id),
          }}
        >
          Back to season
        </BackNavLink>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={`New fixture — ${selectedSeason.name}`}
        descriptionAsTooltip
        description="POST /admin/matches — teams are restricted to this season roster."
        actions={
          <BackNavLink
            to="/leagues/$leagueId/seasons/$seasonId"
            params={{
              leagueId: String(selectedSeason.league_id),
              seasonId: String(selectedSeason.id),
            }}
          >
            Back to season
          </BackNavLink>
        }
      />
      <InlineEditForm
        error={saveError}
        onCancel={() => void navigate({ to: '/matches' })}
        onSave={() => void save()}
        fields={[
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
            id: 'home_team_id',
            label: 'Home team (enrolled in season)',
            control: (
              <select
                id="home_team_id"
                className="inline-edit__control"
                value={resolvedHome}
                onChange={(e) => setHomeTeamId(Number(e.target.value))}
              >
                {enrolledTeamOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ),
          },
          {
            id: 'away_team_id',
            label: 'Away team (enrolled in season)',
            control: (
              <select
                id="away_team_id"
                className="inline-edit__control"
                value={resolvedAway}
                onChange={(e) => setAwayTeamId(Number(e.target.value))}
              >
                {enrolledTeamOptions.map((t) => (
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
          {
            id: 'is_published',
            label: 'Website visibility',
            control: (
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                />
                Publish this fixture on the website now
              </label>
            ),
          },
        ]}
      />
    </>
  )
}
