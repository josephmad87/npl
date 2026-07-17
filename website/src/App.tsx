import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import './App.css'
import { GalleryCard } from './components/GalleryCard'
import { GalleryLightbox, type GalleryLightboxItem } from './components/GalleryLightbox'
import { MatchCarousel } from './components/MatchCarousel'
import { HomeNewsCarousel } from './components/HomeNewsCarousel'
import { SectionHeader } from './components/SectionHeader'
import { FeaturedTeamsCarousel } from './components/FeaturedTeamsCarousel'
import { NplTvSection } from './components/NplTvSection'
import { SponsorMarquee } from './components/SponsorMarquee'
import {
  useLatestResults,
  useRecentNews,
  useFeaturedTeams,
  useTeamsMap,
  useUpcomingFixtures,
} from './lib/hooks'
import {
  extractList,
  fetchAllPaginatedList,
  fetchJson,
  resolveMediaUrl,
} from './lib/publicApi'

type GalleryItem = GalleryLightboxItem

type PublicSponsor = {
  id: number
  name: string
  image_url: string
  link_url: string | null
  team_id: number | null
  team_name: string | null
}

type HomeFixtureTab = 'matchday' | 'upcoming' | 'results'
type HomeFixtureCategory = 'all' | 'mens' | 'women' | 'youth'

type HomeHubMatch = {
  id: number
  category?: string | null
  status?: string | null
  match_date?: string | null
  start_time?: string | null
  venue?: string | null
  home_team_id: number
  away_team_id: number
}

function localTodayKey(): string {
  const today = new Date()

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
}

function matchDateKey(match: {
  match_date?: string | null
  start_time?: string | null
}): string {
  return String(match.match_date ?? match.start_time ?? '').slice(0, 10)
}

function isLiveMatch(match: { status?: string | null }): boolean {
  return String(match.status ?? '').toLowerCase() === 'live'
}

function isTodayMatch(match: {
  match_date?: string | null
  start_time?: string | null
}): boolean {
  return matchDateKey(match) === localTodayKey()
}

function categoryGroup(category: string | null | undefined): HomeFixtureCategory {
  const value = String(category ?? '').trim().toLowerCase()

  if (value === 'mens' || value === 'men' || value === 'man') return 'mens'

  if (
    value === 'women' ||
    value === 'womens' ||
    value === 'woman' ||
    value === 'ladies' ||
    value === 'lady'
  ) {
    return 'women'
  }

  if (value === 'youth') return 'youth'

  return 'all'
}

function categoryMatches(
  category: string | null | undefined,
  selected: HomeFixtureCategory,
): boolean {
  if (selected === 'all') return true
  return categoryGroup(category) === selected
}

function dateDifferenceFromToday(match: {
  match_date?: string | null
  start_time?: string | null
}): number | null {
  const key = matchDateKey(match)

  if (!key) return null

  const today = localTodayKey()
  const matchDate = new Date(`${key}T00:00:00`)
  const todayDate = new Date(`${today}T00:00:00`)
  const diff = matchDate.getTime() - todayDate.getTime()

  return Math.round(diff / 86_400_000)
}

function countdownLabel(
  tab: HomeFixtureTab,
  match: {
    status?: string | null
    match_date?: string | null
    start_time?: string | null
  },
): string {
  if (tab === 'results') return 'Latest result'
  if (isLiveMatch(match)) return 'Live now'

  const diff = dateDifferenceFromToday(match)

  if (diff == null) return 'Fixture scheduled'
  if (diff <= 0) return 'Starts today'
  if (diff === 1) return 'Starts tomorrow'

  return `Starts in ${diff} days`
}

function tabMatches(
  tab: HomeFixtureTab,
  match: {
    status?: string | null
    match_date?: string | null
    start_time?: string | null
  },
): boolean {
  if (tab === 'matchday') {
    return isLiveMatch(match) || isTodayMatch(match)
  }

  if (tab === 'upcoming') {
    if (isLiveMatch(match) || isTodayMatch(match)) return false

    const diff = dateDifferenceFromToday(match)

    return diff == null || diff > 0
  }

  return true
}

function fixtureHubEmptyTitle(tab: HomeFixtureTab): string {
  if (tab === 'matchday') return 'No matchday action right now'
  if (tab === 'results') return 'No results published yet'
  return 'No upcoming fixtures yet'
}

function fixtureHubEmptyBody(tab: HomeFixtureTab): string {
  if (tab === 'matchday') {
    return 'No live or today fixtures are listed. Check Next Up for upcoming matches.'
  }

  if (tab === 'results') {
    return 'Completed matches will appear here once results are published.'
  }

  return 'Fixtures will appear here once they are published.'
}

