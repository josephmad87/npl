import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { EmptyState } from './EmptyState'
import type { MatchLite, TeamLite } from '../lib/hooks'
import { fetchAllPaginatedList } from '../lib/publicApi'
import { playerPlaceholderSrc, resolvePlayerPhotoSrc } from '../lib/playerPhotoSrc'
import {
  buildBattingLeaderboard,
  buildBowlingLeaderboard,
  kpiPlayerList,
  kpiTeamList,
  kpiTournamentList,
  type BattingTableRow,
  type BowlingTableRow,
  topPerformers,
} from '../lib/leagueStatsBuild'

type Pl = { id: number; full_name: string; team_id: number; profile_photo_url: string | null }


const STAT_PAGE_SIZE = 15

function clampPage(page: number, totalItems: number): number {
  const totalPages = Math.max(1, Math.ceil(totalItems / STAT_PAGE_SIZE))
  return Math.min(Math.max(page, 0), totalPages - 1)
}

function pagedStats<T>(
  rows: T[],
  page: number,
): {
  visibleRows: T[]
  currentPage: number
  totalPages: number
} {
  const totalPages = Math.max(1, Math.ceil(rows.length / STAT_PAGE_SIZE))
  const currentPage = clampPage(page, rows.length)
  const start = currentPage * STAT_PAGE_SIZE

  return {
    visibleRows: rows.slice(start, start + STAT_PAGE_SIZE),
    currentPage,
    totalPages,
  }
}

function StatsPager({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
}: Readonly<{
  currentPage: number
  totalPages: number
  onPrevious: () => void
  onNext: () => void
}>) {
  if (totalPages <= 1) {
    return null
  }

  return (
    <div className="stats-pager">
      <button
        type="button"
        className="btn-ghost stats-pager__button"
        disabled={currentPage <= 0}
        onClick={onPrevious}
      >
        ← Previous
      </button>

      <span className="stats-pager__label">
        Page {currentPage + 1} of {totalPages}
      </span>

      <button
        type="button"
        className="btn-ghost stats-pager__button"
        disabled={currentPage >= totalPages - 1}
        onClick={onNext}
      >
        Next →
      </button>
    </div>
  )
}



function useSeasonPlayerNames(teamIds: number[]) {
  return useQuery({
    queryKey: ['season-players', teamIds.join(',')],
    queryFn: async () => {
      if (teamIds.length === 0) return new Map<number, Pl>()
      const rows = await Promise.all(
        teamIds.map((tid) =>
          fetchAllPaginatedList<Pl>((page) =>
            `/public/players?page=${page}&page_size=100&team_id=${tid}&include_inactive=true`,
          ),
        ),
      )
      const m = new Map<number, Pl>()
      for (const list of rows) {
        for (const p of list) {
          m.set(p.id, p)
        }
      }
      return m
    },
    enabled: teamIds.length > 0,
    retry: 1,
  })
}

type Scope = 'tournament' | 'team' | 'player'
type BSort = 'runs' | 'hs' | 'sr' | 'avg'
type WSort = 'wickets' | 'econ' | 'r'

function sortBattingRows(rows: BattingTableRow[], by: BSort): BattingTableRow[] {
  const next = [...rows]
  if (by === 'runs') next.sort((a, b) => b.r - a.r)
  if (by === 'hs') next.sort((a, b) => b.hs - a.hs)
  if (by === 'sr') next.sort((a, b) => parseFloat(b.sr) - parseFloat(a.sr))
  if (by === 'avg') next.sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg))
  return next.map((r, i) => ({ ...r, pos: i + 1 }))
}

function sortBowlRows(rows: BowlingTableRow[], by: WSort): BowlingTableRow[] {
  const next = [...rows]
  if (by === 'wickets') next.sort((a, b) => b.wk - a.wk || a.r - b.r)
  if (by === 'econ') next.sort((a, b) => parseFloat(a.econ) - parseFloat(b.econ) || b.wk - a.wk)
  if (by === 'r') next.sort((a, b) => a.r - b.r)
  return next.map((r, i) => ({ ...r, pos: i + 1 }))
}

