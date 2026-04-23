import { Link } from '@tanstack/react-router'

type PlayerLite = {
  id: number
  full_name: string
  slug?: string
  role?: string | null
  jersey_number?: number | null
  profile_photo_url?: string | null
}

export function PlayerCard({ player }: { player: PlayerLite }) {
  const inner = (
    <>
      {player.profile_photo_url ? (
        <img src={player.profile_photo_url} alt={player.full_name} />
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
  if (player.slug) {
    return (
      <Link to="/players/$slug" params={{ slug: player.slug }} className="ui-player-card">
        {inner}
      </Link>
    )
  }
  return <article className="ui-player-card">{inner}</article>
}
