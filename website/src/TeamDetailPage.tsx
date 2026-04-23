import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ErrorNotice } from './components/ErrorNotice'
import { GalleryCard } from './components/GalleryCard'
import { GalleryLightbox, type GalleryLightboxItem } from './components/GalleryLightbox'
import { MatchCard } from './components/MatchCard'
import { PageHero } from './components/PageHero'
import { PlayerCard } from './components/PlayerCard'
import { SectionHeader } from './components/SectionHeader'
import { Spinner } from './components/Spinner'
import playerPlaceholderSrc from './assets/player_avatar_placeholder.png'
import { SiteLogoPlaceholder } from './components/SiteLogoPlaceholder'
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
  captain_player_id?: number | null
  captain_profile_photo_url?: string | null
  coach: string | null
  coach_image_url?: string | null
  manager: string | null
  manager_image_url?: string | null
  year_founded: number | null
  description: string | null
  history: string | null
  trophies: string[] | null
  team_photo_urls: string[] | null
  social_links: Record<string, string> | null
  status: string
}

type TeamSeasonRecord = {
  league_id: number
  league_name: string
  league_slug: string
  season_id: number
  season_name: string
  season_slug: string
  season_start: string | null
  played: number
  wins: number
  losses: number
  no_result: number
}

type PlayerRow = {
  id: number
  full_name: string
  slug: string
  role: string | null
  jersey_number: number | null
  profile_photo_url: string | null
}

function StaffCard({
  role,
  name,
  imageUrl,
  placeholderKind,
}: {
  role: string
  name: string | null | undefined
  imageUrl: string | null | undefined
  placeholderKind: 'player' | 'brand'
}) {
  const resolved = imageUrl ? resolveMediaUrl(imageUrl) : null
  return (
    <article className="team-page__staff-card">
      <div className="team-page__staff-card-media">
        {resolved ? (
          <img src={resolved} alt="" loading="lazy" decoding="async" />
        ) : placeholderKind === 'player' ? (
          <img
            src={playerPlaceholderSrc}
            alt=""
            className="team-page__staff-card-placeholder-img"
            aria-hidden
            loading="lazy"
            decoding="async"
          />
        ) : (
          <SiteLogoPlaceholder className="team-page__staff-card-placeholder-img" />
        )}
      </div>
      <div className="team-page__staff-card-body">
        <p className="team-page__staff-card-role">{role}</p>
        <p className="team-page__staff-card-name">{name?.trim() || 'TBA'}</p>
      </div>
    </article>
  )
}

