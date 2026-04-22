import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import './App.css'
import { EmptyState } from './components/EmptyState'
import { ExpandingNewsTiles } from './components/ExpandingNewsTiles'
import { GalleryCard } from './components/GalleryCard'
import { MatchCard } from './components/MatchCard'
import { NewsCard } from './components/NewsCard'
import { SectionHeader } from './components/SectionHeader'
import { TeamCard } from './components/TeamCard'
import { useLatestResults, useRecentNews, useTeamsMap, useUpcomingFixtures } from './lib/hooks'
import { extractList, fetchJson, resolveMediaUrl } from './lib/publicApi'

type GalleryItem = {
  id: number
  title: string
  media_type: string
  file_url: string
  thumbnail_url: string | null
}

function App() {
  const { data: newsArticles = [] } = useRecentNews(12)
  const { data: upcomingFixtures = [] } = useUpcomingFixtures(undefined, 6)
  const { data: latestResults = [] } = useLatestResults(undefined, 6)
  const { data: teams = [], map: teamsMap } = useTeamsMap()
  const { data: gallery = [] } = useQuery({
    queryKey: ['home-gallery'],
    queryFn: async () => extractList<GalleryItem>(await fetchJson<unknown>('/public/gallery?page=1&page_size=6')),
    retry: 1,
  })
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)

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

      <section className="home-section">
        <SectionHeader title="Featured Teams" linkTo="/mens/teams" />
        <div className="home-grid home-grid--teams">
          {teams.slice(0, 8).map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      </section>

      <section className="home-section">
        <SectionHeader title="Latest News" linkTo="/news" linkSearch={{ q: '' }} />
        <div className="home-grid home-grid--news">
          {newsArticles.slice(0, 6).map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      </section>

      <section className="home-section">
        <SectionHeader title="Gallery Preview" linkTo="/gallery" />
        <div className="home-grid home-grid--gallery">
          {gallery.map((item) => (
            <GalleryCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
