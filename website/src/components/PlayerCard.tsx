type PlayerLite = {
  id: number
  full_name: string
  role?: string | null
  jersey_number?: number | null
  profile_photo_url?: string | null
}

export function PlayerCard({ player }: { player: PlayerLite }) {
  return (
    <article className="ui-player-card">
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
    </article>
  )
}
