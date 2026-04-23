import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { EmptyState } from './components/EmptyState'
import { ErrorNotice } from './components/ErrorNotice'
import { LeagueSeasonHub } from './components/LeagueSeasonHub'
import { GalleryCard } from './components/GalleryCard'
import { GalleryLightbox } from './components/GalleryLightbox'
import { MatchCard } from './components/MatchCard'
import { NewsCard } from './components/NewsCard'
import { FeaturedTeamsCarousel } from './components/FeaturedTeamsCarousel'
import { PageHero } from './components/PageHero'
import { SectionHeader } from './components/SectionHeader'
import { Spinner } from './components/Spinner'
import { TeamCard } from './components/TeamCard'
import type { CompetitionCategory } from './lib/competitionCategories'
import { formatCategoryLabel } from './lib/formatters'
import {
  type ArticleLite,
  type MatchLite,
  type TeamLite,
  useLatestResults,
  useRecentNews,
  useTeamsMap,
  useUpcomingFixtures,
} from './lib/hooks'
import { extractList, fetchJson, resolveMediaUrl } from './lib/publicApi'

type GalleryItem = {
  id: number
  title: string
  media_type: string
  file_url: string
  thumbnail_url?: string | null
}

function CategoryHomePage({ category }: { category: string }) {
  const categoryLabel = formatCategoryLabel(category)
  const { data: teams = [] } = useQuery({
    queryKey: ['category-teams', category],
    queryFn: async () =>
      extractList<TeamLite>(await fetchJson<unknown>(`/public/teams?page=1&page_size=20&category=${category}`)),
    retry: 1,
  })
  const { map: teamsMap } = useTeamsMap()
  const { data: fixtures = [] } = useUpcomingFixtures(category, 4)
  const { data: results = [] } = useLatestResults(category, 4)
  const { data: news = [] } = useRecentNews(4, category)

  return (
    <>
      <PageHero
        variant="siteLogo"
        title={`${categoryLabel} Cricket`}
        subtitle={`Follow the ${categoryLabel.toLowerCase()} competition`}
      />
      <main className="container">
        <FeaturedTeamsCarousel
          teams={teams.slice(0, 16)}
          title={`${categoryLabel} Teams`}
          linkTo={`/${category}/teams`}
        />
        <section className="home-section">
          <SectionHeader title="Upcoming Fixtures" linkTo={`/${category}/fixtures`} />
          <div className="home-grid home-grid--matches">
            {fixtures.map((match) => (
              <MatchCard key={match.id} match={match} teamsMap={teamsMap} />
            ))}
          </div>
        </section>
        <section className="home-section">
          <SectionHeader title="Latest Results" linkTo={`/${category}/results`} />
          <div className="home-grid home-grid--matches">
            {results.map((match) => (
              <MatchCard key={match.id} match={match} teamsMap={teamsMap} mode="result" />
            ))}
          </div>
        </section>
        <section className="home-section">
          <SectionHeader title="Related News" linkTo="/news" linkSearch={{ q: '' }} />
          <div className="home-grid home-grid--news">
            {news.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      </main>
    </>
  )
}

function FixturesResultsPage({ category, mode }: { category?: string; mode: 'fixtures' | 'results' }) {
  const endpoint = mode === 'fixtures' ? '/public/fixtures' : '/public/results'
  const suffix = category ? `&category=${category}` : ''
  const { data = [], isLoading, isError } = useQuery({
    queryKey: [endpoint, category ?? 'all'],
    queryFn: async () => extractList<MatchLite>(await fetchJson<unknown>(`${endpoint}?page=1&page_size=30${suffix}`)),
    retry: 1,
  })
  const { map: teamsMap } = useTeamsMap()
  const title = `${category ? `${formatCategoryLabel(category)} ` : ''}${mode === 'fixtures' ? 'Fixtures' : 'Results'}`

  return (
    <>
      <PageHero variant="siteLogo" title={title} subtitle="Live API feed" />
      <main className="container">
        <section className="menu-page">
          {isLoading ? <Spinner /> : null}
          {isError ? <ErrorNotice /> : null}
          {!isLoading && !isError ? (
            <div className="home-grid home-grid--matches">
              {data.map((match) => (
                <MatchCard key={match.id} match={match} teamsMap={teamsMap} mode={mode === 'fixtures' ? 'fixture' : 'result'} />
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </>
  )
}

function TeamsListPage({ category }: { category: string }) {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['teams-list', category],
    queryFn: async () =>
      extractList<TeamLite>(await fetchJson<unknown>(`/public/teams?page=1&page_size=50&category=${category}`)),
    retry: 1,
  })
  const highlightedSlug = new URLSearchParams(globalThis.location.search).get('teamSlug')

  return (
    <main className="container">
      <section className="menu-page">
        <PageHero title={`${formatCategoryLabel(category)} Teams`} subtitle="Squads, venues and leadership" />
        {isLoading ? <Spinner /> : null}
        {isError ? <ErrorNotice /> : null}
        <div className="home-grid home-grid--teams">
          {data.map((team) => (
            <div key={team.id} className={highlightedSlug === team.slug ? 'menu-list-item is-active' : ''}>
              <TeamCard team={team} />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function CategorySeasonsPage({
  category,
  searchPath,
}: {
  category: CompetitionCategory
  searchPath: '/mens/seasons' | '/women/seasons' | '/youth/seasons'
}) {
  const { leagueSlug } = useSearch({ from: searchPath })
  const navigate = useNavigate({ from: searchPath })
  const { data: leagues = [], isLoading: leaguesLoading } = useQuery({
    queryKey: ['category-leagues', category],
    queryFn: async () =>
      extractList<{ id: number; slug: string; name: string }>(
        await fetchJson<unknown>(
          `/public/leagues?page=1&page_size=20&category=${encodeURIComponent(category)}`,
        ),
      ),
    retry: 1,
  })

  const activeLeagueSlug = useMemo(() => {
    if (leagueSlug && leagues.some((l) => l.slug === leagueSlug)) {
      return leagueSlug
    }
    return leagues[0]?.slug ?? ''
  }, [leagueSlug, leagues])

  if (leaguesLoading) {
    return (
      <main className="container">
        <section className="menu-page">
          <Spinner label="Loading leagues..." />
        </section>
      </main>
    )
  }

  if (leagues.length === 0) {
    return (
      <main className="container">
        <section className="menu-page">
          <PageHero
            title={`${formatCategoryLabel(category)} Seasons`}
            subtitle="Browse by league and season"
          />
          <EmptyState title="No leagues in this category yet" />
        </section>
      </main>
    )
  }

  if (!activeLeagueSlug) {
    return (
      <main className="container">
        <Spinner label="Loading..." />
      </main>
    )
  }

  return (
    <LeagueSeasonHub
      key={activeLeagueSlug}
      leagueSlug={activeLeagueSlug}
      onLeagueSlugChange={(next) => {
        void navigate({ search: { leagueSlug: next }, replace: true })
      }}
      showDescription
    />
  )
}

function NewsListPage() {
  const { q } = useSearch({ from: '/news' })
  const navigate = useNavigate({ from: '/news' })
  const trimmed = q.trim()
  const qParam = trimmed ? `&q=${encodeURIComponent(trimmed)}` : ''
  const { data: news = [], isLoading, isError } = useQuery({
    queryKey: ['news-list', trimmed],
    queryFn: async () => extractList<ArticleLite>(await fetchJson<unknown>(`/public/news?page=1&page_size=20${qParam}`)),
    retry: 1,
  })

  return (
    <>
      <PageHero
        fullWidth
        title="News"
        subtitle="Latest updates and reports"
        imageUrl={resolveMediaUrl(news[0]?.featured_image_url)}
      />
      <main className="container">
        <section className="menu-page">
          <input
            className="menu-search-input"
            placeholder="Search news"
            value={q}
            onChange={(e) => navigate({ search: { q: e.target.value }, replace: true })}
          />
          {isLoading ? <Spinner /> : null}
          {isError ? <ErrorNotice /> : null}
          <div className="home-grid home-grid--news">
            {news.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      </main>
    </>
  )
}

function GalleryPageImpl({ mediaType }: { mediaType?: 'image' | 'video' }) {
  const filter = mediaType ? `&media_type=${mediaType}` : ''
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['gallery-page', mediaType ?? 'all'],
    queryFn: async () => extractList<GalleryItem>(await fetchJson<unknown>(`/public/gallery?page=1&page_size=40${filter}`)),
    retry: 1,
  })
  const [active, setActive] = useState<GalleryItem | null>(null)

  return (
    <>
      <PageHero
        variant="siteLogo"
        title={mediaType ? `Gallery ${formatCategoryLabel(mediaType)}` : 'Gallery'}
        subtitle="Images and videos from NPL"
      />
      <main className="container">
        <section className="menu-page">
          {isLoading ? <Spinner /> : null}
          {isError ? <ErrorNotice /> : null}
          <div className="home-grid home-grid--gallery">
            {data.map((item) => (
              <GalleryCard key={item.id} item={item} onOpen={setActive} />
            ))}
          </div>
        </section>
      </main>
      <GalleryLightbox active={active} onClose={() => setActive(null)} />
    </>
  )
}

function AboutPageImpl() {
  const teamsQ = useQuery({
    queryKey: ['about-teams'],
    queryFn: () => fetchJson<{ total?: number }>('/public/teams?page=1&page_size=1'),
    retry: 1,
  })
  const leaguesQ = useQuery({
    queryKey: ['about-leagues'],
    queryFn: () => fetchJson<{ total?: number }>('/public/leagues?page=1&page_size=1'),
    retry: 1,
  })
  const newsQ = useQuery({
    queryKey: ['about-news'],
    queryFn: () => fetchJson<{ total?: number }>('/public/news?page=1&page_size=1'),
    retry: 1,
  })

  return (
    <>
      <PageHero
        variant="siteLogo"
        title="About Zimbabwe Cricket NPL"
        subtitle="Domestic excellence across Mens, Women and Youth competitions."
      />
      <main className="container">
        <section className="menu-page">
          <div className="menu-list">
            <article className="menu-list-item">
              <h2>Teams</h2>
              <p>{teamsQ.data?.total ?? 0}</p>
            </article>
            <article className="menu-list-item">
              <h2>Leagues</h2>
              <p>{leaguesQ.data?.total ?? 0}</p>
            </article>
            <article className="menu-list-item">
              <h2>Published News</h2>
              <p>{newsQ.data?.total ?? 0}</p>
            </article>
            <article className="menu-list-item">
              <h2>Contact</h2>
              <p>media@npl.co.zw</p>
            </article>
          </div>
        </section>
      </main>
    </>
  )
}

export const MensPage = () => <CategoryHomePage category="mens" />
export const MensFixturesPage = () => <FixturesResultsPage category="mens" mode="fixtures" />
export const MensResultsPage = () => <FixturesResultsPage category="mens" mode="results" />
export const MensSeasonsPage = () => (
  <CategorySeasonsPage category="mens" searchPath="/mens/seasons" />
)
export const WomenSeasonsPage = () => (
  <CategorySeasonsPage category="women" searchPath="/women/seasons" />
)
export const YouthSeasonsPage = () => (
  <CategorySeasonsPage category="youth" searchPath="/youth/seasons" />
)
export const MensTeamsPage = () => <TeamsListPage category="mens" />

export const WomenPage = () => <CategoryHomePage category="women" />
export const WomenFixturesPage = () => <FixturesResultsPage category="women" mode="fixtures" />
export const WomenResultsPage = () => <FixturesResultsPage category="women" mode="results" />
export const WomenTeamsPage = () => <TeamsListPage category="women" />

export const YouthPage = () => <CategoryHomePage category="youth" />
export const YouthFixturesPage = () => <FixturesResultsPage category="youth" mode="fixtures" />
export const YouthResultsPage = () => <FixturesResultsPage category="youth" mode="results" />
export const YouthTeamsPage = () => <TeamsListPage category="youth" />

export const NewsPage = () => <NewsListPage />
export const GalleryPage = () => <GalleryPageImpl />
export const GalleryImagesPage = () => <GalleryPageImpl mediaType="image" />
export const GalleryVideoPage = () => <GalleryPageImpl mediaType="video" />
export const AboutUsPage = () => <AboutPageImpl />
export const FixturesPage = () => <FixturesResultsPage mode="fixtures" />
export const ResultsPage = () => <FixturesResultsPage mode="results" />
