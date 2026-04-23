import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { ErrorNotice } from './components/ErrorNotice'
import { LeagueSeasonHub } from './components/LeagueSeasonHub'
import { MatchCard } from './components/MatchCard'
import { PageHero } from './components/PageHero'
import { PlayerCard } from './components/PlayerCard'
import { SectionHeader } from './components/SectionHeader'
import { Spinner } from './components/Spinner'
import { formatCategoryLabel } from './lib/formatters'
import { type MatchLite, useTeamsMap } from './lib/hooks'
import { extractList, fetchJson, resolveMediaUrl } from './lib/publicApi'

type TeamDetail = {
  id: number
  name: string
  slug: string
  category: string | null
  logo_url: string | null
  cover_image_url: string | null
  home_ground: string | null
  home_ground_name: string | null
  home_ground_location: string | null
  home_ground_image_url: string | null
  captain: string | null
  coach: string | null
  manager: string | null
  year_founded: number | null
  description: string | null
  history: string | null
  trophies: string[] | null
  team_photo_urls: string[] | null
  social_links: Record<string, string> | null
  status: string
}

export function TeamDetailPage() {
  const { slug } = useParams({ from: '/teams/$slug' })
  const { data, isLoading, isError } = useQuery({
    queryKey: ['team-detail', slug],
    queryFn: () => fetchJson<TeamDetail>(`/public/teams/${slug}`),
    retry: 1,
  })
  const [tab, setTab] = useState<'overview' | 'squad' | 'upcoming' | 'results'>('overview')
  const { map: teamsMap } = useTeamsMap()
  const playersQ = useQuery({
    queryKey: ['team-players', data?.id ?? 'none'],
    queryFn: async () =>
      extractList<{
        id: number
        full_name: string
        slug: string
        role: string | null
        jersey_number: number | null
        profile_photo_url: string | null
      }>(await fetchJson<unknown>(`/public/players?page=1&page_size=40&team_id=${data?.id ?? -1}`)),
    enabled: Boolean(data?.id),
    retry: 1,
  })
  const fixturesQ = useQuery({
    queryKey: ['team-fixtures', data?.id ?? 'none'],
    queryFn: async () =>
      extractList<MatchLite>(await fetchJson<unknown>(`/public/fixtures?page=1&page_size=12&team_id=${data?.id ?? -1}`)),
    enabled: Boolean(data?.id),
    retry: 1,
  })
  const resultsQ = useQuery({
    queryKey: ['team-results', data?.id ?? 'none'],
    queryFn: async () =>
      extractList<MatchLite>(await fetchJson<unknown>(`/public/results?page=1&page_size=12&team_id=${data?.id ?? -1}`)),
    enabled: Boolean(data?.id),
    retry: 1,
  })

  const coverHero = data ? resolveMediaUrl(data.cover_image_url) : null
  const firstTeamPhoto = data?.team_photo_urls?.[0] ? resolveMediaUrl(data.team_photo_urls[0]) : null
  const useSiteLogoHero = Boolean(data) && !coverHero && !firstTeamPhoto
  const heroImage = coverHero ?? firstTeamPhoto

  return (
    <>
      {data ? (
        useSiteLogoHero ? (
          <PageHero
            variant="siteLogo"
            title={data.name}
            subtitle={`${formatCategoryLabel(data.category)} • ${data.home_ground ?? 'Venue TBC'} • ${data.status}`}
          />
        ) : (
          <PageHero
            title={data.name}
            subtitle={`${formatCategoryLabel(data.category)} • ${data.home_ground ?? 'Venue TBC'} • ${data.status}`}
            imageUrl={heroImage}
          />
        )
      ) : null}
      <main className="container">
        <section className="menu-page">
        {isLoading ? <Spinner label="Loading team..." /> : null}
        {isError ? <ErrorNotice message="Could not load team details." /> : null}
        {data ? (
          <>
            <div className="detail-tabs">
              {(['overview', 'squad', 'upcoming', 'results'] as const).map((item) => (
                <button key={item} type="button" className={tab === item ? 'is-active' : ''} onClick={() => setTab(item)}>
                  {item}
                </button>
              ))}
            </div>
            {tab === 'overview' ? (
              <>
                <div className="menu-list menu-list--team-overview">
                  <article className="menu-list-item menu-list-item--stacked">
                    <div>
                      <h2>Leadership</h2>
                      <p>
                        Captain: {data.captain ?? 'TBA'} • Coach: {data.coach ?? 'TBA'} •
                        Manager: {data.manager ?? 'TBA'}
                      </p>
                    </div>
                  </article>
                  <article className="menu-list-item menu-list-item--stacked">
                    <div>
                      <h2>Team History</h2>
                      <p>{data.history ?? data.description ?? 'Team profile coming soon.'}</p>
                    </div>
                  </article>
                  <article className="menu-list-item menu-list-item--stacked">
                    <div>
                      <h2>Homeground</h2>
                      <p>
                        {(data.home_ground_name ?? data.home_ground ?? 'TBA')}
                        {data.home_ground_location ? ` • ${data.home_ground_location}` : ''}
                      </p>
                    </div>
                  </article>
                  <article className="menu-list-item menu-list-item--stacked">
                    <div>
                      <h2>Founded</h2>
                      <p>{data.year_founded ?? 'N/A'}</p>
                    </div>
                  </article>
                </div>

                {data.home_ground_image_url ? (
                  <>
                    <SectionHeader title="Homeground Photo" />
                    <div className="team-detail-homeground-media">
                      <img
                        src={resolveMediaUrl(data.home_ground_image_url) ?? ''}
                        alt={data.home_ground_name ?? data.name}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </>
                ) : null}

                {(data.trophies ?? []).length > 0 ? (
                  <>
                    <SectionHeader title="Team Trophies" />
                    <div className="team-detail-chips">
                      {(data.trophies ?? []).map((trophy, idx) => (
                        <span key={`${trophy}-${idx}`} className="team-detail-chip">
                          {trophy}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}

                {(data.team_photo_urls ?? []).length > 0 ? (
                  <>
                    <SectionHeader title="Team Photos" />
                    <div className="home-grid home-grid--gallery">
                      {(data.team_photo_urls ?? []).map((photoUrl, idx) => (
                        <article
                          key={`${photoUrl}-${idx}`}
                          className="ui-gallery-card team-detail-photo-card"
                        >
                          <img
                            src={resolveMediaUrl(photoUrl) ?? ''}
                            alt={`${data.name} photo ${idx + 1}`}
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="ui-gallery-card__body">
                            <span className="ui-gallery-card__badge ui-gallery-card__badge--image">
                              Team Photo
                            </span>
                            <h3 className="ui-gallery-card__title">
                              {data.name} Photo {idx + 1}
                            </h3>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
            {tab === 'squad' ? (
              <div className="home-grid home-grid--players">
                {(playersQ.data ?? []).map((player) => (
                  <PlayerCard key={player.id} player={player} />
                ))}
              </div>
            ) : null}
            {tab === 'upcoming' ? (
              <div className="home-grid home-grid--matches">
                {(fixturesQ.data ?? []).map((match) => (
                  <MatchCard key={match.id} match={match} teamsMap={teamsMap} />
                ))}
              </div>
            ) : null}
            {tab === 'results' ? (
              <div className="home-grid home-grid--matches">
                {(resultsQ.data ?? []).map((match) => (
                  <MatchCard key={match.id} match={match} teamsMap={teamsMap} mode="result" />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
        </section>
      </main>
    </>
  )
}

export function LeagueDetailPage() {
  const { slug } = useParams({ from: '/leagues/$slug' })
  const navigate = useNavigate()
  return (
    <LeagueSeasonHub
      key={slug}
      leagueSlug={slug}
      onLeagueSlugChange={(next) => {
        void navigate({ to: '/leagues/$slug', params: { slug: next } })
      }}
      showDescription
    />
  )
}

export function SeasonDetailPage() {
  const { leagueSlug, seasonSlug } = useParams({ from: '/leagues/$leagueSlug/seasons/$seasonSlug' })
  const navigate = useNavigate()
  return (
    <LeagueSeasonHub
      key={`${leagueSlug}-${seasonSlug}`}
      leagueSlug={leagueSlug}
      onLeagueSlugChange={(next) => {
        void navigate({ to: '/leagues/$slug', params: { slug: next } })
      }}
      seasonSlugFromRoute={seasonSlug}
      onSeasonSlugNavigate={(s) => {
        void navigate({
          to: '/leagues/$leagueSlug/seasons/$seasonSlug',
          params: { leagueSlug, seasonSlug: s },
        })
      }}
      showDescription
    />
  )
}
