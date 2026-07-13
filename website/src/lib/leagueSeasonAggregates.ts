import type { MatchLite } from './hooks'
import { countsBattingInnings } from './cricket'
import { sumTeamExtras } from './match-extras'

export type StandingRow = {
  teamId: number
  played: number
  won: number
  lost: number
  tied: number
  /** No-result (abandoned) — 0 until season includes those fixtures in API */
  nr: number
  points: number
  runsFor: number
  ballsFaced: number
  runsAgainst: number
  ballsBowled: number
  nrr: number
}

function statRows(match: MatchLite): Array<Record<string, unknown>> {
  return Array.isArray(match.player_stats)
    ? (match.player_stats as Array<Record<string, unknown>>)
    : []
}

function num(r: Record<string, unknown>, k: string): number {
  const v = r[k]

  if (typeof v === 'number' && !Number.isNaN(v)) {
    return v
  }

  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v)
  }

  return 0
}

/**
 * Convert cricket overs from the API to total balls.
 * Example: 27.2 = 27 overs and 2 balls = 164 balls.
 */
export function oversFieldToBalls(ov: unknown): number {
  if (ov == null) {
    return 0
  }

  const raw = typeof ov === 'number' ? ov : Number(ov)

  if (Number.isNaN(raw) || raw <= 0) {
    return 0
  }

  const n = Math.round(raw * 10) / 10
  const s = n.toString()

  if (!s.includes('.')) {
    return Math.floor(n) * 6
  }

  const [whole, frac] = s.split('.')
  const w = parseInt(whole, 10) || 0
  const f = (frac ?? '').replace(/\D/g, '')

  if (!f) {
    return w * 6
  }

  const b = Math.min(5, parseInt(f[0] ?? '0', 10) || 0)

  return w * 6 + b
}

function sideForTeam(match: MatchLite, teamId: number): 'home' | 'away' | null {
  if (teamId === match.home_team_id) {
    return 'home'
  }

  if (teamId === match.away_team_id) {
    return 'away'
  }

  return null
}

function teamExtras(match: MatchLite, teamId: number): number {
  const side = sideForTeam(match, teamId)

  if (!side) {
    return 0
  }

  return sumTeamExtras(
    match.result as Record<string, unknown> | null | undefined,
    side,
  )
}

function isEnteredBattingRow(row: Record<string, unknown>): boolean {
  if (row.batting_order != null) {
    return true
  }

  const runs = num(row, 'runs')
  const ballsFaced = num(row, 'balls_faced')
  const dismissal = typeof row.dismissal === 'string' ? row.dismissal : null

  return countsBattingInnings(dismissal, runs, ballsFaced)
}

function isEnteredBowlingRow(row: Record<string, unknown>): boolean {
  if (row.bowling_order != null) {
    return true
  }

  return num(row, 'overs') > 0
}

function battingPlayerTotals(
  match: MatchLite,
  teamId: number,
): { runs: number; balls: number } {
  let runs = 0
  let balls = 0

  for (const row of statRows(match)) {
    if (row.team_id !== teamId) continue
    if (!isEnteredBattingRow(row)) continue

    runs += num(row, 'runs')
    balls += num(row, 'balls_faced')
  }

  return { runs, balls }
}

function bowlingBallsForTeam(match: MatchLite, teamId: number): number {
  let balls = 0

  for (const row of statRows(match)) {
    if (row.team_id !== teamId) continue
    if (!isEnteredBowlingRow(row)) continue

    balls += oversFieldToBalls(row.overs)
  }

  return balls
}

