import {
  formatCricketOvers,
  formatDismissalDisplay,
  getInningsSides,
  hasBattingLine,
  hasBowlingLine,
  type InningsNumber,
} from '@/lib/cricket'

type ScorecardStat = {
  id: number
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
    .filter((s) => s.team_id === sides.battingTeamId && hasBattingLine(s))
    .sort((a, b) => {
      const runsDelta = (b.runs ?? 0) - (a.runs ?? 0)
      if (runsDelta !== 0) return runsDelta
      return (a.balls_faced ?? 0) - (b.balls_faced ?? 0)
    })

  const bowlingRows = stats
    .filter((s) => s.team_id === sides.bowlingTeamId && hasBowlingLine(s))
    .sort((a, b) => (b.wickets ?? 0) - (a.wickets ?? 0))

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
                  <th>Player</th>
                  <th>R</th>
                  <th>BF</th>
                  <th>4s</th>
                  <th>6s</th>
                  <th>How out</th>
                </tr>
              </thead>
              <tbody>
                {battingRows.map((s) => (
                  <tr key={`bat-${s.id}`}>
                    <td>{playerName(s.player_id)}</td>
                    <td>{s.runs}</td>
                    <td>{s.balls_faced}</td>
                    <td>{s.fours}</td>
                    <td>{s.sixes}</td>
                    <td>{formatDismissalDisplay(s.dismissal)}</td>
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
                  <th>Player</th>
                  <th>Ov</th>
                  <th>M</th>
                  <th>Conc</th>
                  <th>W</th>
                  <th>Ct</th>
                  <th>St</th>
                  <th>RO</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {bowlingRows.map((s) => (
                  <tr key={`bowl-${s.id}`}>
                    <td>{playerName(s.player_id)}</td>
                    <td>
                      {s.overs != null && s.overs !== ''
                        ? formatCricketOvers(s.overs)
                        : '—'}
                    </td>
                    <td>{s.maidens}</td>
                    <td>{s.runs_conceded}</td>
                    <td>{s.wickets}</td>
                    <td>{s.catches}</td>
                    <td>{s.stumpings}</td>
                    <td>{s.run_outs}</td>
                    <td>{s.notes ?? '—'}</td>
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
