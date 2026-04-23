import type { MatchLite } from './hooks'

export function statRows(match: MatchLite): Array<Record<string, unknown>> {
  return Array.isArray(match.player_stats) ? (match.player_stats as Array<Record<string, unknown>>) : []
}

export function num(r: Record<string, unknown>, k: string): number {
  const v = r[k]
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  return 0
}

function str(r: Record<string, unknown>, k: string): string {
  const v = r[k]
  return typeof v === 'string' ? v : ''
}

function isNotOut(dismissal: string): boolean {
  const t = dismissal.trim()
  if (!t) return true
  if (/not out/i.test(t)) return true
  return false
}

export type BattingAgg = {
  playerId: number
  teamId: number
  matchIds: Set<number>
  innings: number
  runs: number
  balls: number
  fours: number
  sixes: number
  notOuts: number
  highScore: number
  scores50: number
  scores100: number
}

export type BowlingAgg = {
  playerId: number
  teamId: number
  matchIds: Set<number>
  overs: number
  maidens: number
  runsConceded: number
  wickets: number
  ballsBowled: number
  catches: number
  stumpings: number
}

type RowFilter = (row: Record<string, unknown>, matchId: number) => boolean

function accumulate(matches: MatchLite[], filter: RowFilter) {
  const batting = new Map<number, BattingAgg>()
  const bowling = new Map<number, BowlingAgg>()
  const seenMatches = new Set<number>()

  for (const m of matches) {
    if (m.status !== 'completed') continue
    const mid = m.id
    for (const row of statRows(m)) {
      if (!filter(row, mid)) continue
      const pid = row.player_id
      const tid = row.team_id
      if (typeof pid !== 'number' || typeof tid !== 'number') continue

      const runs = num(row, 'runs')
      const ballsFaced = num(row, 'balls_faced')
      const fours = num(row, 'fours')
      const sixes = num(row, 'sixes')
      const wk = num(row, 'wickets')
      const ov = num(row, 'overs')
      const rCon = num(row, 'runs_conceded')
      const mai = num(row, 'maidens')
      const dismiss = str(row, 'dismissal')
      const cat = num(row, 'catches')
      const st = num(row, 'stumpings')

      let touched = false
      if (ballsFaced > 0 || runs > 0 || fours > 0 || sixes > 0) {
        let b = batting.get(pid)
        if (!b) {
          b = {
            playerId: pid,
            teamId: tid,
            matchIds: new Set(),
            innings: 0,
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            notOuts: 0,
            highScore: 0,
            scores50: 0,
            scores100: 0,
          }
          batting.set(pid, b)
        }
        b.matchIds.add(mid)
        b.innings += 1
        b.runs += runs
        b.balls += ballsFaced
        b.fours += fours
        b.sixes += sixes
        b.highScore = Math.max(b.highScore, runs)
        if (isNotOut(dismiss)) b.notOuts += 1
        if (runs >= 100) b.scores100 += 1
        else if (runs >= 50) b.scores50 += 1
        touched = true
      }

      if (ov > 0 || wk > 0 || rCon > 0) {
        let w = bowling.get(pid)
        if (!w) {
          w = {
            playerId: pid,
            teamId: tid,
            matchIds: new Set(),
            overs: 0,
            maidens: 0,
            runsConceded: 0,
            wickets: 0,
            ballsBowled: 0,
            catches: 0,
            stumpings: 0,
          }
          bowling.set(pid, w)
        }
        w.matchIds.add(mid)
        w.overs += ov
        w.maidens += mai
        w.runsConceded += rCon
        w.wickets += wk
        w.ballsBowled += ov * 6
        touched = true
      }

      if (cat > 0 || st > 0) {
        let w = bowling.get(pid)
        if (!w) {
          w = {
            playerId: pid,
            teamId: tid,
            matchIds: new Set(),
            overs: 0,
            maidens: 0,
            runsConceded: 0,
            wickets: 0,
            ballsBowled: 0,
            catches: 0,
            stumpings: 0,
          }
          bowling.set(pid, w)
        }
        w.matchIds.add(mid)
        w.catches += cat
        w.stumpings += st
        touched = true
      }

      if (touched) seenMatches.add(mid)
    }
  }

  return { batting, bowling, matchCount: seenMatches.size, seenMatches }
}

export function aggregateTournament(matches: MatchLite[]) {
  return accumulate(matches, () => true)
}