function defaultAllottedOversForMatch(match: MatchLite): number {
  const text = [
    match.season?.league?.slug,
    match.season?.league?.name,
    match.season?.slug,
    match.season?.name,
    match.title,
    match.category,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (text.includes('t20') || text.includes('twenty20')) {
    return 20
  }

  return 40
}

function allottedBallsForTeam(match: MatchLite, teamId: number): number {
  const raw =
    teamId === match.home_team_id
      ? match.result?.home_allotted_overs
      : teamId === match.away_team_id
        ? match.result?.away_allotted_overs
        : null

  const savedBalls = oversFieldToBalls(raw)

  if (savedBalls > 0) {
    return savedBalls
  }

  return defaultAllottedOversForMatch(match) * 6
}

function isWicketDismissal(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false
  }

  const dismissal = value.trim().toLowerCase()

  if (!dismissal) {
    return false
  }

  return ![
    'not out',
    'did not bat',
    'dnb',
    'retired hurt',
    'retired not out',
    'absent',
    'absent hurt',
  ].includes(dismissal)
}

function battingWicketsLostForTeam(match: MatchLite, teamId: number): number {
  let wickets = 0

  for (const row of statRows(match)) {
    if (row.team_id !== teamId) continue
    if (!isEnteredBattingRow(row)) continue

    if (isWicketDismissal(row.dismissal)) {
      wickets += 1
    }
  }

  return wickets
}

function nrrBallsForInnings(
  actualBalls: number,
  wicketsLost: number,
  allottedBalls: number,
): number {
  if (wicketsLost >= 10 && allottedBalls > 0) {
    return allottedBalls
  }

  return actualBalls
}

function nrrFrom(
  runsFor: number,
  ballsFaced: number,
  runsAgainst: number,
  ballsBowled: number,
): number {
  const of = ballsFaced / 6
  const oa = ballsBowled / 6
  const rrf = of > 0 ? runsFor / of : 0
  const rra = oa > 0 ? runsAgainst / oa : 0

  return rrf - rra
}

export function ballsToOversLabel(balls: number): string {
  if (balls <= 0) {
    return '0'
  }

  const o = Math.floor(balls / 6)
  const b = balls % 6

  if (b === 0) {
    return String(o)
  }

  return `${o}.${b}`
}

export function formatStandingsNrr(n: number): string {
  const v = n === 0 || Math.abs(n) < 1e-8 ? 0 : n
  return v.toFixed(3)
}

export function formatRunsOversLine(runs: number, balls: number): string {
  if (balls <= 0 && runs <= 0) {
    return '0/0'
  }

  return `${runs}/${ballsToOversLabel(balls)}`
}

