import { Link } from '@tanstack/react-router'
import { resolveMediaUrl } from '../lib/publicApi'

type PlayerLite = {
  id: number
  full_name: string
  slug?: string
  role?: string | null
  jersey_number?: number | null
  profile_photo_url?: string | null
}

export function PlayerCard({
  player,
  isCaptain,
}: {
  player: PlayerLite
  isCaptain?: boolean
}) {
  const inner = (
    <>
      {isCaptain ? (
        <span className="ui-player-card__ribbon" aria-label="Captain">
          Captain
        </span>
      ) : null}
      {player.profile_photo_url ? (
        <img
          src={resolveMediaUrl(player.profile_photo_url) ?? player.profile_photo_url}
          alt={player.full_name}
        />
      ) : (
        <div className="ui-player-card-placeholder" />
      )}
      <div>
        <h3>{player.full_name}</h3>
        <p>{player.role ?? 'Player'}</p>
        {player.jersey_number ? <p>#{player.jersey_number}</p> : null}
      </div>
    </>
  )
  const cardClass =
    `ui-player-card${isCaptain ? ' ui-player-card--captain' : ''}`
  if (player.slug) {
    return (
      <Link
        to="/players/$slug"
        params={{ slug: player.slug }}
        className={cardClass}
      >
        {inner}
      </Link>
    )
  }
  return <article className={cardClass}>{inner}</article>
}
