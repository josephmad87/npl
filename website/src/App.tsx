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

function App() {
  const { data: newsArticles = [] } = useRecentNews(36)
  const { data: upcomingFixtures = [] } = useUpcomingFixtures(undefined, 10)
  const { data: latestResults = [] } = useLatestResults(undefined, 6)
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
    const todaysFixtures = useMemo(() => {
    const today = new Date()
    const todayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')

    return upcomingFixtures
      .filter((match) => {
        const matchDate = String(match.match_date ?? match.start_time ?? '').slice(0, 10)
        const status = String(match.status ?? '').toLowerCase()

        return matchDate === todayKey || status === 'live'
      })
      .slice(0, 6)
  }, [upcomingFixtures])

  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [galleryActive, setGalleryActive] = useState<GalleryItem | null>(null)

  const heroSlides = useMemo(
    () =>
      newsArticles.map((article) => ({
        ...article,
        heroImage: resolveMediaUrl(article.featured_image_url),
      })),
    [newsArticles],
  )

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

      <HomeNewsCarousel articles={newsArticles} />

              <section className="home-section home-match-carousel-section home-today-section">
        {todaysFixtures.length > 0 ? (
          <MatchCarousel
            title="Live Now / Today’s Matches"
            linkTo="/fixtures"
            matches={todaysFixtures}
            teamsMap={teamsMap}
            mode="fixture"
          />
        ) : (
          <>
            <SectionHeader title="Live Now / Today’s Matches" linkTo="/fixtures" />
            <div className="home-today-empty">
              <div>
                <p className="home-today-empty__eyebrow">No live matches right now</p>
                <h3>Check upcoming NPL fixtures</h3>
                <p>
                  There are no matches scheduled for today. View the full fixtures list
                  for upcoming games.
                </p>
              </div>
              <Link to="/fixtures">View fixtures</Link>
            </div>
          </>
        )}
      </section>

      <section className="home-section home-match-carousel-section">
        {upcomingFixtures.length > 0 ? (
          <MatchCarousel
            title="Upcoming Fixtures"
            linkTo="/fixtures"
            matches={upcomingFixtures}
            teamsMap={teamsMap}
            mode="fixture"
          />
        ) : null}

        {upcomingFixtures.length === 0 ? (
          <>
            <SectionHeader title="Upcoming Fixtures" linkTo="/fixtures" />
            <EmptyState title="No upcoming fixtures yet" />
          </>
        ) : null}
      </section>

      <section className="home-section home-match-carousel-section">
        {latestResults.length > 0 ? (
          <MatchCarousel
            title="Latest Results"
            linkTo="/results"
            matches={latestResults}
            teamsMap={teamsMap}
            mode="result"
          />
        ) : null}

        {latestResults.length === 0 ? (
          <>
            <SectionHeader title="Latest Results" linkTo="/results" />
            <EmptyState title="No results published yet" />
          </>
        ) : null}
      </section>

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
