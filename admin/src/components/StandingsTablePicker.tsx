import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminGet, adminListAll } from '@/lib/admin-client'
import type { LeagueDto, SeasonDto, TeamDto } from '@/lib/api-types'
import {
  computeSeasonStandings,
  sortStandingsDesc,
} from '../../../website/src/lib/leagueSeasonAggregates'
import type { MatchLite } from '../../../website/src/lib/match-types'
import { storyTableVariants, type StoryTableVariant } from './StoryTableExtensions'
import {
  buildStandingsSnapshotHtml,
  defaultStandingColumns,
  standingColumns,
  type ColumnKey,
  type RankedStandingRow,
} from './standingsTableSnapshot'
import './StandingsTablePicker.css'

type StandingAdjustment = { team_id: number; points_delta: number }

export function StandingsTablePicker({
  onInsert,
  onCancel,
}: {
  onInsert: (html: string) => void
  onCancel: () => void
}) {
  const [leagueId, setLeagueId] = useState<number | null>(null)
  const [seasonId, setSeasonId] = useState<number | null>(null)
  const [excludedTeamIds, setExcludedTeamIds] = useState<number[]>([])
  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(defaultStandingColumns)
  const [variant, setVariant] = useState<StoryTableVariant>('standard')

  const leaguesQ = useQuery({
    queryKey: ['admin', 'story-standings', 'leagues'],
    queryFn: () => adminListAll<LeagueDto>('/admin/leagues'),
    retry: 1,
  })
  const teamsQ = useQuery({
    queryKey: ['admin', 'story-standings', 'teams'],
    queryFn: () => adminListAll<TeamDto>('/admin/teams'),
    retry: 1,
  })
  const seasonsQ = useQuery({
    queryKey: ['admin', 'story-standings', 'seasons', leagueId],
    queryFn: () => adminListAll<SeasonDto>(`/admin/seasons?league_id=${leagueId}`),
    enabled: leagueId !== null,
    retry: 1,
  })
  const standingsQ = useQuery({
    queryKey: ['admin', 'story-standings', 'results', seasonId],
    queryFn: async () => {
      const [matches, adjustments] = await Promise.all([
        adminListAll<MatchLite>(`/public/results?season_id=${seasonId}`),
        adminGet<StandingAdjustment[]>(`/public/seasons/${seasonId}/standing-adjustments`),
      ])
      return { matches, adjustments }
    },
    enabled: seasonId !== null,
    retry: 1,
  })

  const season = seasonsQ.data?.find((item) => item.id === seasonId)
  const teamsById = useMemo(
    () => new Map((teamsQ.data ?? []).map((team) => [team.id, team.name])),
    [teamsQ.data],
  )
  const rows = useMemo<RankedStandingRow[]>(() => {
    if (!season || !standingsQ.data) return []
    const adjustments = Object.fromEntries(
      standingsQ.data.adjustments.map((item) => [item.team_id, item.points_delta]),
    )
    return sortStandingsDesc(
      computeSeasonStandings(
        standingsQ.data.matches,
        season.team_ids,
        adjustments,
      ),
    ).map((row, index) => ({ ...row, rank: index + 1 }))
  }, [season, standingsQ.data])
  const visibleRows = rows.filter((row) => !excludedTeamIds.includes(row.teamId))
  const hasPublishedResults = (standingsQ.data?.matches.length ?? 0) > 0
  const canInsert = teamsQ.isSuccess && hasPublishedResults && visibleRows.length > 0 && selectedColumns.length > 0

  const changeLeague = (value: string) => {
    setLeagueId(value ? Number(value) : null)
    setSeasonId(null)
    setExcludedTeamIds([])
  }

  const changeSeason = (value: string) => {
    setSeasonId(value ? Number(value) : null)
    setExcludedTeamIds([])
  }

  const toggleTeam = (teamId: number) => {
    setExcludedTeamIds((current) =>
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId],
    )
  }

  const toggleColumn = (column: ColumnKey) => {
    setSelectedColumns((current) =>
      current.includes(column)
        ? current.filter((key) => key !== column)
        : [...current, column],
    )
  }

  const insert = () => {
    if (!canInsert) return
    onInsert(buildStandingsSnapshotHtml(visibleRows, selectedColumns, teamsById, variant))
  }

  return (
    <div className="standings-picker" role="region" aria-label="Insert current standings">
      <div className="standings-picker__header">
        <div>
          <strong>Insert current standings</strong>
          <p>Choose the teams and figures to include. The inserted table is an editable snapshot.</p>
        </div>
        <button type="button" className="standings-picker__close" onClick={onCancel} aria-label="Close standings picker">×</button>
      </div>

      <div className="standings-picker__selectors">
        <label>
          League
          <select value={leagueId ?? ''} onChange={(event) => changeLeague(event.target.value)} disabled={leaguesQ.isPending}>
            <option value="">Select a league</option>
            {(leaguesQ.data ?? []).map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
          </select>
        </label>
        <label>
          Season
          <select value={seasonId ?? ''} onChange={(event) => changeSeason(event.target.value)} disabled={leagueId === null || seasonsQ.isPending}>
            <option value="">Select a season</option>
            {(seasonsQ.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>
          Style
          <select value={variant} onChange={(event) => setVariant(event.target.value as StoryTableVariant)}>
            {storyTableVariants.map((option) => <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>)}
          </select>
        </label>
      </div>

      {leaguesQ.isError || teamsQ.isError || seasonsQ.isError || standingsQ.isError ? (
        <p className="standings-picker__error" role="alert">
          Could not load standings. Check the selected league and try again.
        </p>
      ) : null}
      {seasonId !== null && (standingsQ.isPending || teamsQ.isPending) ? (
        <p className="standings-picker__status" role="status">Loading current standings…</p>
      ) : null}
      {seasonId !== null && standingsQ.isSuccess && !hasPublishedResults ? (
        <p className="standings-picker__status">This season has no published results yet.</p>
      ) : null}
      {seasonId !== null && standingsQ.isSuccess && hasPublishedResults && rows.length === 0 ? (
        <p className="standings-picker__status">No teams are enrolled in this season.</p>
      ) : null}

      {standingsQ.isSuccess && hasPublishedResults && rows.length > 0 ? (
        <div className="standings-picker__options">
          <fieldset>
            <legend>Team rows ({visibleRows.length} selected)</legend>
            <div className="standings-picker__choices">
              {rows.map((row) => (
                <label key={row.teamId}>
                  <input type="checkbox" checked={!excludedTeamIds.includes(row.teamId)} onChange={() => toggleTeam(row.teamId)} />
                  <span>{row.rank}. {teamsById.get(row.teamId) ?? `Team #${row.teamId}`} <small>· {row.points} pts</small></span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Columns ({selectedColumns.length} selected)</legend>
            <div className="standings-picker__choices standings-picker__choices--columns">
              {standingColumns.map((column) => (
                <label key={column.key}>
                  <input type="checkbox" checked={selectedColumns.includes(column.key)} onChange={() => toggleColumn(column.key)} />
                  <span>{column.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}

      <div className="standings-picker__actions">
        <button type="button" className="rich-text-toolbar__btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="rich-text-toolbar__btn standings-picker__insert" onClick={insert} disabled={!canInsert}>
          Insert selected standings
        </button>
      </div>
    </div>
  )
}