export function computeSeasonStandings(
  matches: MatchLite[],
  teamIds: number[],
): StandingRow[] {
  const inSeason = new Set(teamIds)

  type Acc = {
    played: number
    won: number
    lost: number
    tied: number
    nr: number
    runsFor: number
    ballsFaced: number
    runsAgainst: number
    ballsBowled: number
  }

  const byId = new Map<number, Acc>()

  for (const id of teamIds) {
    byId.set(id, {
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      nr: 0,
      runsFor: 0,
      ballsFaced: 0,
      runsAgainst: 0,
      ballsBowled: 0,
    })
  }

  for (const m of matches) {
    if (m.status !== 'completed') continue

    const home = m.home_team_id
    const away = m.away_team_id

    if (!inSeason.has(home) || !inSeason.has(away)) continue

    const h = byId.get(home)
    const a = byId.get(away)

    if (!h || !a) continue

    h.played += 1
    a.played += 1

    const winnerId = m.result?.winning_team_id

    if (winnerId == null) {
      h.nr += 1
      a.nr += 1
    } else if (winnerId === home) {
      h.won += 1
      a.lost += 1
    } else if (winnerId === away) {
      a.won += 1
      h.lost += 1
    }

    const homeBatting = battingPlayerTotals(m, home)
    const awayBatting = battingPlayerTotals(m, away)

    const homeExtras = teamExtras(m, home)
    const awayExtras = teamExtras(m, away)

    const homeTotalRuns = homeBatting.runs + homeExtras
    const awayTotalRuns = awayBatting.runs + awayExtras

    const homeBowlingBalls = bowlingBallsForTeam(m, home)
    const awayBowlingBalls = bowlingBallsForTeam(m, away)

    const homeActualBallsFaced =
      awayBowlingBalls > 0 ? awayBowlingBalls : homeBatting.balls

    const awayActualBallsFaced =
      homeBowlingBalls > 0 ? homeBowlingBalls : awayBatting.balls

    const homeAllottedBalls = allottedBallsForTeam(m, home)
    const awayAllottedBalls = allottedBallsForTeam(m, away)

    const homeWicketsLost = battingWicketsLostForTeam(m, home)
    const awayWicketsLost = battingWicketsLostForTeam(m, away)

    const homeBallsFaced = nrrBallsForInnings(
      homeActualBallsFaced,
      homeWicketsLost,
      homeAllottedBalls,
    )

    const awayBallsFaced = nrrBallsForInnings(
      awayActualBallsFaced,
      awayWicketsLost,
      awayAllottedBalls,
    )

    const homeBallsBowled = awayBallsFaced
    const awayBallsBowled = homeBallsFaced

    h.runsFor += homeTotalRuns
    h.ballsFaced += homeBallsFaced
    h.runsAgainst += awayTotalRuns
    h.ballsBowled += homeBallsBowled

    a.runsFor += awayTotalRuns
    a.ballsFaced += awayBallsFaced
    a.runsAgainst += homeTotalRuns
    a.ballsBowled += awayBallsBowled
  }

  return teamIds.map((teamId) => {
    const r = byId.get(teamId) ?? {
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      nr: 0,
      runsFor: 0,
      ballsFaced: 0,
      runsAgainst: 0,
      ballsBowled: 0,
    }

    const points = r.won * 2 + r.tied

    const nrr = nrrFrom(
      r.runsFor,
      r.ballsFaced,
      r.runsAgainst,
      r.ballsBowled,
    )

    return {
      teamId,
      played: r.played,
      won: r.won,
      lost: r.lost,
      tied: r.tied,
      nr: r.nr,
      points,
      runsFor: r.runsFor,
      ballsFaced: r.ballsFaced,
      runsAgainst: r.runsAgainst,
      ballsBowled: r.ballsBowled,
      nrr,
    }
  })
}

export function sortStandingsDesc(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points
    }

    if (b.nrr !== a.nrr) {
      return b.nrr - a.nrr
    }

    if (b.won !== a.won) {
      return b.won - a.won
    }

    if (a.lost !== b.lost) {
      return a.lost - b.lost
    }

    return a.teamId - b.teamId
  })
}

export function aggregatePlayerBatting(matches: MatchLite[]): Map<number, number> {
  const runs = new Map<number, number>()

  for (const m of matches) {
    for (const row of statRows(m)) {
      const pid = row.player_id

      if (typeof pid !== 'number') continue

      const r = row.runs
      const n = typeof r === 'number' ? r : 0

      runs.set(pid, (runs.get(pid) ?? 0) + n)
    }
  }

  return runs
}

export function aggregatePlayerBowlingWickets(
  matches: MatchLite[],
): Map<number, number> {
  const wk = new Map<number, number>()

  for (const m of matches) {
    for (const row of statRows(m)) {
      const pid = row.player_id

      if (typeof pid !== 'number') continue

      const w = row.wickets
      const n = typeof w === 'number' ? w : 0

      wk.set(pid, (wk.get(pid) ?? 0) + n)
    }
  }

  return wk
}

export function aggregateTeamBattingRuns(matches: MatchLite[]): Map<number, number> {
  const tr = new Map<number, number>()

  for (const m of matches) {
    for (const row of statRows(m)) {
      const tid = row.team_id

      if (typeof tid !== 'number') continue

      const r = row.runs
      const n = typeof r === 'number' ? r : 0

      tr.set(tid, (tr.get(tid) ?? 0) + n)
    }
  }

  return tr
}

export function topNMap(
  m: Map<number, number>,
  n: number,
): Array<{ id: number; value: number }> {
  return [...m.entries()]
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n)
}
