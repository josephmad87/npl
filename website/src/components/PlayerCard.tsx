import { Link } from '@tanstack/react-router'
import { playerPlaceholderSrc, resolvePlayerPhotoSrc } from '../lib/playerPhotoSrc'

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
      <div className="ui-player-card__media">
        {isCaptain ? (
          <span className="ui-player-card__ribbon" aria-label="Captain">
            Captain
          </span>
        ) : null}
        <img
          className="ui-player-card__photo"
          src={resolvePlayerPhotoSrc(player.profile_photo_url)}
          alt={player.full_name}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.onerror = null
            e.currentTarget.src = playerPlaceholderSrc
          }}
        />
      </div>
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
