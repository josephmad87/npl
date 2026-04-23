import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { ErrorNotice } from './components/ErrorNotice'
import { PageHero } from './components/PageHero'
import { Spinner } from './components/Spinner'
import { formatCategoryLabel } from './lib/formatters'
import { useTeamsMap } from './lib/hooks'
import { fetchJson, resolveMediaUrl } from './lib/publicApi'

type PlayerDetail = {
  id: number
  full_name: string
  slug: string
  profile_photo_url: string | null
  team_id: number
  category: string
  date_of_birth: string | null
  nationality: string | null
  role: string | null
  batting_style: string | null
  bowling_style: string | null
  jersey_number: number | null
  bio: string | null
  debut_info: string | null
  status: string
  matches_played: number
  runs_scored: number
  batting_average: number | null
  strike_rate: number | null
  highest_score: number | null
  wickets_taken: number
  bowling_average: number | null
  economy_rate: number | null
  best_bowling: string | null
  catches: number
  stumpings: number
  player_of_match_awards: number
}

export default function PlayerDetailPage() {
  const { slug } = useParams({ from: '/players/$slug' })
  const { map: teamsMap } = useTeamsMap()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['player-detail', slug],
    queryFn: () => fetchJson<PlayerDetail>(`/public/players/${slug}`),
    retry: 1,
  })
  const team = data ? teamsMap[data.team_id] : null

  return (
    <>
      {data ? (
        <PageHero
          variant="siteLogo"
          title={data.full_name}
          subtitle={`${formatCategoryLabel(data.category)}${data.role ? ` • ${data.role}` : ''}${team ? ` • ${team.name}` : ''}`}
        />
      ) : null}
      <main className="container">
        <section className="menu-page">
          {isLoading ? <Spinner label="Loading player..." /> : null}
          {isError ? <ErrorNotice message="Could not load player profile." /> : null}
          {data ? (
            <>
              {resolveMediaUrl(data.profile_photo_url) ? (
                <div className="team-detail-homeground-media">
                  <img
                    src={resolveMediaUrl(data.profile_photo_url) ?? ''}
                    alt={data.full_name}
                    loading="eager"
                    decoding="async"
                  />
                </div>
              ) : null}
              <div className="menu-list">
                <article className="menu-list-item">
                  <div>
                    <h2>Team</h2>
                    {team ? (
                      <p>
                        <Link to="/teams/$slug" params={{ slug: team.slug }}>
                          {team.name}
                        </Link>
                      </p>
                    ) : (
                      <p>—</p>
                    )}
                  </div>
                </article>
                <article className="menu-list-item">
                  <div>
                    <h2>Status</h2>
                    <p>{data.status}</p>
                  </div>
                </article>
                {data.jersey_number != null ? (
                  <article className="menu-list-item">
                    <div>
                      <h2>Jersey</h2>
                      <p>#{data.jersey_number}</p>
                    </div>
                  </article>
                ) : null}
                {data.nationality ? (
                  <article className="menu-list-item">
                    <div>
                      <h2>Nationality</h2>
                      <p>{data.nationality}</p>
                    </div>
                  </article>
                ) : null}
                {data.batting_style ? (
                  <article className="menu-list-item">
                    <div>
                      <h2>Batting</h2>
                      <p>{data.batting_style}</p>
                    </div>
                  </article>
                ) : null}
                {data.bowling_style ? (
                  <article className="menu-list-item">
                    <div>
                      <h2>Bowling</h2>
                      <p>{data.bowling_style}</p>
                    </div>
                  </article>
                ) : null}
                <article className="menu-list-item menu-list-item--stacked">
                  <div>
                    <h2>Profile</h2>
                    <p>{data.bio ?? data.debut_info ?? 'Profile coming soon.'}</p>
                  </div>
                </article>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </>
  )
}