export function aggregateForTeam(matches: MatchLite[], teamId: number) {
  return accumulate(
    matches,
    (row) => Number(row.team_id) === teamId,
  )
}

export function aggregateForPlayer(matches: MatchLite[], playerId: number) {
  return accumulate(
    matches,
    (row) => Number(row.player_id) === playerId,
  )
}

export type TourneyKpi = { label: string; value: string | number }

function kpisFromMaps(
  batting: Map<number, BattingAgg>,
  bowling: Map<number, BowlingAgg>,
  matchCount: number,
): TourneyKpi[] {
  let runs = 0
  let ballsFaced = 0
  let fours = 0
  let sixes = 0
  let innings = 0
  let wk = 0
  let c50 = 0
  let c100 = 0
  let maid = 0
  let overs = 0
  let rCon = 0
  let catches = 0
  let stumps = 0

  for (const b of batting.values()) {
    runs += b.runs
    ballsFaced += b.balls
    fours += b.fours
    sixes += b.sixes
    innings += b.innings
    c50 += b.scores50
    c100 += b.scores100
  }
  for (const w of bowling.values()) {
    wk += w.wickets
    maid += w.maidens
    overs += w.overs
    rCon += w.runsConceded
    catches += w.catches
    stumps += w.stumpings
  }

  const boundaryRuns = fours * 4 + sixes * 6
  const runFrom1s2s3s = Math.max(0, runs - boundaryRuns)
  const estDots = Math.max(0, ballsFaced - runFrom1s2s3s - fours - sixes)
  const dotPct = ballsFaced > 0 ? (estDots / ballsFaced) * 100 : 0
  const boundaryPct = runs > 0 ? (boundaryRuns / runs) * 100 : 0
  const extras = 0

  return [
    { label: 'Matches', value: matchCount },
    { label: 'Innings', value: innings },
    { label: 'Runs', value: runs },
    { label: 'Wickets', value: wk },
    { label: 'Balls', value: Math.round(ballsFaced) },
    { label: 'Ones', value: '—' },
    { label: 'Twos', value: '—' },
    { label: 'Threes', value: '—' },
    { label: 'Fours', value: fours },
    { label: 'Sixes', value: sixes },
    { label: "50's", value: c50 },
    { label: "100's", value: c100 },
    { label: '50+ partnership', value: '—' },
    { label: '100+ partnership', value: '—' },
    { label: 'Maidens', value: maid },
    { label: 'Dot balls (est.)', value: Math.round(estDots) },
    { label: 'Dot ball %', value: dotPct.toFixed(2) },
    { label: 'DB freq.', value: '—' },
    { label: 'Bdry freq.', value: '—' },
    { label: 'Boundary %', value: runs > 0 ? boundaryPct.toFixed(2) : '—' },
    { label: 'Extras', value: extras },
    { label: 'Catches', value: catches },
    { label: 'Stumpings', value: stumps },
    { label: 'Overs', value: overs.toFixed(1) },
    { label: 'Runs (conc.)', value: rCon },
  ]
}

export function kpiTournamentList(matches: MatchLite[]): TourneyKpi[] {
  const { batting, bowling, matchCount } = aggregateTournament(matches)
  return kpisFromMaps(batting, bowling, matchCount)
}

export function kpiTeamList(matches: MatchLite[], teamId: number): TourneyKpi[] {
  const { batting, bowling, matchCount } = aggregateForTeam(matches, teamId)
  return kpisFromMaps(batting, bowling, matchCount)
}

export function kpiPlayerList(matches: MatchLite[], playerId: number): TourneyKpi[] {
  const { batting, bowling, matchCount } = aggregateForPlayer(matches, playerId)
  return kpisFromMaps(batting, bowling, matchCount)
}

function battingAverage(b: BattingAgg): string {
  const outs = b.innings - b.notOuts
  if (outs <= 0) return b.runs > 0 ? b.runs.toString() : '0'
  return (b.runs / outs).toFixed(2)
}

function battingSR(b: BattingAgg): string {
  if (b.balls <= 0) return '0'
  return ((b.runs / b.balls) * 100).toFixed(2)
}

function economy(w: BowlingAgg): string {
  if (w.overs <= 0) return '—'
  return (w.runsConceded / w.overs).toFixed(2)
}

function bowlSR(w: BowlingAgg): string {
  if (w.wickets <= 0) return '—'
  return (w.ballsBowled / w.wickets).toFixed(1)
}