function isTeamCaptain(
  playerId: number,
  teamId: number,
  teamsMap: Record<number, TeamLite>,
  playerById: Map<number, Pl>,
): boolean {
  const team = teamsMap[teamId]
  if (!team) return false
  if (team.captain_player_id != null) return team.captain_player_id === playerId
  const captainName = team.captain?.trim().toLowerCase()
  if (!captainName) return false
  const playerName = playerById.get(playerId)?.full_name?.trim().toLowerCase()
  return playerName === captainName
}

export function LeagueStatsPanel({
  resultMatches,
  teamIds,
  teamsMap,
}: {
  resultMatches: MatchLite[]
  teamIds: number[]
  teamsMap: Record<number, TeamLite>
}) {
  const { data: playerById = new Map<number, Pl>() } = useSeasonPlayerNames(teamIds)
  const [scope, setScope] = useState<Scope>('tournament')
  const [teamId, setTeamId] = useState<number | null>(() => teamIds[0] ?? null)
  const [playerId, setPlayerId] = useState<number | null>(null)
  const [bSort, setBSort] = useState<BSort>('runs')
  const [wSort, setWSort] = useState<WSort>('wickets')
  const [batBowTab, setBatBowTab] = useState<'batting' | 'bowling'>('batting')
  const [battingStatsPage, setBattingStatsPage] = useState(0)
  const [bowlingStatsPage, setBowlingStatsPage] = useState(0)

  const playerOptions = useMemo(() => {
    return [...playerById.values()].sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [playerById])

  const effectiveTeamId = useMemo(() => {
    if (teamIds.length === 0) return null
    if (teamId != null && teamIds.includes(teamId)) return teamId
    return teamIds[0] ?? null
  }, [teamIds, teamId])

  const effectivePlayerId = useMemo(() => {
    if (scope !== 'player') return playerId
    if (playerOptions.length === 0) return null
    if (playerId != null && playerOptions.some((p) => p.id === playerId)) {
      return playerId
    }
    return playerOptions[0]?.id ?? null
  }, [scope, playerId, playerOptions])

  const kpiList = useMemo(() => {
    if (scope === 'tournament') return kpiTournamentList(resultMatches)
    if (scope === 'team' && effectiveTeamId != null) {
      return kpiTeamList(resultMatches, effectiveTeamId)
    }
    if (scope === 'player' && effectivePlayerId != null) {
      return kpiPlayerList(resultMatches, effectivePlayerId)
    }
    if (scope === 'player') return []
    return kpiTournamentList(resultMatches)
  }, [resultMatches, scope, effectiveTeamId, effectivePlayerId])

  const tops = useMemo(() => topPerformers(resultMatches), [resultMatches])
 const allBatRows = useMemo(
  () => sortBattingRows(buildBattingLeaderboard(resultMatches), bSort),
  [resultMatches, bSort],
)

const allBowlRows = useMemo(
  () => sortBowlRows(buildBowlingLeaderboard(resultMatches), wSort),
  [resultMatches, wSort],
)

const batRows = useMemo(() => {
  const filtered = allBatRows.filter((row) => {
    if (scope === 'team' && effectiveTeamId != null) {
      return row.teamId === effectiveTeamId
    }

    if (scope === 'player' && effectivePlayerId != null) {
      return row.playerId === effectivePlayerId
    }

    return true
  })

  return filtered.map((row, index) => ({
    ...row,
    pos: index + 1,
  }))
}, [allBatRows, scope, effectiveTeamId, effectivePlayerId])

const bowlRows = useMemo(() => {
  const filtered = allBowlRows.filter((row) => {
    if (scope === 'team' && effectiveTeamId != null) {
      return row.teamId === effectiveTeamId
    }

    if (scope === 'player' && effectivePlayerId != null) {
      return row.playerId === effectivePlayerId
    }

    return true
  })

  return filtered.map((row, index) => ({
    ...row,
    pos: index + 1,
  }))
}, [allBowlRows, scope, effectiveTeamId, effectivePlayerId])

const battingPage = pagedStats(batRows, battingStatsPage)
const bowlingPage = pagedStats(bowlRows, bowlingStatsPage)
  if (resultMatches.length === 0) {
    return <EmptyState title="No match statistics for this season yet" />
  }

  return (
    <div className="league-stats-panel">
      <section className="league-stats-sec" aria-label="Tournament, team, and player figures">
        <div className="league-stats-sec__tabs league-stats-sec__tabs--tight">
          {(['tournament', 'team', 'player'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={scope === k ? 'is-active' : ''}
              onClick={() => setScope(k)}
            >
              {k === 'tournament' ? 'Tournament' : k === 'team' ? 'Team' : 'Player'}
            </button>
          ))}
        </div>
        {scope === 'team' ? (
          <div className="league-stats-inline-pick">
            <label>
              <span className="sr-only">Team</span>
              <select
                className="league-stats-inline-pick__sel"
                value={effectiveTeamId ?? ''}
                onChange={(e) => setTeamId(Number(e.target.value) || null)}
              >
                {teamIds.map((id) => (
                  <option key={id} value={id}>
                    {teamsMap[id]?.name ?? `Team #${id}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        {scope === 'player' ? (
          <div className="league-stats-inline-pick">
            <label>
              <span className="sr-only">Player</span>
              <select
                className="league-stats-inline-pick__sel"
                value={effectivePlayerId ?? ''}
                onChange={(e) => setPlayerId(Number(e.target.value) || null)}
              >
                {playerOptions.length === 0 ? (
                  <option value="">No players in season</option>
                ) : null}
                {playerOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <div className="league-stats-kpi-grid">
          {kpiList.length === 0 && scope === 'player' ? (
            <p className="league-stats-kpi-hint">Loading players or pick a player to see figures.</p>
          ) : (
            kpiList.map((k) => (
              <div key={k.label} className="league-stats-kpi-card">
                <span className="league-stats-kpi-card__label">{k.label}</span>
                <span className="league-stats-kpi-card__val">{k.value}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="league-stats-sec" aria-label="Top performers">
        <h2 className="league-stats-sec__title">Top performers</h2>
        <div className="league-stats-top4">
          {(
            [
              ['runs', 'Runs', tops.runs],
              ['wickets', 'Wickets', tops.wickets],
              ['sr', 'SR', tops.batSR],
              ['econ', 'Econ', tops.economy],
            ] as const
          ).map(([key, label, slot]) => (
            <div key={key} className="league-stats-top-card">
              <p className="league-stats-top-card__eyebrow">{label}</p>
              <div className="league-stats-top-card__head">
                {slot ? (
                  <div className="league-stats-top-card__head-row">
                    <img
                      className="league-stats-top-card__ph"
                      src={resolvePlayerPhotoSrc(playerById.get(slot.playerId)?.profile_photo_url)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.onerror = null
                        e.currentTarget.src = playerPlaceholderSrc
                      }}
                    />
                    <div className="league-stats-top-card__head-text">
                      <div className="league-stats-top-card__name">
                        {playerById.get(slot.playerId)?.full_name?.toUpperCase() ??
                          `Player #${slot.playerId}`}{' '}
                        {isTeamCaptain(slot.playerId, slot.teamId, teamsMap, playerById) ? (
                          <span className="league-stats-captain-badge">Captain</span>
                        ) : null}
                      </div>
                      <div className="league-stats-top-card__statline">
                        <span className="league-stats-top-card__big">{slot.value}</span>{' '}
                        <span className="league-stats-top-card__sub-gold">{slot.sub}</span>
                      </div>
                      <div className="league-stats-top-card__team">
                        {(teamsMap[slot.teamId]?.name ?? 'Team').toUpperCase()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="league-stats-top-card__empty">—</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="league-stats-sec" aria-label="Leaderboards">
        <div className="league-stats-sec__tabs">
          <button
            type="button"
            className={batBowTab === 'batting' ? 'is-active' : ''}
            onClick={() => setBatBowTab('batting')}
          >
            Batting stats
          </button>
          <button
            type="button"
            className={batBowTab === 'bowling' ? 'is-active' : ''}
            onClick={() => setBatBowTab('bowling')}
          >
            Bowling stats
          </button>
        </div>
        {batBowTab === 'batting' ? (
          <div className="league-stats-lb">
            <div className="league-stats-lb__toolbar">
              <label>
                <span className="sr-only">Sort batting</span>
                <select
                  className="league-stats-lb__select"
                  value={bSort}
                  onChange={(e) => setBSort(e.target.value as BSort)}
                >
                  <option value="runs">Most runs</option>
                  <option value="hs">High score</option>
                  <option value="sr">Strike rate</option>
                  <option value="avg">Average</option>
                </select>
              </label>
            </div>
            <div className="league-stats-table-wrap">
              <table className="league-stats-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Player</th>
                    <th>Team</th>
                    <th>M</th>
                    <th>R</th>
                    <th>I</th>
                    <th>NO</th>
                    <th>HS</th>
                    <th>Avg</th>
                    <th>BF</th>
                    <th>SR</th>
                    <th>100</th>
                    <th>50</th>
                    <th>4s</th>
                    <th>6s</th>
                  </tr>
                </thead>
                <tbody>
                  {battingPage.visibleRows.map((r) => (
                    <tr key={r.playerId}>
                      <td>{r.pos}</td>
                      <td>
                        {playerById.get(r.playerId)?.full_name ?? `#${r.playerId}`}{' '}
                        {isTeamCaptain(r.playerId, r.teamId, teamsMap, playerById) ? (
                          <span className="league-stats-captain-badge league-stats-captain-badge--table">
                            Captain
                          </span>
                        ) : null}
                      </td>
                      <td>{teamsMap[r.teamId]?.name ?? '—'}</td>
                      <td>{r.m}</td>
                      <td>{r.r}</td>
                      <td>{r.i}</td>
                      <td>{r.no}</td>
                      <td>{r.hs}</td>
                      <td>{r.avg}</td>
                      <td>{r.bf}</td>
                      <td>{r.sr}</td>
                      <td>{r.c100}</td>
                      <td>{r.c50}</td>
                      <td>{r.s4}</td>
                      <td>{r.s6}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
<StatsPager
  currentPage={battingPage.currentPage}
  totalPages={battingPage.totalPages}
  onPrevious={() =>
    setBattingStatsPage((page) => clampPage(page - 1, batRows.length))
  }
  onNext={() =>
    setBattingStatsPage((page) => clampPage(page + 1, batRows.length))
  }
/>
    
            </div>
          </div>
        ) : (
          <div className="league-stats-lb">
            <div className="league-stats-lb__toolbar">
              <label>
                <span className="sr-only">Sort bowling</span>
                <select
                  className="league-stats-lb__select"
                  value={wSort}
                  onChange={(e) => setWSort(e.target.value as WSort)}
                >
                  <option value="wickets">Most wickets</option>
                  <option value="econ">Economy</option>
                  <option value="r">Runs conceded</option>
                </select>
              </label>
            </div>
            <div className="league-stats-table-wrap">
              <table className="league-stats-table">
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Player</th>
                    <th>Team</th>
                    <th>M</th>
                    <th>W</th>
                    <th>O</th>
                    <th>R</th>
                    <th>Maid</th>
                    <th>Econ</th>
                    <th>SR</th>
                    <th>Ct</th>
                    <th>St</th>
                  </tr>
                </thead>
                <tbody>
                  {bowlingPage.visibleRows.map((r) => (
                    <tr key={r.playerId}>
                      <td>{r.pos}</td>
                      <td>
                        {playerById.get(r.playerId)?.full_name ?? `#${r.playerId}`}{' '}
                        {isTeamCaptain(r.playerId, r.teamId, teamsMap, playerById) ? (
                          <span className="league-stats-captain-badge league-stats-captain-badge--table">
                            Captain
                          </span>
                        ) : null}
                      </td>
                      <td>{teamsMap[r.teamId]?.name ?? '—'}</td>
                      <td>{r.m}</td>
                      <td>{r.wk}</td>
                      <td>{r.o}</td>
                      <td>{r.r}</td>
                      <td>{r.maid}</td>
                      <td>{r.econ}</td>
                      <td>{r.sr}</td>
                      <td>{r.catches}</td>
                      <td>{r.stumpings}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
<StatsPager
  currentPage={bowlingPage.currentPage}
  totalPages={bowlingPage.totalPages}
  onPrevious={() =>
    setBowlingStatsPage((page) => clampPage(page - 1, bowlRows.length))
  }
  onNext={() =>
    setBowlingStatsPage((page) => clampPage(page + 1, bowlRows.length))
  }
/>
              
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
