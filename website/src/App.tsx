import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import nplLogoUrl from './assets/logo.jpeg'
import './App.css'
import { EmptyState } from './components/EmptyState'
import { GalleryCard } from './components/GalleryCard'
import { GalleryLightbox, type GalleryLightboxItem } from './components/GalleryLightbox'
import { MatchCard } from './components/MatchCard'
import { MatchCarousel } from './components/MatchCarousel'
import { HomeNewsCarousel } from './components/HomeNewsCarousel'
import { SectionHeader } from './components/SectionHeader'
import { FeaturedTeamsCarousel } from './components/FeaturedTeamsCarousel'
import { useLatestResults, useRecentNews, useTeamsMap, useUpcomingFixtures } from './lib/hooks'
import { extractList, fetchAllPaginatedList, fetchJson, resolveMediaUrl } from './lib/publicApi'

type GalleryItem = GalleryLightboxItem
type PublicSponsor = {
  id: number
  name: string
  image_url: string
  team_id: number | null
  team_name: string | null
}

function HomeSponsorImage({ url, alt }: { url: string | null | undefined; alt: string }) {
  const resolved = resolveMediaUrl(url?.trim() ?? '') ?? nplLogoUrl
  return (
    <img
      src={resolved}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        e.currentTarget.onerror = null
        e.currentTarget.src = nplLogoUrl
      }}
    />
  )
}

function App() {
  const { data: newsArticles = [] } = useRecentNews(36)
  const { data: upcomingFixtures = [] } = useUpcomingFixtures(undefined, 6)
  const { data: latestResults = [] } = useLatestResults(undefined, 6)
  const { data: teams = [], map: teamsMap } = useTeamsMap()
  const { data: gallery = [] } = useQuery({
    queryKey: ['home-gallery'],
    queryFn: async () => extractList<GalleryItem>(await fetchJson<unknown>('/public/gallery?page=1&page_size=6')),
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
  const currentSlideIndex = heroSlides.length > 0 ? activeSlideIndex % heroSlides.length : 0

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
                  {slide.heroImage ? <img src={slide.heroImage} alt={slide.title} /> : null}
                  <div className="hero-slide-overlay">
                    <p className="hero-slide-eyebrow">Latest News</p>
                    <h2>{slide.title}</h2>
                    <p>{slide.excerpt ?? 'Catch up on the latest match analysis and updates.'}</p>
                    {slide.slug ? (
                      <Link to="/news/$slug" params={{ slug: slide.slug }} className="hero-readmore-btn">
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
                    className={`hero-carousel-dot${index === currentSlideIndex ? ' is-active' : ''}`}
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
              <p>Add and publish a news article with a featured image to populate this carousel.</p>
            </div>
          </article>
        )}
      </section>

      <HomeNewsCarousel articles={newsArticles} />

      <section className="home-section">
        <SectionHeader title="Upcoming Fixtures" linkTo="/fixtures" />
        <div className="home-grid home-grid--matches">
          {upcomingFixtures.map((match) => (
            <MatchCard key={match.id} match={match} teamsMap={teamsMap} />
          ))}
        </div>
        {upcomingFixtures.length === 0 ? <EmptyState title="No upcoming fixtures yet" /> : null}
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

      <FeaturedTeamsCarousel teams={teams.slice(0, 16)} />

      {sponsors.length > 0 ? (
        <section className="home-section">
          <SectionHeader title="Partners & Sponsors" />
          <div className="home-sponsors-row" role="list" aria-label="Partners and sponsors">
            {sponsors.map((sponsor) => (
              <article key={sponsor.id} className="home-sponsors-card" role="listitem">
                <div className="home-sponsors-card__logo">
                  <HomeSponsorImage url={sponsor.image_url} alt={sponsor.name} />
                </div>
                <h3 className="home-sponsors-card__name">{sponsor.name}</h3>
                {sponsor.team_name?.trim() ? (
                  <p className="home-sponsors-card__team">{sponsor.team_name.trim()}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="home-section">
        <SectionHeader title="Gallery Preview" linkTo="/gallery" />
        <div className="home-grid home-grid--gallery">
          {gallery.map((item) => (
            <GalleryCard key={item.id} item={item} onOpen={setGalleryActive} />
          ))}
        </div>
      </section>

      <GalleryLightbox active={galleryActive} onClose={() => setGalleryActive(null)} />
    </main>
  )
}

export default App
