import { BadgeImage } from '@/components/BadgeImage'
import type { MatchDto } from '@/lib/api-types'
import { matchWinnerSide } from '@/lib/match-winner'

export type MatchTableTeamRow = MatchDto & {
  home_name: string
  away_name: string
  home_logo_url: string | null
  away_logo_url: string | null
}

type MatchTableTeamCellProps = Readonly<{
  side: 'home' | 'away'
  row: MatchTableTeamRow
}>

export function MatchTableTeamCell({ side, row }: MatchTableTeamCellProps) {
  const winner = matchWinnerSide(row)
  const isWinner = winner === side
  const imageUrl = side === 'home' ? row.home_logo_url : row.away_logo_url
  const name = side === 'home' ? row.home_name : row.away_name

  return (
    <span className="table-cell-with-badge">
      <span
        className={`entity-thumb-card__badge-wrap${isWinner ? ' entity-thumb-card__badge-wrap--winner' : ''}`}
        aria-label={isWinner ? 'Winner' : undefined}
      >
        <BadgeImage imageUrl={imageUrl} alt="" size="sm" />
        {isWinner ? (
          <span
            className="entity-thumb-card__winner-cup entity-thumb-card__winner-cup--table"
            aria-hidden
            title="Winner"
          >
            🏆
          </span>
        ) : null}
      </span>
      <span>{name}</span>
    </span>
  )
}