export function TeamDetailPage() {
  const { slug } = useParams({ from: '/teams/$slug' })
  const { data, isLoading, isError } = useQuery({
    queryKey: ['team-detail', slug],
    queryFn: () => fetchJson<TeamDetail>(`/public/teams/${slug}`),
    retry: 1,
  })
  const { map: teamsMap } = useTeamsMap()
  const [galleryActive, setGalleryActive] = useState<GalleryLightboxItem | null>(null)

  const seasonRecordsQ = useQuery({
    queryKey: ['team-season-records', slug],
    queryFn: () => fetchJson<TeamSeasonRecord[]>(`/public/teams/${slug}/season-records`),
    enabled: Boolean(slug),
    retry: 1,
  })

  const playersQ = useQuery({
    queryKey: ['team-players', data?.id ?? 'none'],
    queryFn: async () =>
      extractList<PlayerRow>(
        await fetchJson<unknown>(
          `/public/players?page=1&page_size=80&team_id=${data?.id ?? -1}`,
        ),
      ),
    enabled: Boolean(data?.id),
    retry: 1,
  })

  const galleryQ = useQuery({
    queryKey: ['team-gallery', data?.id ?? 'none'],
    queryFn: async () =>
      extractList<GalleryLightboxItem>(
        await fetchJson<unknown>(
          `/public/gallery?page=1&page_size=24&team_id=${data?.id ?? -1}`,
        ),
      ),
    enabled: Boolean(data?.id),
    retry: 1,
  })

  const fixturesQ = useQuery({
    queryKey: ['team-fixtures', data?.id ?? 'none'],
    queryFn: async () =>
      extractList<MatchLite>(
        await fetchJson<unknown>(
          `/public/fixtures?page=1&page_size=20&team_id=${data?.id ?? -1}`,
        ),
      ),
    enabled: Boolean(data?.id),
    retry: 1,
  })

  const resultsQ = useQuery({
    queryKey: ['team-results', data?.id ?? 'none'],
    queryFn: async () =>
      extractList<MatchLite>(
        await fetchJson<unknown>(
          `/public/results?page=1&page_size=20&team_id=${data?.id ?? -1}`,
        ),
      ),
    enabled: Boolean(data?.id),
    retry: 1,
  })

  const coverHero = data ? resolveMediaUrl(data.cover_image_url) : null
  const firstTeamPhoto = data?.team_photo_urls?.[0]
    ? resolveMediaUrl(data.team_photo_urls[0])
    : null
  const useSiteLogoHero = Boolean(data) && !coverHero && !firstTeamPhoto
  const heroImage = coverHero ?? firstTeamPhoto

  const venueTitle =
    (data?.home_ground_name ?? data?.home_ground)?.trim() || 'Home ground'
  const venueLocation = data?.home_ground_location?.trim()
  const homeGroundImg = data?.home_ground_image_url
    ? resolveMediaUrl(data.home_ground_image_url)
    : null

  const recordsByLeague = useMemo(() => {
    const rows = seasonRecordsQ.data ?? []
    const m = new Map<
      number,
      { league: TeamSeasonRecord; seasons: TeamSeasonRecord[] }
    >()
    for (const r of rows) {
      const cur = m.get(r.league_id)
      if (cur) {
        cur.seasons.push(r)
      } else {
        m.set(r.league_id, { league: r, seasons: [r] })
      }
    }
    for (const v of m.values()) {
      v.seasons.sort((a, b) => {
        const da = a.season_start ?? ''
        const db = b.season_start ?? ''
        return db.localeCompare(da)
      })
    }
    return [...m.values()].sort((a, b) =>
      a.league.league_name.localeCompare(b.league.league_name, undefined, {
        sensitivity: 'base',
      }),
    )
  }, [seasonRecordsQ.data])

  const playersSorted = useMemo(() => {
    const list = playersQ.data ?? []
    return [...list].sort((a, b) =>
      a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' }),
    )
  }, [playersQ.data])

  const captainPhotoUrl = useMemo(() => {
    if (!data) return null
    if (data.captain_profile_photo_url?.trim()) {
      return data.captain_profile_photo_url.trim()
    }
    if (data.captain_player_id != null) {
      const row = playersSorted.find((p) => p.id === data.captain_player_id)
      return row?.profile_photo_url?.trim() ?? null
    }
    return null
  }, [data, playersSorted])

  return (
    <>
      {data ? (
        <PageHero
          title={data.name}
          subtitle={`${formatCategoryLabel(data.category)} · ${data.home_ground_name ?? data.home_ground ?? 'Venue TBC'} · ${data.status}`}
          imageUrl={heroImage}
          badgeSrc={data.logo_url ? (resolveMediaUrl(data.logo_url) ?? null) : null}
          variant={useSiteLogoHero ? 'siteLogo' : 'default'}
          fullWidth={Boolean(heroImage && !useSiteLogoHero)}
          titleAlign="start"
          className="ui-page-hero--team-header-align"
        />
      ) : null}
      <main className="container">
        <section className="menu-page team-page">
          {isLoading ? <Spinner label="Loading team..." /> : null}
          {isError ? <ErrorNotice message="Could not load team details." /> : null}
          {data ? (
            <>
              {data.description?.trim() ? (
                <div className="team-page__intro team-page__intro--lede-only">
                  <p className="team-page__lede muted">{data.description.trim()}</p>
                </div>
              ) : null}

              <section className="team-page__section" aria-label="Leadership">
                <SectionHeader title="Leadership" />
                <div className="team-page__staff-grid">
                  <StaffCard
                    role="Captain"
                    name={data.captain}
                    imageUrl={captainPhotoUrl}
                    placeholderKind="player"
                  />
                  <StaffCard
                    role="Coach"
                    name={data.coach}
                    imageUrl={data.coach_image_url ?? null}
                    placeholderKind="brand"
                  />
                  <StaffCard
                    role="Manager"
                    name={data.manager}
                    imageUrl={data.manager_image_url ?? null}
                    placeholderKind="brand"
                  />
                </div>
              </section>

              <section className="team-page__section" aria-label="Home ground">
                <SectionHeader title="Home ground" />
                <div className="team-page__home-card">
                  <div className="team-page__home-visual">
                    {homeGroundImg ? (
                      <img
                        src={homeGroundImg}
                        alt={venueTitle}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <SiteLogoPlaceholder className="team-page__home-visual-placeholder" />
                    )}
                  </div>
                  <div className="team-page__home-copy">
                    <h3 className="team-page__home-name">{venueTitle}</h3>
                    {venueLocation ? (
                      <p className="team-page__home-location">{venueLocation}</p>
                    ) : (
                      <p className="muted">Location to be confirmed.</p>
                    )}
                  </div>
                </div>
              </section>

              <section className="team-page__section" aria-label="History">
                <SectionHeader title="History" />
                <div className="team-page__prose">
                  <p>
                    {data.history ??
                      data.description ??
                      'Team profile and history coming soon.'}
                  </p>
                  {data.year_founded != null ? (
                    <p className="team-page__founded">
                      <strong>Founded</strong> {data.year_founded}
                    </p>
                  ) : null}
                </div>
                {(data.trophies ?? []).length > 0 ? (
                  <>
                    <h3 className="team-page__subheading">Honours</h3>
                    <div className="team-detail-chips">
                      {(data.trophies ?? []).map((trophy, idx) => (
                        <span key={`${trophy}-${idx}`} className="team-detail-chip">
                          {trophy}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
              </section>

              <section className="team-page__section" aria-label="Season records">
                <SectionHeader title="Season records" />
                <p className="team-page__hint muted">
                  Wins, losses, and no-results from completed matches, by league
                  and season.
                </p>
                {seasonRecordsQ.isLoading ? (
                  <Spinner label="Loading records…" />
                ) : null}
                {seasonRecordsQ.isError ? (
                  <ErrorNotice message="Could not load season records." />
                ) : null}
                {recordsByLeague.length === 0 && !seasonRecordsQ.isLoading ? (
                  <p className="muted">
                    Records will appear after this team completes matches in a
                    league season.
                  </p>
                ) : (
                  <div className="team-page__standings-stack">
                    {recordsByLeague.map(({ league, seasons }) => (
                      <div key={league.league_id} className="team-page__league-block">
                        <h3 className="team-page__league-title">
                          <Link
                            to="/leagues/$slug"
                            params={{ slug: league.league_slug }}
                            className="team-page__league-link"
                          >
                            {league.league_name}
                          </Link>
                        </h3>
                        <div className="table-wrap team-page__table-wrap">
                          <table className="team-page__standings-table">
                            <thead>
                              <tr>
                                <th scope="col">Season</th>
                                <th scope="col">P</th>
                                <th scope="col">W</th>
                                <th scope="col">L</th>
                                <th scope="col">NR*</th>
                                <th scope="col" />
                              </tr>
                            </thead>
                            <tbody>
                              {seasons.map((r) => (
                                <tr key={r.season_id}>
                                  <td>{r.season_name}</td>
                                  <td>{r.played}</td>
                                  <td>{r.wins}</td>
                                  <td>{r.losses}</td>
                                  <td>{r.no_result}</td>
                                  <td>
                                    <Link
                                      to="/leagues/$leagueSlug/seasons/$seasonSlug"
                                      params={{
                                        leagueSlug: r.league_slug,
                                        seasonSlug: r.season_slug,
                                      }}
                                      className="team-page__inline-link"
                                    >
                                      View season
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="team-page__footnote muted">
                  *NR: matches with no winner recorded (tie, abandoned, or
                  incomplete result).
                </p>
              </section>

              <section className="team-page__section" aria-label="Fixtures">
                <SectionHeader title="Fixtures" />
                {fixturesQ.isLoading ? <Spinner label="Loading fixtures…" /> : null}
                {(fixturesQ.data ?? []).length === 0 && !fixturesQ.isLoading ? (
                  <p className="muted">No upcoming fixtures listed.</p>
                ) : (
                  <div className="home-grid home-grid--matches team-page__match-grid">
                    {(fixturesQ.data ?? []).map((match) => (
                      <MatchCard key={match.id} match={match} teamsMap={teamsMap} />
                    ))}
                  </div>
                )}
              </section>

              <section className="team-page__section" aria-label="Results">
                <SectionHeader title="Results" />
                {resultsQ.isLoading ? <Spinner label="Loading results…" /> : null}
                {(resultsQ.data ?? []).length === 0 && !resultsQ.isLoading ? (
                  <p className="muted">No recent results.</p>
                ) : (
                  <div className="home-grid home-grid--matches team-page__match-grid">
                    {(resultsQ.data ?? []).map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        teamsMap={teamsMap}
                        mode="result"
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="team-page__section" aria-label="Squad">
                <SectionHeader title="Squad" />
                {playersQ.isLoading ? <Spinner label="Loading players…" /> : null}
                {playersSorted.length === 0 && !playersQ.isLoading ? (
                  <p className="muted">Squad list coming soon.</p>
                ) : (
                  <div className="home-grid home-grid--players">
                    {playersSorted.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        isCaptain={
                          (data.captain_player_id != null &&
                            data.captain_player_id === player.id) ||
                          (data.captain_player_id == null &&
                            (data.captain ?? '').trim() === player.full_name)
                        }
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="team-page__section" aria-label="Gallery">
                <SectionHeader
                  title="Gallery"
                  linkTo="/gallery"
                  linkLabel="Full gallery"
                />
                {galleryQ.isLoading ? <Spinner label="Loading gallery…" /> : null}
                {(galleryQ.data ?? []).length === 0 && !galleryQ.isLoading ? (
                  <p className="muted">
                    No gallery images are linked to this team yet.
                  </p>
                ) : (
                  <div className="home-grid home-grid--gallery">
                    {(galleryQ.data ?? []).map((item) => (
                      <GalleryCard
                        key={item.id}
                        item={item}
                        onOpen={setGalleryActive}
                      />
                    ))}
                  </div>
                )}
              </section>

              {(data.team_photo_urls ?? []).length > 0 ? (
                <section className="team-page__section" aria-label="Team photos">
                  <SectionHeader title="Team photos" />
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
                            Team
                          </span>
                          <h3 className="ui-gallery-card__title">
                            {data.name} · {idx + 1}
                          </h3>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </section>
      </main>
      <GalleryLightbox active={galleryActive} onClose={() => setGalleryActive(null)} />
    </>
  )
}