function formatHubDate(match: {
  match_date?: string | null
  start_time?: string | null
}): string {
  const key = matchDateKey(match)

  if (!key) return 'Date TBC'

  return new Intl.DateTimeFormat('en-ZW', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${key}T12:00:00`))
}

function App() {
  const { data: newsArticles = [] } = useRecentNews(36)
  const { data: upcomingFixtures = [] } = useUpcomingFixtures(undefined, 24)
  const { data: latestResults = [] } = useLatestResults(undefined, 12)
  const { map: teamsMap } = useTeamsMap()
  const { data: featuredTeams = [] } = useFeaturedTeams()

  const { data: gallery = [] } = useQuery({
    queryKey: ['home-gallery'],
    queryFn: async () =>
      extractList<GalleryItem>(
        await fetchJson<unknown>('/public/gallery?page=1&page_size=6'),
      ),
    retry: 1,
  })

  const { data: sponsors = [] } = useQuery({
    queryKey: ['home-sponsors'],
    queryFn: async () =>
      fetchAllPaginatedList<PublicSponsor>(
        (page) => `/public/sponsors?page=${page}&page_size=24`,
      ),
    retry: 1,
  })

  const homepageSponsors = sponsors.filter((sponsor) => sponsor.team_id == null)

  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [galleryActive, setGalleryActive] = useState<GalleryItem | null>(null)
  const [fixtureTab, setFixtureTab] = useState<HomeFixtureTab>('matchday')
  const [fixtureCategory, setFixtureCategory] =
    useState<HomeFixtureCategory>('all')

  const heroSlides = useMemo(
    () =>
      newsArticles.map((article) => ({
        ...article,
        heroImage: resolveMediaUrl(article.featured_image_url),
      })),
    [newsArticles],
  )

  const fixtureTabs: { id: HomeFixtureTab; label: string }[] = [
    { id: 'matchday', label: 'Matchday' },
    { id: 'upcoming', label: 'Next Up' },
    { id: 'results', label: 'Results' },
  ]

  const fixtureCategories: { id: HomeFixtureCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'mens', label: 'Mens' },
    { id: 'women', label: 'Women' },
    { id: 'youth', label: 'Youth' },
  ]

  const fixtureHubMatches = useMemo(() => {
    const source = fixtureTab === 'results' ? latestResults : upcomingFixtures

    return source
      .filter((match) => tabMatches(fixtureTab, match))
      .filter((match) => categoryMatches(match.category, fixtureCategory))
      .slice(0, 12)
  }, [fixtureCategory, fixtureTab, latestResults, upcomingFixtures])

  const featuredHubMatch = fixtureHubMatches[0] as HomeHubMatch | undefined
  const fixtureHubMode = fixtureTab === 'results' ? 'result' : 'fixture'
  const fixtureHubTitle =
    fixtureTabs.find((tab) => tab.id === fixtureTab)?.label ?? 'Fixtures'

  const featuredHomeName =
    featuredHubMatch != null
      ? teamsMap[featuredHubMatch.home_team_id]?.name ??
        `Team ${featuredHubMatch.home_team_id}`
      : ''

  const featuredAwayName =
    featuredHubMatch != null
      ? teamsMap[featuredHubMatch.away_team_id]?.name ??
        `Team ${featuredHubMatch.away_team_id}`
      : ''

  useEffect(() => {
    if (heroSlides.length < 2) return

    const timer = globalThis.setInterval(() => {
      setActiveSlideIndex((current) => (current + 1) % heroSlides.length)
    }, 5000)

    return () => globalThis.clearInterval(timer)
  }, [heroSlides.length])

  const currentSlideIndex =
    heroSlides.length > 0 ? activeSlideIndex % heroSlides.length : 0

  return (
    <main className="container">
      <section className="hero-carousel" aria-label="Latest news highlights">
        {heroSlides.length > 0 ? (
          <>
            {heroSlides.map((slide, index) => {
              const isActive = index === currentSlideIndex

              return (
                <article
                  key={slide.id}
                  className={`hero-slide${isActive ? ' is-active' : ''}`}
                  aria-hidden={!isActive}
                >
                  {slide.heroImage ? (
                    <img src={slide.heroImage} alt={slide.title} />
                  ) : null}

                  <div className="hero-slide-overlay">
                    <p className="hero-slide-eyebrow">Latest News</p>
                    <h2>{slide.title}</h2>
                    <p>
                      {slide.excerpt ??
                        'Catch up on the latest match analysis and updates.'}
                    </p>

                    {slide.slug ? (
                      <Link
                        to="/news/$slug"
                        params={{ slug: slide.slug }}
                        className="hero-readmore-btn"
                      >
                        Read More
                      </Link>
                    ) : null}
                  </div>
                </article>
              )
            })}

            {heroSlides.length > 1 ? (
              <div className="hero-carousel-dots" aria-hidden="true">
                {heroSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    className={`hero-carousel-dot${
                      index === currentSlideIndex ? ' is-active' : ''
                    }`}
                    onClick={() => setActiveSlideIndex(index)}
                  >
                    <span className="sr-only">Show slide {index + 1}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <article className="hero-slide is-active">
            <div className="hero-slide-overlay">
              <p className="hero-slide-eyebrow">Latest News</p>
              <h2>No published news yet</h2>
              <p>
                Add and publish a news article with a featured image to populate
                this carousel.
              </p>
            </div>
          </article>
        )}
      </section>

      <section className="home-section home-fixture-hub home-fixture-hub--premium">
        <div className="home-fixture-hub__topline">
          <div>
            <p className="home-fixture-hub__eyebrow">Match centre</p>
            <h2>Fixture Hub</h2>
          </div>

          <Link
            to={fixtureTab === 'results' ? '/results' : '/fixtures'}
            className="home-fixture-hub__main-link"
          >
            {fixtureTab === 'results' ? 'All results' : 'All fixtures'}
          </Link>
        </div>

        <div className="home-fixture-hub__layout">
          <div className="home-fixture-hub__feature">
            {featuredHubMatch ? (
              <>
                <div className="home-fixture-hub__countdown">
                  {countdownLabel(fixtureTab, featuredHubMatch)}
                </div>

                <div className="home-fixture-hub__teams">
                  <strong>{featuredHomeName}</strong>
                  <span>vs</span>
                  <strong>{featuredAwayName}</strong>
                </div>

                <div className="home-fixture-hub__meta">
                  <span>{formatHubDate(featuredHubMatch)}</span>
                  <span>{featuredHubMatch.venue || 'Venue TBC'}</span>
                </div>

                <Link
                  to={fixtureTab === 'results' ? '/results' : '/fixtures'}
                  className="home-fixture-hub__feature-link"
                >
                  {fixtureTab === 'results' ? 'View results' : 'View fixtures'}
                </Link>
              </>
            ) : (
              <>
                <div className="home-fixture-hub__countdown">
                  {fixtureHubTitle}
                </div>

                <div className="home-fixture-hub__teams">
                  <strong>{fixtureHubEmptyTitle(fixtureTab)}</strong>
                </div>

                <p className="home-fixture-hub__empty-copy">
                  {fixtureHubEmptyBody(fixtureTab)}
                </p>

                <Link
                  to={fixtureTab === 'results' ? '/results' : '/fixtures'}
                  className="home-fixture-hub__feature-link"
                >
                  {fixtureTab === 'results' ? 'View results' : 'View fixtures'}
                </Link>
              </>
            )}
          </div>

          <div className="home-fixture-hub__side">
            <div className="home-fixture-hub__tabs" aria-label="Fixture hub tabs">
              {fixtureTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={fixtureTab === tab.id ? 'is-active' : ''}
                  onClick={() => setFixtureTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div
              className="home-fixture-hub__categories"
              aria-label="Fixture category filter"
            >
              {fixtureCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={fixtureCategory === category.id ? 'is-active' : ''}
                  onClick={() => setFixtureCategory(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>

            <p className="home-fixture-hub__hint">
              Switch tabs and categories to quickly find the games that matter.
            </p>
          </div>
        </div>

        {fixtureHubMatches.length > 0 ? (
          <div className="home-fixture-hub__carousel">
            <MatchCarousel
              title={fixtureHubTitle}
              linkTo={fixtureTab === 'results' ? '/results' : '/fixtures'}
              matches={fixtureHubMatches}
              teamsMap={teamsMap}
              mode={fixtureHubMode}
              showHeader={false}
            />
          </div>
        ) : null}
      </section>

      <HomeNewsCarousel articles={newsArticles} />

      <NplTvSection />

      <FeaturedTeamsCarousel teams={featuredTeams} />

      <section className="home-section">
        <SectionHeader title="Gallery Preview" linkTo="/gallery" />
        <div className="home-grid home-grid--gallery home-grid--gallery-row">
          {gallery.map((item) => (
            <GalleryCard key={item.id} item={item} onOpen={setGalleryActive} />
          ))}
        </div>
      </section>

      <SponsorMarquee sponsors={homepageSponsors} />

      <GalleryLightbox
        active={galleryActive}
        onClose={() => setGalleryActive(null)}
      />
    </main>
  )
}

export default App
