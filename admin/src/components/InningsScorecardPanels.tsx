import {
  formatCricketOvers,
  formatDismissalDisplay,
  getInningsSides,
  hasBattingLine,
  hasBowlingLine,
  oversFieldToBalls,
  type InningsNumber,
} from '@/lib/cricket'

type ScorecardStat = {
  id: number
  lineup_order?: number
  batting_order?: number | null
  bowling_order?: number | null
  player_id: number
  team_id: number
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  dismissal: string | null
  overs: string | number | null
  maidens: number
  runs_conceded: number
  wickets: number
  catches: number
  stumpings: number
  run_outs: number
  notes: string | null
}

type InningsScorecardPanelsProps = Readonly<{
  innings: InningsNumber
  battingFirstTeamId: number | null
  homeTeamId: number
  awayTeamId: number
  homeLabel: string
  awayLabel: string
  stats: ScorecardStat[]
  playerName: (playerId: number) => string
  extrasLine?: string | null
}>

function teamLabel(
  teamId: number,
  homeTeamId: number,
  awayTeamId: number,
  homeLabel: string,
  awayLabel: string,
): string {
  if (teamId === homeTeamId) return homeLabel
  if (teamId === awayTeamId) return awayLabel
  return `#${teamId}`
}
function formatEconomyRate(
  runsConceded: number,
  overs: string | number | null,
): string {
  const balls = oversFieldToBalls(overs)

  if (balls <= 0) {
    return '—'
  }

  return ((runsConceded * 6) / balls).toFixed(2)
}

function formatStrikeRate(
  runs: number | null | undefined,
  ballsFaced: number | null | undefined,
): string {
  const balls = ballsFaced ?? 0

  if (balls <= 0) {
    return '—'
  }

  return (((runs ?? 0) * 100) / balls).toFixed(2)
}

function compareRecordedOrder(
  a: ScorecardStat,
  b: ScorecardStat,
  field: 'batting_order' | 'bowling_order',
): number {
  const aOrder = a[field]
  const bOrder = b[field]

  if (aOrder != null && bOrder == null) return -1
  if (aOrder == null && bOrder != null) return 1

  const orderDelta = (aOrder ?? 0) - (bOrder ?? 0)

  if (orderDelta !== 0) {
    return orderDelta
  }

  const lineupDelta =
    (a.lineup_order ?? Number.MAX_SAFE_INTEGER) -
    (b.lineup_order ?? Number.MAX_SAFE_INTEGER)

  return lineupDelta || a.id - b.id
}

function compareBattingOrder(a: ScorecardStat, b: ScorecardStat): number {
  return compareRecordedOrder(a, b, 'batting_order')
}

function compareBowlingOrder(a: ScorecardStat, b: ScorecardStat): number {
  return compareRecordedOrder(a, b, 'bowling_order')
}
export function InningsScorecardPanels({
  innings,
  battingFirstTeamId,
  homeTeamId,
  awayTeamId,
  homeLabel,
  awayLabel,
  stats,
  playerName,
  extrasLine,
}: InningsScorecardPanelsProps) {
  const sides = getInningsSides(
    innings,
    battingFirstTeamId,
    homeTeamId,
    awayTeamId,
  )
  if (!sides) {
    return (
      <p className="muted">
        Batting-first team is not set for this match. Edit the result to choose
        which team batted first.
      </p>
    )
  }

  const battingLabel = teamLabel(
    sides.battingTeamId,
    homeTeamId,
    awayTeamId,
    homeLabel,
    awayLabel,
  )
  const bowlingLabel = teamLabel(
    sides.bowlingTeamId,
    homeTeamId,
    awayTeamId,
    homeLabel,
    awayLabel,
  )

const battingRows = stats
  .filter(
    (s) =>
      s.team_id === sides.battingTeamId &&
      (s.batting_order != null || hasBattingLine(s)),
  )
  .sort(compareBattingOrder)

const bowlingRows = stats
  .filter(
    (s) =>
      s.team_id === sides.bowlingTeamId &&
      hasBowlingLine(s),
  )
  .sort(compareBowlingOrder)

  return (
    <div className="innings-scorecard-panels">
      {extrasLine ? <p className="muted">{extrasLine}</p> : null}
      <section className="innings-scorecard-panels__section">
        <h3 className="innings-scorecard-panels__h">Batting — {battingLabel}</h3>
        {battingRows.length > 0 ? (
          <div className="table-scroll match-stats-scroll">
            <table className="data-table match-stats-table">
              <thead>
                <tr>
                  <th>Batter</th>
                  <th>How out</th>
                  <th>R</th>
                  <th>B</th>
                  <th>4s</th>
                  <th>6s</th>
                  <th>SR</th>
                </tr>
              </thead>
              <tbody>
                {battingRows.map((s) => (
                  <tr key={`bat-${s.id}`}>
                    <td>{playerName(s.player_id)}</td>
                    <td>{formatDismissalDisplay(s.dismissal)}</td>
                    <td>{s.runs}</td>
                    <td>{s.balls_faced}</td>
                    <td>{s.fours}</td>
                    <td>{s.sixes}</td>
                    <td>{formatStrikeRate(s.runs, s.balls_faced)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No batting rows for this innings.</p>
        )}
      </section>
      <section className="innings-scorecard-panels__section">
        <h3 className="innings-scorecard-panels__h">Bowling — {bowlingLabel}</h3>
        {bowlingRows.length > 0 ? (
          <div className="table-scroll match-stats-scroll">
            <table className="data-table match-stats-table">
              <thead>
                <tr>
                 <th>Bowler</th>
                  <th>O</th>
                  <th>M</th>
                  <th>R</th>
                  <th>W</th>
                  <th>Econ</th>
                </tr>
              </thead>
              <tbody>
                {bowlingRows.map((s) => (
                  <tr key={`bowl-${s.id}`}>
                    <td>{playerName(s.player_id)}</td>
                    <td>{s.overs != null && s.overs !== '' ? formatCricketOvers(s.overs) : '—'}</td>
                    <td>{s.maidens}</td>
                    <td>{s.runs_conceded}</td>
                    <td>{s.wickets}</td>
                    <td>{formatEconomyRate(s.runs_conceded, s.overs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No bowling rows for this innings.</p>
        )}
      </section>
    </div>
  )
}
