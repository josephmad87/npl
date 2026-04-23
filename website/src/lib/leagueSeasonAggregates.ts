import type { MatchLite } from './hooks'

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
  return Array.isArray(match.player_stats) ? (match.player_stats as Array<Record<string, unknown>>) : []
}

function num(r: Record<string, unknown>, k: string): number {
  const v = r[k]
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  return 0
}

/**
 * Convert bowling "overs" from the API (e.g. 67.1 = 67 overs 1 ball) to total balls.
 */
function oversFieldToBalls(ov: unknown): number {
  if (ov == null) return 0
  const raw = typeof ov === 'number' ? ov : Number(ov)
  if (Number.isNaN(raw) || raw <= 0) return 0
  const n = Math.round(raw * 10) / 10
  const s = n.toString()
  if (!s.includes('.')) {
    return Math.floor(n) * 6
  }
  const [whole, frac] = s.split('.')
  const w = parseInt(whole, 10) || 0
  const f = (frac ?? '').replace(/\D/g, '')
  if (!f) return w * 6
  const b = Math.min(5, parseInt(f[0] ?? '0', 10) || 0)
  return w * 6 + b
}

function nrrFrom(runsFor: number, ballsFaced: number, runsAgainst: number, ballsBowled: number): number {
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
    byId.set(id, { played: 0, won: 0, lost: 0, tied: 0, nr: 0, runsFor: 0, ballsFaced: 0, runsAgainst: 0, ballsBowled: 0 })
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
    const w = m.result?.winning_team_id
    if (w == null) {
      h.tied += 1
      a.tied += 1
    } else if (w === home) {
      h.won += 1
      a.lost += 1
    } else if (w === away) {
      a.won += 1
      h.lost += 1
    }
  }

  for (const m of matches) {
    if (m.status !== 'completed') continue
    for (const row of statRows(m)) {
      const tid = row.team_id
      if (typeof tid !== 'number' || !inSeason.has(tid)) continue
      const acc = byId.get(tid)
      if (!acc) continue
      const runs = num(row, 'runs')
      const ballsFaced = num(row, 'balls_faced')
      const wk = num(row, 'wickets')
      const rCon = num(row, 'runs_conceded')
      const o = num(row, 'overs')
      const isBatting = ballsFaced > 0 || runs > 0
      const isBowling = o > 0 || wk > 0 || rCon > 0
      if (isBatting) {
        acc.runsFor += runs
        acc.ballsFaced += ballsFaced
      }
      if (isBowling) {
        acc.runsAgainst += rCon
        if (o > 0) {
          acc.ballsBowled += oversFieldToBalls(row.overs)
        }
      }
    }
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
    const nrr = nrrFrom(r.runsFor, r.ballsFaced, r.runsAgainst, r.ballsBowled)
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

export function aggregatePlayerBowlingWickets(matches: MatchLite[]): Map<number, number> {
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

export function topNMap(m: Map<number, number>, n: number): Array<{ id: number; value: number }> {
  return [...m.entries()]
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n)
}
