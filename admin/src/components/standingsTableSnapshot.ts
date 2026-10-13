import {
  formatRunsOversLine,
  formatStandingsNrr,
  type StandingRow,
} from '../../../website/src/lib/leagueSeasonAggregates'
import type { StoryTableVariant } from './StoryTableExtensions'

export type RankedStandingRow = StandingRow & { rank: number }
export type ColumnKey =
  | 'position'
  | 'team'
  | 'played'
  | 'won'
  | 'lost'
  | 'tied'
  | 'noResult'
  | 'for'
  | 'against'
  | 'nrr'
  | 'battingBonus'
  | 'chaseBonus'
  | 'points'

export const standingColumns: Array<{ key: ColumnKey; label: string }> = [
  { key: 'position', label: 'Pos' },
  { key: 'team', label: 'Team' },
  { key: 'played', label: 'P' },
  { key: 'won', label: 'W' },
  { key: 'lost', label: 'L' },
  { key: 'tied', label: 'Tied' },
  { key: 'noResult', label: 'NR' },
  { key: 'for', label: 'For' },
  { key: 'against', label: 'Against' },
  { key: 'nrr', label: 'NRR' },
  { key: 'battingBonus', label: 'Bat BP' },
  { key: 'chaseBonus', label: 'Chase BP' },
  { key: 'points', label: 'Pts' },
]

export const defaultStandingColumns: ColumnKey[] = [
  'position', 'team', 'played', 'won', 'lost', 'nrr', 'points',
]

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      default: return '&#39;'
    }
  })
}

function cellValue(
  column: ColumnKey,
  row: RankedStandingRow,
  teamsById: Map<number, string>,
): string {
  switch (column) {
    case 'position': return String(row.rank)
    case 'team': return teamsById.get(row.teamId) ?? `Team #${row.teamId}`
    case 'played': return String(row.played)
    case 'won': return String(row.won)
    case 'lost': return String(row.lost)
    case 'tied': return String(row.tied)
    case 'noResult': return String(row.nr)
    case 'for': return formatRunsOversLine(row.runsFor, row.ballsFaced)
    case 'against': return formatRunsOversLine(row.runsAgainst, row.ballsBowled)
    case 'nrr': return formatStandingsNrr(row.nrr)
    case 'battingBonus': return String(row.battingBonusPoints)
    case 'chaseBonus': return String(row.chaseBonusPoints)
    case 'points': return String(row.points)
  }
}

export function buildStandingsSnapshotHtml(
  rows: RankedStandingRow[],
  selectedColumns: ColumnKey[],
  teamsById: Map<number, string>,
  variant: StoryTableVariant,
): string {
  const orderedColumns = standingColumns.filter(({ key }) => selectedColumns.includes(key))
  const header = orderedColumns.map(({ label }) =>
    `<th scope="col"><p>${escapeHtml(label)}</p></th>`,
  ).join('')
  const body = rows.map((row) => {
    const cells = orderedColumns.map(({ key }) =>
      `<td><p>${escapeHtml(cellValue(key, row, teamsById))}</p></td>`,
    ).join('')
    return `<tr>${cells}</tr>`
  }).join('')

  return (
    `<table class="story-table story-table--${variant}">` +
    `<tbody><tr>${header}</tr>${body}</tbody></table><p></p>`
  )
}
