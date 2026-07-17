import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import './App.css'
import { EmptyState } from './components/EmptyState'
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

type HomeFixtureTab = 'live' | 'today' | 'upcoming' | 'results'
type HomeFixtureCategory = 'all' | 'mens' | 'women' | 'youth'

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

function tabMatches(
  tab: HomeFixtureTab,
  match: {
    status?: string | null
    match_date?: string | null
    start_time?: string | null
  },
): boolean {
  if (tab === 'live') return isLiveMatch(match)
  if (tab === 'today') return isTodayMatch(match) || isLiveMatch(match)
  if (tab === 'upcoming') return !isLiveMatch(match)
  return true
}

function fixtureHubEmptyTitle(tab: HomeFixtureTab): string {
  if (tab === 'live') return 'No live matches right now'
  if (tab === 'today') return 'No matches scheduled for today'
  if (tab === 'results') return 'No results published yet'
  return 'No upcoming fixtures yet'
}

function fixtureHubEmptyBody(tab: HomeFixtureTab): string {
  if (tab === 'live') {
    return 'Check back on match day for live NPL action.'
  }

  if (tab === 'today') {
    return 'There are no matches listed for today. View the fixtures page for upcoming games.'
  }

  if (tab === 'results') {
    return 'Completed matches will appear here once results are published.'
  }

  return 'Fixtures will appear here once they are published.'
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
  const [fixtureTab, setFixtureTab] = useState<HomeFixtureTab>('today')
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
    { id: 'live', label: 'Live Now' },
    { id: 'today', label: 'Today' },
    { id: 'upcoming', label: 'Upcoming' },
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

  const fixtureHubMode = fixtureTab === 'results' ? 'result' : 'fixture'
  const fixtureHubTitle =
    fixtureTabs.find((tab) => tab.id === fixtureTab)?.label ?? 'Fixtures'

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

      <section className="home-section home-fixture-hub">
        <div className="home-fixture-hub__head">
          <div>
            <p className="home-fixture-hub__eyebrow">Match centre</p>
            <h2>Fixture Hub</h2>
            <p>
              Follow live matches, today’s fixtures, upcoming games and the latest
              results.
            </p>
          </div>

          <div className="home-fixture-hub__cta">
            {fixtureTab === 'results' ? (
              <Link to="/results">View all results</Link>
            ) : (
              <Link to="/fixtures">View all fixtures</Link>
            )}
          </div>
        </div>

        <div className="home-fixture-hub__controls">
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
        </div>

        {fixtureHubMatches.length > 0 ? (
          <MatchCarousel
            title={fixtureHubTitle}
            linkTo={fixtureTab === 'results' ? '/results' : '/fixtures'}
            matches={fixtureHubMatches}
            teamsMap={teamsMap}
            mode={fixtureHubMode}
            showHeader={false}
          />
        ) : (
          <div className="home-fixture-hub__empty">
            <div>
              <p className="home-fixture-hub__empty-eyebrow">
                {fixtureHubTitle}
              </p>
              <h3>{fixtureHubEmptyTitle(fixtureTab)}</h3>
              <p>{fixtureHubEmptyBody(fixtureTab)}</p>
            </div>

            {fixtureTab === 'results' ? (
              <Link to="/results">View results</Link>
            ) : (
              <Link to="/fixtures">View fixtures</Link>
            )}
          </div>
        )}
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
