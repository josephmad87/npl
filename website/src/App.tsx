import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import './App.css'
import { EmptyState } from './components/EmptyState'
import { ExpandingNewsTiles } from './components/ExpandingNewsTiles'
import { GalleryCard } from './components/GalleryCard'
import { GalleryLightbox, type GalleryLightboxItem } from './components/GalleryLightbox'
import { MatchCard } from './components/MatchCard'
import { HomeNewsCarousel } from './components/HomeNewsCarousel'
import { SectionHeader } from './components/SectionHeader'
import { FeaturedTeamsCarousel } from './components/FeaturedTeamsCarousel'
import { useLatestResults, useRecentNews, useTeamsMap, useUpcomingFixtures } from './lib/hooks'
import { extractList, fetchJson, resolveMediaUrl } from './lib/publicApi'

type GalleryItem = GalleryLightboxItem

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

      <ExpandingNewsTiles articles={newsArticles.slice(0, 6)} />

      <section className="home-section">
        <SectionHeader title="Upcoming Fixtures" linkTo="/fixtures" />
        <div className="home-grid home-grid--matches">
          {upcomingFixtures.map((match) => (
            <MatchCard key={match.id} match={match} teamsMap={teamsMap} />
          ))}
        </div>
        {upcomingFixtures.length === 0 ? <EmptyState title="No upcoming fixtures yet" /> : null}
      </section>

      <section className="home-section">
        <SectionHeader title="Latest Results" linkTo="/results" />
        <div className="home-grid home-grid--matches">
          {latestResults.map((match) => (
            <MatchCard key={match.id} match={match} teamsMap={teamsMap} mode="result" />
          ))}
        </div>
        {latestResults.length === 0 ? <EmptyState title="No results published yet" /> : null}
      </section>

      <FeaturedTeamsCarousel teams={teams.slice(0, 16)} />

      <HomeNewsCarousel articles={newsArticles} />

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