export type BattingTableRow = {
  pos: number
  playerId: number
  teamId: number
  m: number
  r: number
  i: number
  no: number
  hs: number
  avg: string
  bf: number
  sr: string
  c100: number
  c50: number
  s4: number
  s6: number
}

export function buildBattingLeaderboard(matches: MatchLite[]): BattingTableRow[] {
  const { batting } = aggregateTournament(matches)
  const rows: BattingTableRow[] = []
  for (const b of batting.values()) {
    rows.push({
      pos: 0,
      playerId: b.playerId,
      teamId: b.teamId,
      m: b.matchIds.size,
      r: b.runs,
      i: b.innings,
      no: b.notOuts,
      hs: b.highScore,
      avg: battingAverage(b),
      bf: b.balls,
      sr: battingSR(b),
      c100: b.scores100,
      c50: b.scores50,
      s4: b.fours,
      s6: b.sixes,
    })
  }
  rows.sort((a, b) => b.r - a.r)
  rows.forEach((row, i) => {
    row.pos = i + 1
  })
  return rows
}

export type BowlingTableRow = {
  pos: number
  playerId: number
  teamId: number
  m: number
  wk: number
  o: string
  r: number
  maid: number
  econ: string
  sr: string
  catches: number
  stumpings: number
}

export function buildBowlingLeaderboard(matches: MatchLite[]): BowlingTableRow[] {
  const { bowling } = aggregateTournament(matches)
  const rows: BowlingTableRow[] = []
  for (const w of bowling.values()) {
    if (w.overs <= 0 && w.wickets <= 0) continue
    rows.push({
      pos: 0,
      playerId: w.playerId,
      teamId: w.teamId,
      m: w.matchIds.size,
      wk: w.wickets,
      o: w.overs.toFixed(1),
      r: w.runsConceded,
      maid: w.maidens,
      econ: economy(w),
      sr: bowlSR(w),
      catches: w.catches,
      stumpings: w.stumpings,
    })
  }
  rows.sort((a, b) => b.wk - a.wk || a.r - b.r)
  rows.forEach((row, i) => {
    row.pos = i + 1
  })
  return rows
}

export type TopPerformerSlot = { playerId: number; teamId: number; value: string; sub: string }

export function topPerformers(matches: MatchLite[]): {
  runs: TopPerformerSlot | null
  wickets: TopPerformerSlot | null
  batSR: TopPerformerSlot | null
  economy: TopPerformerSlot | null
} {
  const { batting, bowling } = aggregateTournament(matches)
  let bestRuns: BattingAgg | null = null
  for (const b of batting.values()) {
    if (!bestRuns || b.runs > bestRuns.runs) bestRuns = b
  }
  let bestW: BowlingAgg | null = null
  for (const w of bowling.values()) {
    if (!bestW || w.wickets > bestW.wickets) bestW = w
  }
  let bestSR: BattingAgg | null = null
  for (const b of batting.values()) {
    if (b.balls < 12) continue
    const sr = b.runs / b.balls
    if (!bestSR) {
      bestSR = b
      continue
    }
    if (sr > bestSR.runs / bestSR.balls) bestSR = b
  }

  let bestEcon: BowlingAgg | null = null
  for (const w of bowling.values()) {
    if (w.overs < 5) continue
    const e = w.runsConceded / w.overs
    if (!bestEcon) {
      bestEcon = w
      continue
    }
    if (e < bestEcon.runsConceded / bestEcon.overs) bestEcon = w
  }

  return {
    runs: bestRuns
      ? {
          playerId: bestRuns.playerId,
          teamId: bestRuns.teamId,
          value: String(bestRuns.runs),
          sub: 'RUNS',
        }
      : null,
    wickets: bestW
      ? {
          playerId: bestW.playerId,
          teamId: bestW.teamId,
          value: String(bestW.wickets),
          sub: 'WICKETS',
        }
      : null,
    batSR: bestSR
      ? {
          playerId: bestSR.playerId,
          teamId: bestSR.teamId,
          value: battingSR(bestSR),
          sub: 'SR',
        }
      : null,
    economy: bestEcon
      ? {
          playerId: bestEcon.playerId,
          teamId: bestEcon.teamId,
          value: economy(bestEcon),
          sub: 'ECON',
        }
      : null,
  }
}
