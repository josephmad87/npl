import { useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState, useSearch } from '@tanstack/react-router'
import nplLogoUrl from './assets/logo-optimized.png'
import { EmptyState } from './components/EmptyState'
import { ErrorNotice } from './components/ErrorNotice'
import { LeagueSeasonHub } from './components/LeagueSeasonHub'
import { GalleryCard } from './components/GalleryCard'
import { GalleryLightbox } from './components/GalleryLightbox'
import { MatchCard } from './components/MatchCard'
import { MatchCarousel } from './components/MatchCarousel'
import { FixturesListing } from './components/FixturesListing'
import { NewsCard } from './components/NewsCard'
import { FeaturedTeamsCarousel } from './components/FeaturedTeamsCarousel'
import { PageHero } from './components/PageHero'
import LiveScoresPageImpl from './LiveScoresPage'
import { SectionHeader } from './components/SectionHeader'
import { Spinner } from './components/Spinner'
import { TeamCard } from './components/TeamCard'
import type { CompetitionCategory } from './lib/competitionCategories'
import { formatCategoryLabel } from './lib/formatters'
import { matchSeoPath } from './lib/matchUrls'
import {
  type ArticleLite,
  type MatchLite,
  type TeamLite,
  useFeaturedTeams,
  useLatestResults,
  useRecentNews,
  useTeamsMap,
  useUpcomingFixtures,
} from './lib/hooks'
import { extractList, fetchAllPaginatedList, fetchJson, postJson, resolveMediaUrl } from './lib/publicApi'
import { managedSection, useSitePageContent } from './lib/siteContent'
import { ManagedSiteHtml } from './components/ManagedSiteHtml'

type GalleryItem = {
  id: number
  title: string
  media_type: string
  file_url: string
  thumbnail_url?: string | null
}

function CategoryHomePage({ category }: { category: string }) {
  const categoryLabel = formatCategoryLabel(category)
  const { data: featuredTeams = [] } = useFeaturedTeams(category)
  const { map: teamsMap } = useTeamsMap()
  const { data: fixtures = [] } = useUpcomingFixtures(category, 10)
  const { data: results = [] } = useLatestResults(category, 10)
  const { data: news = [] } = useRecentNews(4, category)
  const contentQ = useSitePageContent(category as 'mens' | 'women' | 'youth')
  const teamsContent = managedSection(contentQ.data, 'teams', `${categoryLabel} Teams`)
  const fixturesContent = managedSection(contentQ.data, 'upcoming-fixtures', 'Upcoming Fixtures')
  const resultsContent = managedSection(contentQ.data, 'latest-results', 'Latest Results')
  const newsContent = managedSection(contentQ.data, 'related-news', 'Related News')

  return (
    <>
      <PageHero
        variant="siteLogo"
        title={contentQ.data?.title || `${categoryLabel} Cricket`}
        subtitle={contentQ.data?.subtitle}
      />
    <main className="container">
        <FeaturedTeamsCarousel
          teams={featuredTeams}
          title={teamsContent.heading}
          linkTo={`/${category}/teams`}
          description={<ManagedSiteHtml html={teamsContent.body_html} />}
        />
      <section className="home-section home-match-carousel-section">
        {fixtures.length > 0 ? (
          <MatchCarousel
            title={fixturesContent.heading}
            linkTo={`/${category}/fixtures`}
            matches={fixtures}
            teamsMap={teamsMap}
            mode="fixture"
            description={<ManagedSiteHtml html={fixturesContent.body_html} />}
          />
        ) : null}
        {fixtures.length === 0 ? (
          <>
            <SectionHeader title={fixturesContent.heading} linkTo={`/${category}/fixtures`} description={<ManagedSiteHtml html={fixturesContent.body_html} />} />
            <EmptyState title="No upcoming fixtures yet" />
          </>
        ) : null}
      </section>
        <section className="home-section home-match-carousel-section home-match-carousel-section--category-results">
          {results.length > 0 ? (
            <MatchCarousel
              title={resultsContent.heading}
              linkTo={`/${category}/results`}
              matches={results}
              teamsMap={teamsMap}
              mode="result"
              description={<ManagedSiteHtml html={resultsContent.body_html} />}
            />
          ) : null}
          {results.length === 0 ? (
            <>
        <SectionHeader title={resultsContent.heading} linkTo={`/${category}/results`} description={<ManagedSiteHtml html={resultsContent.body_html} />} />
              <EmptyState title="No results yet" />
            </>
          ) : null}
      </section>
      <section className="home-section">
        <SectionHeader title={newsContent.heading} linkTo="/news" linkSearch={{ q: '' }} description={<ManagedSiteHtml html={newsContent.body_html} />} />
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

const PUBLIC_LIST_PAGE_SIZE = 100
const RESULTS_PAGE_SIZE = 4

function resultYearLabel(match: MatchLite): string {
  const raw = match.match_date?.slice(0, 4) ?? ''
  if (/^\d{4}$/.test(raw)) return raw
  return 'Unknown year'
}

function resultLeagueLabel(match: MatchLite): string {
  const league = match.season?.league?.name?.trim() ?? ''
  if (league) return league
  const season = match.season?.name?.trim() ?? ''
  if (season) return season
  return 'Unknown league'
}

function FixturesPageContent({ category }: { category?: string }) {
  const contentQ = useSitePageContent('fixtures')
  const title = `${category ? `${formatCategoryLabel(category)} ` : ''}${contentQ.data?.title || 'Fixtures'}`
  const pageSubtitle = category === 'mens'
    ? undefined
    : category
      ? `Upcoming and scheduled ${formatCategoryLabel(category).toLowerCase()} matches.`
      : contentQ.data?.subtitle || 'Upcoming and scheduled matches across all competitions.'
  return (
    <>
      <PageHero variant="siteLogo" title={title} subtitle={pageSubtitle} />
      <main className="container">
        <section className="menu-page listings-page listings-page--fixtures">
          <FixturesListing category={category} />
        </section>
      </main>
    </>
  )
}

function ResultsPageContentStateful({ category }: { category?: string }) {
  const endpoint = '/public/results'
  const { data = [], isLoading, isError } = useQuery({
    queryKey: [endpoint, 'all-pages', category ?? 'all'],
    queryFn: async () => {
      const buildPath = (page: number) => {
        const p = new URLSearchParams()
        p.set('page', String(page))
        p.set('page_size', String(PUBLIC_LIST_PAGE_SIZE))
        if (category) p.set('category', category)
        return `${endpoint}?${p.toString()}`
      }
      return fetchAllPaginatedList<MatchLite>(buildPath)
    },
    retry: 1,
  })

  const { map: teamsMap } = useTeamsMap()
  const contentQ = useSitePageContent('results')
  const resultsContent = managedSection(contentQ.data, 'results', 'Results')
  const title = `${category ? `${formatCategoryLabel(category)} ` : ''}${contentQ.data?.title || 'Results'}`

  const pageSubtitle =
    contentQ.data?.subtitle ||
    'Completed match results and scorelines across all competitions.'

  const [requestedYear, setSelectedYear] = useState('all')
  const [requestedLeague, setSelectedLeague] = useState('all')
  const [requestedResultsPageIndex, setResultsPageIndex] = useState(0)

  const yearTabs = useMemo(() => {
    const years = Array.from(new Set(data.map(resultYearLabel)))
    return years.sort((a, b) => {
      if (a === 'Unknown year') return 1
      if (b === 'Unknown year') return -1
      return Number(b) - Number(a)
    })
  }, [data])

  const selectedYear =
    requestedYear === 'all' || yearTabs.includes(requestedYear)
      ? requestedYear
      : 'all'

  const leagueTabs = useMemo(() => {
    const source =
      selectedYear === 'all'
        ? data
        : data.filter((match) => resultYearLabel(match) === selectedYear)

    return Array.from(new Set(source.map(resultLeagueLabel))).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [data, selectedYear])

  const selectedLeague =
    requestedLeague === 'all' || leagueTabs.includes(requestedLeague)
      ? requestedLeague
      : 'all'

  const filteredResults = useMemo(() => {
    return data.filter((match) => {
      if (selectedYear !== 'all' && resultYearLabel(match) !== selectedYear) {
        return false
      }

      if (selectedLeague !== 'all' && resultLeagueLabel(match) !== selectedLeague) {
        return false
      }

      return true
    })
  }, [data, selectedYear, selectedLeague])

  const resultsPageCount = Math.max(
    1,
    Math.ceil(filteredResults.length / RESULTS_PAGE_SIZE),
  )

  const resultsPageIndex = Math.min(
    requestedResultsPageIndex,
    Math.max(0, resultsPageCount - 1),
  )

  const resultsPageStart = resultsPageIndex * RESULTS_PAGE_SIZE

  const pagedResults = filteredResults.slice(
    resultsPageStart,
    resultsPageStart + RESULTS_PAGE_SIZE,
  )

  const canGoPreviousResults = resultsPageIndex > 0
  const canGoNextResults = resultsPageIndex < resultsPageCount - 1

  return (
    <>
      <PageHero variant="siteLogo" title={title} subtitle={pageSubtitle} />

      <main className="container">
        <section className="menu-page listings-page">
          <SectionHeader
            title={resultsContent.heading}
            description={<ManagedSiteHtml html={resultsContent.body_html} />}
          />
          {isLoading ? <Spinner label="Loading results…" /> : null}

          {isError ? (
            <ErrorNotice message="Could not load results." />
          ) : null}

          {!isLoading && !isError && data.length === 0 ? (
            <EmptyState
              title="No results to show yet"
              description="Results will appear here once matches are completed."
            />
          ) : null}

          {!isLoading && !isError && data.length > 0 ? (
            <>
              <div
                className="results-tabs"
                aria-label="Filter results by year and league"
              >
                <div className="results-tabs__row">
                  <span className="results-tabs__label">Year</span>

                  <div
                    className="results-tabs__list"
                    role="group"
                    aria-label="Years"
                  >
                    <button
                      type="button"
                      aria-pressed={selectedYear === 'all'}
                      className={`results-tabs__btn${
                        selectedYear === 'all' ? ' is-active' : ''
                      }`}
                      onClick={() => {
                        setSelectedYear('all')
                        setSelectedLeague('all')
                        setResultsPageIndex(0)
                      }}
                    >
                      All
                    </button>

                    {yearTabs.map((year) => (
                      <button
                        key={year}
                        type="button"
                        aria-pressed={selectedYear === year}
                        className={`results-tabs__btn${
                          selectedYear === year ? ' is-active' : ''
                        }`}
                        onClick={() => {
                          setSelectedYear(year)
                          setSelectedLeague('all')
                          setResultsPageIndex(0)
                        }}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="results-tabs__row">
                  <span className="results-tabs__label">League</span>

                  <div
                    className="results-tabs__list"
                    role="group"
                    aria-label="Leagues"
                  >
                    <button
                      type="button"
                      aria-pressed={selectedLeague === 'all'}
                      className={`results-tabs__btn${
                        selectedLeague === 'all' ? ' is-active' : ''
                      }`}
                      onClick={() => {
                        setSelectedLeague('all')
                        setResultsPageIndex(0)
                      }}
                    >
                      All
                    </button>

                    {leagueTabs.map((league) => (
                      <button
                        key={league}
                        type="button"
                        aria-pressed={selectedLeague === league}
                        className={`results-tabs__btn${
                          selectedLeague === league ? ' is-active' : ''
                        }`}
                        onClick={() => {
                          setSelectedLeague(league)
                          setResultsPageIndex(0)
                        }}
                      >
                        {league}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredResults.length > 0 ? (
                <>
                  <div className="results-page__head">
                    <p>
                      Showing {resultsPageStart + 1}–
                      {Math.min(
                        resultsPageStart + RESULTS_PAGE_SIZE,
                        filteredResults.length,
                      )}{' '}
                      of {filteredResults.length}
                    </p>

                    {filteredResults.length > RESULTS_PAGE_SIZE ? (
                      <div
                        className="results-page__controls"
                        aria-label="Results pages"
                      >
                        <button
                          type="button"
                          className="results-page__nav-btn"
                          onClick={() =>
                            setResultsPageIndex((current) =>
                              Math.max(0, current - 1),
                            )
                          }
                          disabled={!canGoPreviousResults}
                          aria-label="Previous results"
                        >
                          ‹
                        </button>

                        <span>
                          {resultsPageIndex + 1} / {resultsPageCount}
                        </span>

                        <button
                          type="button"
                          className="results-page__nav-btn"
                          onClick={() =>
                            setResultsPageIndex((current) =>
                              Math.min(resultsPageCount - 1, current + 1),
                            )
                          }
                          disabled={!canGoNextResults}
                          aria-label="Next results"
                        >
                          ›
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="results-page__grid">
                    {pagedResults.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        teamsMap={teamsMap}
                        mode="result"
                      />
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState title="No results for this year and league filter" />
              )}
            </>
          ) : null}
        </section>
      </main>
    </>
  )
}

function ResultsPageContent({ category }: { category?: string }) {
  return (
    <ResultsPageContentStateful
      key={category ?? 'all'}
      category={category}
    />
  )
}

function FixturesResultsPage({ category, mode }: { category?: string; mode: 'fixtures' | 'results' }) {
  if (mode === 'fixtures') {
    return <FixturesPageContent category={category} />
  }
  return <ResultsPageContent category={category} />
}

function TeamsListPage({ category }: { category: string }) {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['teams-list', category],
    queryFn: () =>
      fetchAllPaginatedList<TeamLite>(
        (page) =>
          `/public/teams?page=${page}&page_size=100&category=${encodeURIComponent(category)}`,
      ),
    retry: 1,
  })
  const highlightedSlug = new URLSearchParams(globalThis.location.search).get('teamSlug')
  const label = formatCategoryLabel(category)
  const contentQ = useSitePageContent('teams')
  const teamsContent = managedSection(contentQ.data, 'teams', 'Teams')

  return (
    <>
      <PageHero
        variant="siteLogo"
        title={`${label} ${contentQ.data?.title || 'Teams'}`}
        subtitle={contentQ.data?.subtitle || 'Squads, home grounds, and club profiles'}
      />
    <main className="container">
        <section className="menu-page teams-page">
          <SectionHeader
            title={`${label} ${teamsContent.heading}`}
            description={<ManagedSiteHtml html={teamsContent.body_html} />}
          />
          {isLoading ? <Spinner label="Loading teams…" /> : null}
          {isError ? <ErrorNotice message="Could not load teams." /> : null}
          {!isLoading && !isError && data.length === 0 ? (
            <EmptyState
              title="No teams in this category yet"
              description="Team profiles will appear here once they are published."
            />
          ) : null}
          {!isLoading && !isError && data.length > 0 ? (
        <div className="home-grid home-grid--teams">
          {data.map((team) => (
                <div
                  key={team.id}
                  className={
                    highlightedSlug === team.slug
                      ? 'teams-page__cell teams-page__cell--highlight'
                      : 'teams-page__cell'
                  }
                >
              <TeamCard team={team} />
            </div>
          ))}
        </div>
          ) : null}
      </section>
    </main>
    </>
  )
}

function CategorySeasonsPage({
  category,
  searchPath,
}: {
  category: CompetitionCategory
  searchPath: '/mens/seasons' | '/women/seasons' | '/youth/seasons'
}) {
  const contentQ = useSitePageContent('seasons')
  const seasonsTitle = `${formatCategoryLabel(category)} ${contentQ.data?.title || 'Seasons'}`
  const seasonsSubtitle = contentQ.data?.subtitle || 'Browse by league and season'
  const { leagueSlug } = useSearch({ from: searchPath })
  const navigate = useNavigate({ from: searchPath })
  const { data: leagues = [], isLoading: leaguesLoading } = useQuery({
    queryKey: ['category-leagues', category],
    queryFn: () =>
      fetchAllPaginatedList<{ id: number; slug: string; name: string }>(
        (page) =>
          `/public/leagues?page=${page}&page_size=100&category=${encodeURIComponent(category)}`,
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
      <>
        <PageHero
          variant="siteLogo"
          title={seasonsTitle}
          subtitle={seasonsSubtitle}
        />
        <main className="container">
          <section className="menu-page">
            <Spinner label="Loading leagues…" />
          </section>
        </main>
      </>
    )
  }

  if (leagues.length === 0) {
  return (
      <>
        <PageHero
          variant="siteLogo"
          title={seasonsTitle}
          subtitle={seasonsSubtitle}
        />
    <main className="container">
      <section className="menu-page">
            <EmptyState
              title="No leagues in this category yet"
              description="Check back when competitions are announced."
            />
      </section>
    </main>
      </>
    )
  }

  if (!activeLeagueSlug) {
    return (
      <>
        <PageHero
          variant="siteLogo"
          title={seasonsTitle}
          subtitle={seasonsSubtitle}
        />
        <main className="container">
          <Spinner label="Loading…" />
        </main>
      </>
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
    queryFn: async () =>
      fetchAllPaginatedList<ArticleLite>(
        (page) => `/public/news?page=${page}&page_size=50${qParam}`,
      ),
    retry: 1,
  })
  const contentQ = useSitePageContent('news')
  const newsContent = managedSection(contentQ.data, 'news', 'News')

  return (
    <>
      <PageHero
        fullWidth
        title={contentQ.data?.title || 'News'}
        subtitle={contentQ.data?.subtitle}
        imageUrl={resolveMediaUrl(news[0]?.featured_image_url)}
      />
    <main className="container">
        <section className="menu-page news-page">
          <SectionHeader
            title={newsContent.heading}
            description={<ManagedSiteHtml html={newsContent.body_html} />}
          />
          <div className="news-page__search">
            <label htmlFor="news-search" className="news-page__search-label">
              Search articles
            </label>
        <input
              id="news-search"
              className="news-page__search-input"
              type="search"
              placeholder="Search by headline or topic"
              autoComplete="off"
          value={q}
          onChange={(e) => navigate({ search: { q: e.target.value }, replace: true })}
        />
          </div>
          {isLoading ? <Spinner label="Loading news…" /> : null}
          {isError ? <ErrorNotice message="Could not load news." /> : null}
          {!isLoading && !isError && news.length === 0 ? (
            <EmptyState
              title={trimmed ? 'No articles match your search' : 'No published articles yet'}
              description={
                trimmed
                  ? 'Try a shorter search or clear the field to see all stories.'
                  : 'New stories will show here once they are published.'
              }
            />
          ) : null}
          {!isLoading && !isError && news.length > 0 ? (
        <div className="home-grid home-grid--news">
          {news.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
          ) : null}
      </section>
    </main>
    </>
  )
}

function SearchResultsPageImpl() {
  const { q, type } = useSearch({ from: '/search' })
  const navigate = useNavigate({ from: '/search' })
  const query = q.trim()
  const hasQuery = query.length > 0
  const encodedQuery = encodeURIComponent(query)
  const activeFilter = type as SearchFilter
  const { map: teamsMap } = useTeamsMap()
  const contentQ = useSitePageContent('search')
  const searchResultsContent = managedSection(contentQ.data, 'results', 'Search Results')

  const resultsQ = useQuery({
    queryKey: ['site-search', query],
    queryFn: async () => {
      const [teamsRaw, playersRaw, newsRaw, leaguesRaw, fixturesRaw, resultsRaw] = await Promise.all([
        fetchJson<unknown>(`/public/teams?page=1&page_size=12&q=${encodedQuery}`),
        fetchJson<unknown>(`/public/players?page=1&page_size=12&q=${encodedQuery}`),
        fetchJson<unknown>(`/public/news?page=1&page_size=12&q=${encodedQuery}`),
        fetchJson<unknown>(`/public/leagues?page=1&page_size=12&q=${encodedQuery}`),
        fetchJson<unknown>(`/public/fixtures?page=1&page_size=12&q=${encodedQuery}`),
        fetchJson<unknown>(`/public/results?page=1&page_size=12&q=${encodedQuery}`),
      ])
      return {
        teams: extractList<SearchTeam>(teamsRaw),
        players: extractList<SearchPlayer>(playersRaw),
        news: extractList<ArticleLite>(newsRaw),
        leagues: extractList<SearchLeague>(leaguesRaw),
        fixtures: extractList<MatchLite>(fixturesRaw),
        results: extractList<MatchLite>(resultsRaw),
      }
    },
    enabled: hasQuery,
    retry: 1,
  })

  const results = useMemo<SearchResultItem[]>(() => {
    const data = resultsQ.data
    if (!data) return []

    const matchTitle = (match: MatchLite) => {
      const homeName = teamsMap[match.home_team_id]?.name ?? `Team ${match.home_team_id}`
      const awayName = teamsMap[match.away_team_id]?.name ?? `Team ${match.away_team_id}`
      return `${homeName} vs ${awayName}`
    }

    return [
        ...data.news.map((article) => ({
          key: `news-${article.id}`,
          kind: 'news' as const,
          title: article.title,
          snippet:
            article.excerpt?.trim() ??
            article.category?.trim() ??
            'News article and competition update.',
          slug: article.slug,
        })),
        ...data.teams.map((team) => ({
          key: `team-${team.id}`,
          kind: 'team' as const,
          title: team.name,
          snippet: `${formatCategoryLabel(team.category ?? 'mens')} team profile`,
          slug: team.slug,
        })),
        ...data.players.map((player) => ({
          key: `player-${player.id}`,
          kind: 'player' as const,
          title: player.full_name,
          snippet: player.role?.trim() ?? 'Player profile and stats',
          slug: player.slug,
        })),
        ...data.leagues.map((league) => ({
          key: `league-${league.id}`,
          kind: 'league' as const,
          title: league.name,
          snippet:
            league.description?.trim() ??
            `${formatCategoryLabel(league.category ?? 'mens')} competition league`,
          slug: league.slug,
        })),
        ...data.fixtures.map((match) => ({
          key: `fixture-${match.id}`,
          kind: 'fixture' as const,
          title: matchTitle(match),
          snippet: [match.match_date, match.venue].filter(Boolean).join(' · ') || 'Upcoming fixture',
          match,
        })),
        ...data.results.map((match) => ({
          key: `result-${match.id}`,
          kind: 'result' as const,
          title: matchTitle(match),
          snippet: match.result?.margin_text?.trim() ?? match.result?.score_summary?.trim() ?? 'Completed match result',
          match,
        })),
      ]
  }, [resultsQ.data, teamsMap])
  const filteredResults = useMemo(() => {
    if (activeFilter === 'all') return results
    return results.filter((item) => item.kind === activeFilter)
  }, [results, activeFilter])
  const filterTabs: Array<{ id: SearchFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'news', label: 'News' },
    { id: 'team', label: 'Teams' },
    { id: 'player', label: 'Players' },
    { id: 'league', label: 'Leagues' },
    { id: 'fixture', label: 'Fixtures' },
    { id: 'result', label: 'Results' },
  ]

  return (
    <>
      <PageHero
        variant="siteLogo"
        title={contentQ.data?.title || 'Search'}
        subtitle={hasQuery ? `Results for "${query}"` : contentQ.data?.subtitle || 'Find news, teams, players, and leagues'}
      />
      <main className="container">
        <section className="menu-page search-page">
          <SectionHeader
            title={searchResultsContent.heading}
            description={<ManagedSiteHtml html={searchResultsContent.body_html} />}
          />
          <form
            className="search-page__form"
            onSubmit={(e) => {
              e.preventDefault()
              const form = new FormData(e.currentTarget)
              const next = String(form.get('q') ?? '').trim()
              void navigate({ search: { q: next, type: 'all' } })
            }}
          >
            <label className="search-page__label" htmlFor="site-search-results-input">
              Search site
            </label>
            <input
              id="site-search-results-input"
              name="q"
              type="search"
              className="search-page__input"
              defaultValue={q}
              placeholder="Search players, teams, news, and leagues"
            />
          </form>

          {!hasQuery ? (
            <EmptyState
              title="Start typing to search"
              description="Use the search box above to find content across the site."
            />
          ) : null}
          {hasQuery && resultsQ.isLoading ? <Spinner label="Searching…" /> : null}
          {hasQuery && resultsQ.isError ? (
            <ErrorNotice message="Search failed. Please try again." />
          ) : null}
          {hasQuery && !resultsQ.isLoading && !resultsQ.isError && results.length === 0 ? (
            <EmptyState title="No search results found" />
          ) : null}
          {hasQuery && !resultsQ.isLoading && !resultsQ.isError && results.length > 0 ? (
            <>
              <div className="search-page__tabs" role="tablist" aria-label="Search result filters">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    id={`search-tab-${tab.id}`}
                    role="tab"
                    aria-selected={activeFilter === tab.id}
                    aria-controls={`search-panel-${tab.id}`}
                    className={`search-page__tab${activeFilter === tab.id ? ' is-active' : ''}`}
                    onClick={() => {
                      void navigate({
                        search: {
                          q,
                          type: tab.id,
                        },
                        replace: true,
                      })
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div
                id={`search-panel-${activeFilter}`}
                role="tabpanel"
                aria-labelledby={`search-tab-${activeFilter}`}
                tabIndex={0}
              >
                {filteredResults.length === 0 ? (
                  <EmptyState title="No results in this filter" />
                ) : null}
                <div className="search-page__results" role="list" aria-label="Search results">
                  {filteredResults.map((item) => (
                  <article key={item.key} className="search-page__result" role="listitem">
                  {item.kind === 'news' ? (
                    <Link to="/news/$slug" params={{ slug: item.slug! }} className="search-page__title">
                      {item.title}
                    </Link>
                  ) : null}
                  {item.kind === 'team' ? (
                    <Link to="/teams/$slug" params={{ slug: item.slug! }} className="search-page__title">
                      {item.title}
                    </Link>
                  ) : null}
                  {item.kind === 'player' ? (
                    <Link to="/players/$slug" params={{ slug: item.slug! }} className="search-page__title">
                      {item.title}
                    </Link>
                  ) : null}
                  {item.kind === 'league' ? (
                    <Link to="/leagues/$slug" params={{ slug: item.slug! }} className="search-page__title">
                      {item.title}
                    </Link>
                  ) : null}
                  {item.kind === 'fixture' || item.kind === 'result' ? (
                    <Link to={matchSeoPath(item.match!)} className="search-page__title">
                      {item.title}
                    </Link>
                  ) : null}
                  <p className="search-page__meta">{item.kind.toUpperCase()}</p>
                  <p className="search-page__snippet">{item.snippet}</p>
                  </article>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </section>
      </main>
    </>
  )
}

function GalleryPageImpl({ mediaType }: { mediaType?: 'image' | 'video' }) {
  const filter = mediaType ? `&media_type=${mediaType}` : ''
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['gallery-page', mediaType ?? 'all'],
    queryFn: () =>
      fetchAllPaginatedList<GalleryItem>(
        (page) => `/public/gallery?page=${page}&page_size=100${filter}`,
      ),
    retry: 1,
  })
  const [active, setActive] = useState<GalleryItem | null>(null)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const contentQ = useSitePageContent('gallery')
  const galleryContent = managedSection(contentQ.data, 'gallery', 'Gallery')
  const heroTitle = mediaType ? `${formatCategoryLabel(mediaType)}s` : contentQ.data?.title || 'Gallery'
  const heroSubtitle = mediaType
    ? mediaType === 'image'
      ? 'Photos from matches, events, and behind the scenes'
      : 'Match highlights and event coverage'
    : contentQ.data?.subtitle || 'Photos and video from across the National Premier League'

  return (
    <>
      <PageHero variant="siteLogo" title={heroTitle} subtitle={heroSubtitle} />
    <main className="container">
        <section className="menu-page gallery-page">
          <SectionHeader
            title={galleryContent.heading}
            description={<ManagedSiteHtml html={galleryContent.body_html} />}
          />
          <nav className="gallery-subnav" aria-label="Gallery categories">
            <Link
              to="/gallery"
              className={`gallery-subnav__link${pathname === '/gallery' ? ' is-active' : ''}`}
            >
              All
            </Link>
            <Link
              to="/gallery/images"
              className={`gallery-subnav__link${pathname === '/gallery/images' ? ' is-active' : ''}`}
            >
              Images
            </Link>
            <Link
              to="/gallery/video"
              className={`gallery-subnav__link${pathname === '/gallery/video' ? ' is-active' : ''}`}
            >
              Video
            </Link>
          </nav>
          {isLoading ? <Spinner label="Loading gallery…" /> : null}
          {isError ? <ErrorNotice message="Could not load gallery." /> : null}
          {!isLoading && !isError && data.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              description="New images and clips will show up as they are published."
            />
          ) : null}
          {!isLoading && !isError && data.length > 0 ? (
        <div className="home-grid home-grid--gallery">
          {data.map((item) => (
            <GalleryCard key={item.id} item={item} onOpen={setActive} />
          ))}
        </div>
          ) : null}
      </section>
      </main>
      <GalleryLightbox active={active} onClose={() => setActive(null)} />
    </>
  )
}

type SearchTeam = {
  id: number
  name: string
  slug: string
  category?: string | null
}

type SearchPlayer = {
  id: number
  full_name: string
  slug: string
  role?: string | null
}

type SearchLeague = {
  id: number
  name: string
  slug: string
  category?: string | null
  description?: string | null
}

type SearchResultItem = {
  key: string
  kind: 'news' | 'team' | 'player' | 'league' | 'fixture' | 'result'
  title: string
  snippet: string
  slug?: string
  match?: MatchLite
}

type SearchFilter = 'all' | SearchResultItem['kind']
type CompareMatchResult = {
  outcome?: string | null
  winning_team_id?: number | null
  margin_text?: string | null
  score_summary?: string | null
}

type CompareOutcome = 'W' | 'L' | 'T' | 'NR'

type CompareStats = {
  played: number
  won: number
  lost: number
  tied: number
  nr: number
  points: number
}

function compareMatchIncludesTeam(match: MatchLite, teamId: number): boolean {
  return match.home_team_id === teamId || match.away_team_id === teamId
}

function compareMatchTime(match: MatchLite): number {
  const raw = String(match.start_time ?? match.match_date ?? '')
  const parsed = Date.parse(raw)

  if (!Number.isNaN(parsed)) {
    return parsed
  }

  return Number(match.id ?? 0)
}

function compareResultForTeam(match: MatchLite, teamId: number): CompareOutcome | null {
  if (!compareMatchIncludesTeam(match, teamId)) return null

  const result = (match as MatchLite & { result?: CompareMatchResult | null }).result
  if (!result) return null

  const outcome = String(result.outcome ?? 'win').trim().toLowerCase()

  if (outcome === 'tie') return 'T'
  if (outcome === 'no_result') return 'NR'

  if (result.winning_team_id == null) return 'NR'

  return result.winning_team_id === teamId ? 'W' : 'L'
}

function compareTeamStats(matches: MatchLite[], teamId: number): CompareStats {
  return matches.reduce<CompareStats>(
    (stats, match) => {
      const outcome = compareResultForTeam(match, teamId)

      if (!outcome) return stats

      stats.played += 1

      if (outcome === 'W') {
        stats.won += 1
        stats.points += 4
      } else if (outcome === 'T') {
        stats.tied += 1
        stats.points += 3
      } else if (outcome === 'NR') {
        stats.nr += 1
        stats.points += 2
      } else {
        stats.lost += 1
      }

      return stats
    },
    {
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      nr: 0,
      points: 0,
    },
  )
}

function compareRecentForm(matches: MatchLite[], teamId: number): CompareOutcome[] {
  return [...matches]
    .filter((match) => compareMatchIncludesTeam(match, teamId))
    .sort((a, b) => compareMatchTime(b) - compareMatchTime(a))
    .map((match) => compareResultForTeam(match, teamId))
    .filter((item): item is CompareOutcome => Boolean(item))
    .slice(0, 5)
}

function compareOutcomeLabel(outcome: CompareOutcome): string {
  if (outcome === 'W') return 'Win'
  if (outcome === 'L') return 'Loss'
  if (outcome === 'T') return 'Tie'
  return 'No result'
}

function compareMatchDate(match: MatchLite): string {
  const raw = match.match_date ?? match.start_time ?? ''
  if (!raw) return 'Date TBC'

  const d = new Date(raw)
  if (Number.isNaN(d.valueOf())) return String(raw).slice(0, 10)

  return new Intl.DateTimeFormat('en-ZW', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

function CompareTeamsPageImpl() {
  const contentQ = useSitePageContent('compare-teams')
  const seasonRecordContent = managedSection(contentQ.data, 'season-record', 'Season Record Comparison')
  const recentFormContent = managedSection(contentQ.data, 'recent-form', 'Recent Form')
  const headToHeadContent = managedSection(contentQ.data, 'head-to-head', 'Head-to-head')
  const { data: teams = [], isLoading: teamsLoading, isError: teamsError } = useQuery({
    queryKey: ['compare-teams-list'],
    queryFn: () =>
      fetchAllPaginatedList<TeamLite>(
        (page) => `/public/teams?page=${page}&page_size=100`,
      ),
    retry: 1,
  })

  const { data: results = [], isLoading: resultsLoading, isError: resultsError } = useQuery({
    queryKey: ['compare-teams-results'],
    queryFn: () =>
      fetchAllPaginatedList<MatchLite>(
        (page) => `/public/results?page=${page}&page_size=100`,
      ),
    retry: 1,
  })

  const [requestedTeamAId, setTeamAId] = useState('')
  const [requestedTeamBId, setTeamBId] = useState('')

  const teamAId = teams.some((team) => String(team.id) === requestedTeamAId)
    ? requestedTeamAId
    : String(teams[0]?.id ?? '')
  const firstOtherTeam = teams.find((team) => String(team.id) !== teamAId)
  const teamBId = teams.some(
    (team) =>
      String(team.id) === requestedTeamBId && requestedTeamBId !== teamAId,
  )
    ? requestedTeamBId
    : String(firstOtherTeam?.id ?? '')

  const selectedTeamA = teams.find((team) => String(team.id) === teamAId) ?? null
  const selectedTeamB = teams.find((team) => String(team.id) === teamBId) ?? null

  const comparison = useMemo(() => {
    if (!selectedTeamA || !selectedTeamB) return null

    const teamAStats = compareTeamStats(results, selectedTeamA.id)
    const teamBStats = compareTeamStats(results, selectedTeamB.id)

    const headToHead = results
      .filter(
        (match) =>
          compareMatchIncludesTeam(match, selectedTeamA.id) &&
          compareMatchIncludesTeam(match, selectedTeamB.id),
      )
      .sort((a, b) => compareMatchTime(b) - compareMatchTime(a))

    return {
      teamAStats,
      teamBStats,
      teamAForm: compareRecentForm(results, selectedTeamA.id),
      teamBForm: compareRecentForm(results, selectedTeamB.id),
      headToHead,
    }
  }, [results, selectedTeamA, selectedTeamB])

  const isLoading = teamsLoading || resultsLoading
  const isError = teamsError || resultsError

  const statRows = comparison
    ? [
        ['Matches', comparison.teamAStats.played, comparison.teamBStats.played],
        ['Wins', comparison.teamAStats.won, comparison.teamBStats.won],
        ['Losses', comparison.teamAStats.lost, comparison.teamBStats.lost],
        ['Ties', comparison.teamAStats.tied, comparison.teamBStats.tied],
        ['No results', comparison.teamAStats.nr, comparison.teamBStats.nr],
        ['Points', comparison.teamAStats.points, comparison.teamBStats.points],
      ]
    : []

  return (
    <>
      <PageHero
        variant="siteLogo"
        title={contentQ.data?.title || 'Compare Teams'}
        subtitle={contentQ.data?.subtitle || 'Compare NPL teams by results, points, recent form, and head-to-head record.'}
      />

      <main className="container">
        <section className="menu-page compare-teams-page">
          {isLoading ? <Spinner label="Loading teams and results…" /> : null}
          {isError ? <ErrorNotice message="Could not load comparison data." /> : null}

          {!isLoading && !isError && teams.length < 2 ? (
            <EmptyState
              title="Not enough teams to compare"
              description="At least two published teams are needed for this feature."
            />
          ) : null}

          {!isLoading && !isError && teams.length >= 2 ? (
            <>
              <div className="compare-teams-picker">
                <label>
                  <span>Team 1</span>
                  <select value={teamAId} onChange={(event) => setTeamAId(event.target.value)}>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="compare-teams-picker__versus">vs</div>

                <label>
                  <span>Team 2</span>
                  <select value={teamBId} onChange={(event) => setTeamBId(event.target.value)}>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id} disabled={String(team.id) === teamAId}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedTeamA && selectedTeamB && comparison ? (
                <>
                  <div className="compare-teams-summary">
                    <article>
                      <p className="compare-teams-summary__eyebrow">Team 1</p>
                      <h2>{selectedTeamA.name}</h2>
                      <Link to="/teams/$slug" params={{ slug: selectedTeamA.slug }}>
                        View team profile
                      </Link>
                    </article>

                    <article>
                      <p className="compare-teams-summary__eyebrow">Team 2</p>
                      <h2>{selectedTeamB.name}</h2>
                      <Link to="/teams/$slug" params={{ slug: selectedTeamB.slug }}>
                        View team profile
                      </Link>
                    </article>
                  </div>

                  <div className="compare-teams-panel">
                    <h2>{seasonRecordContent.heading}</h2>
                    <ManagedSiteHtml html={seasonRecordContent.body_html} className="muted managed-rich-text" />
                    <div
                      className="compare-teams-table-wrap npl-table-region"
                      role="region"
                      aria-label={`${seasonRecordContent.heading} table`}
                      tabIndex={0}
                    >
                      <table className="compare-teams-table">
                        <thead>
                          <tr>
                            <th scope="col">{selectedTeamA.name}</th>
                            <th scope="col">Stat</th>
                            <th scope="col">{selectedTeamB.name}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statRows.map(([label, aValue, bValue]) => (
                            <tr key={label}>
                              <td>{aValue}</td>
                              <td>{label}</td>
                              <td>{bValue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="compare-teams-form-grid">
                    <article className="compare-teams-panel">
                      <h2>{selectedTeamA.name} — {recentFormContent.heading}</h2>
                      <ManagedSiteHtml html={recentFormContent.body_html} className="muted managed-rich-text" />
                      <div className="compare-team-form">
                        {comparison.teamAForm.length > 0 ? (
                          comparison.teamAForm.map((item, index) => (
                            <span
                              key={`${selectedTeamA.id}-${index}-${item}`}
                              className={`league-form-pill league-form-pill--${item.toLowerCase()}`}
                              title={compareOutcomeLabel(item)}
                            >
                              {item}
                            </span>
                          ))
                        ) : (
                          <span className="league-form-empty">No recent results</span>
                        )}
                      </div>
                    </article>

                    <article className="compare-teams-panel">
                      <h2>{selectedTeamB.name} — {recentFormContent.heading}</h2>
                      <ManagedSiteHtml html={recentFormContent.body_html} className="muted managed-rich-text" />
                      <div className="compare-team-form">
                        {comparison.teamBForm.length > 0 ? (
                          comparison.teamBForm.map((item, index) => (
                            <span
                              key={`${selectedTeamB.id}-${index}-${item}`}
                              className={`league-form-pill league-form-pill--${item.toLowerCase()}`}
                              title={compareOutcomeLabel(item)}
                            >
                              {item}
                            </span>
                          ))
                        ) : (
                          <span className="league-form-empty">No recent results</span>
                        )}
                      </div>
                    </article>
                  </div>

                  <div className="compare-teams-panel">
                    <h2>{headToHeadContent.heading}</h2>
                    <ManagedSiteHtml html={headToHeadContent.body_html} className="muted managed-rich-text" />
                    {comparison.headToHead.length === 0 ? (
                      <p className="muted">No published head-to-head results yet.</p>
                    ) : (
                      <div className="compare-head-to-head-list">
                        {comparison.headToHead.slice(0, 6).map((match) => {
                          const result = (match as MatchLite & {
                            result?: CompareMatchResult | null
                          }).result
                          const teamAOutcome = compareResultForTeam(match, selectedTeamA.id)

                          return (
                            <article key={match.id} className="compare-head-to-head-card">
                              <div>
                                <p className="compare-head-to-head-card__date">
                                  {compareMatchDate(match)}
                                </p>
                                <h3>
                                  {selectedTeamA.name} vs {selectedTeamB.name}
                                </h3>
                                <p>
                                  {result?.margin_text ??
                                    result?.score_summary ??
                                    'Result published'}
                                </p>
                              </div>

                              <div className="compare-head-to-head-card__side">
                                {teamAOutcome ? (
                                  <span
                                    className={`league-form-pill league-form-pill--${teamAOutcome.toLowerCase()}`}
                                    title={`${selectedTeamA.name}: ${compareOutcomeLabel(teamAOutcome)}`}
                                  >
                                    {teamAOutcome}
                                  </span>
                                ) : null}
                                <Link to={matchSeoPath(match)}>
                                  Match centre
                                </Link>
                              </div>
                            </article>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </section>
      </main>
    </>
  )
}

type PublicAboutContent = {
  mission: string
  vision: string
  history: string
  team: Array<{ position?: string | null; picture_url?: string | null }>
  contacts: { emails: string[]; phone: string }
  social_links?: {
    facebook?: string
    instagram?: string
    twitter?: string
    youtube?: string
  }
  physical_address: string
  updated_at: string
}

function formatAboutUpdatedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return iso
  return new Intl.DateTimeFormat('en-ZW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d)
}

function AboutInlineImage({
  url,
  alt,
  className,
}: {
  url: string | null | undefined
  alt: string
  className: string
}) {
  const resolved = resolveMediaUrl(url?.trim() ?? '') ?? nplLogoUrl
  return (
    <img
      className={className}
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

function AboutTextSection({
  title,
  text,
  descriptionHtml,
  className,
}: {
  title: string
  text: string
  descriptionHtml?: string
  className?: string
}) {
  const body = text.trim()
  if (!body) return null
  const paragraphs = body
    .split(/\n\s*\n/u)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
  return (
    <section className={`about-page__story-card${className ? ` ${className}` : ''}`}>
      <h2 className="about-page__story-title">{title}</h2>
      {descriptionHtml ? <ManagedSiteHtml html={descriptionHtml} /> : null}
      <div className="about-page__story-body">
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </section>
  )
}

function AboutPageImpl() {
  const contentQ = useSitePageContent('about-us')
  const missionContent = managedSection(contentQ.data, 'mission', 'Mission')
  const visionContent = managedSection(contentQ.data, 'vision', 'Vision')
  const historyContent = managedSection(contentQ.data, 'history', 'History')
  const leadershipContent = managedSection(contentQ.data, 'leadership-team', 'Leadership & Team')
  const contactContent = managedSection(contentQ.data, 'contact', 'Contact')
  const addressContent = managedSection(contentQ.data, 'physical-address', 'Physical Address')
  const aboutQ = useQuery({
    queryKey: ['public-about'],
    queryFn: () => fetchJson<PublicAboutContent>('/public/about'),
    retry: 1,
  })

  const about = aboutQ.data

  const pageTitle = contentQ.data?.title || 'About Us'
  const heroSubtitle = contentQ.data?.subtitle || ''

  const teamMembers = useMemo(() => {
    const rows = about?.team ?? []
    return rows.filter(
      (r) => (r.position?.trim() ?? '') !== '' || (r.picture_url?.trim() ?? '') !== '',
    )
  }, [about?.team])

  const hasContactBlock = useMemo(() => {
    if (!about) return false
    const emails = about.contacts?.emails?.filter((e) => e.trim()) ?? []
    const phone = about.contacts?.phone?.trim() ?? ''
    const addr = about.physical_address?.trim() ?? ''
    return emails.length > 0 || phone !== '' || addr !== ''
  }, [about])

  const hasStoryContent = useMemo(() => {
    if (!about) return false
    return (
      about.mission.trim() !== '' ||
      about.vision.trim() !== '' ||
      about.history.trim() !== '' ||
      teamMembers.length > 0 ||
      hasContactBlock
    )
  }, [about, teamMembers.length, hasContactBlock])

  if (aboutQ.isLoading) {
    return (
      <>
        <PageHero
          variant="siteLogo"
          title={pageTitle}
          subtitle="Loading official page content…"
          imageUrl=""
          fallbackMode="none"
        />
        <main className="container">
          <section className="menu-page about-page">
            <Spinner label="Loading about content…" />
          </section>
        </main>
      </>
    )
  }

  if (aboutQ.isError || !about) {
    return (
      <>
        <PageHero
          variant="siteLogo"
          title={pageTitle}
          subtitle={heroSubtitle || 'Official league information'}
          imageUrl=""
          fallbackMode="none"
        />
        <main className="container">
          <section className="menu-page about-page">
            <ErrorNotice message="Could not load the About page. Please try again later." />
          </section>
        </main>
      </>
    )
  }

  const showEmptyHint = !hasStoryContent

  return (
    <>
      <PageHero
        variant="siteLogo"
        title={pageTitle}
        subtitle={heroSubtitle}
        imageUrl=""
        fallbackMode="none"
      />
    <main className="container">
        <section className="menu-page about-page">
          {showEmptyHint ? (
            <EmptyState
              title="About content coming soon"
              description="League copy, leadership photos, contacts, and sponsors can be added in the admin About screen."
            />
          ) : null}

          <section className="about-page__story-layout">
            <div className="about-page__story-row about-page__story-row--duo">
              <AboutTextSection
                title={missionContent.heading}
                text={about.mission}
                descriptionHtml={missionContent.body_html}
                className="about-page__story-card--mission"
              />
              <AboutTextSection
                title={visionContent.heading}
                text={about.vision}
                descriptionHtml={visionContent.body_html}
                className="about-page__story-card--vision"
              />
            </div>
            <div className="about-page__story-row about-page__story-row--single">
              <AboutTextSection
                title={historyContent.heading}
                text={about.history}
                descriptionHtml={historyContent.body_html}
                className="about-page__story-card--history"
              />
            </div>
          </section>

          {teamMembers.length > 0 ? (
            <section className="about-page__block about-page__block--card">
              <h2 className="about-page__block-title">{leadershipContent.heading}</h2>
              <ManagedSiteHtml html={leadershipContent.body_html} />
              <ul className="about-page__team-grid">
                {teamMembers.map((row, i) => (
                  <li key={`${row.position ?? ''}-${i}`} className="about-page__team-card">
                    <AboutInlineImage
                      url={row.picture_url}
                      alt={row.position?.trim() ? `${row.position.trim()} portrait` : 'Team member'}
                      className="about-page__team-photo"
                    />
                    <p className="about-page__team-position">
                      {row.position?.trim() ? row.position.trim() : '—'}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {hasContactBlock ? (
            <section className="about-page__block about-page__block--card">
              <h2 className="about-page__block-title">{contactContent.heading}</h2>
              <ManagedSiteHtml html={contactContent.body_html} />
              <ul className="about-page__contact-list">
                {(about.contacts?.emails ?? [])
                  .map((e) => e.trim())
                  .filter(Boolean)
                  .map((email) => (
                    <li key={email}>
                      <a className="about-page__email" href={`mailto:${email}`}>
                        {email}
                      </a>
                    </li>
                  ))}
              </ul>
              {about.contacts?.phone?.trim() ? (
                <p className="about-page__phone-line">
                  <span className="about-page__contact-label">Phone</span>{' '}
                  <a href={`tel:${about.contacts.phone.replace(/\s+/g, '')}`}>
                    {about.contacts.phone.trim()}
                  </a>
                </p>
              ) : null}
              {about.physical_address?.trim() ? (
                <>
                  <h3 className="about-page__address-label">{addressContent.heading}</h3>
                  <ManagedSiteHtml html={addressContent.body_html} />
                  <div className="about-page__prose about-page__prose--address">
                    {about.physical_address.trim()}
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          <p className="about-page__meta">Page last updated {formatAboutUpdatedAt(about.updated_at)}</p>
      </section>
    </main>
    </>
  )
}

function ContactUsPageImpl() {
  const contentQ = useSitePageContent('contact-us')
  const sendMessageContent = managedSection(contentQ.data, 'send-message', 'Send Us a Message')
  const emailContent = managedSection(contentQ.data, 'email', 'Email')
  const phoneContent = managedSection(contentQ.data, 'phone', 'Phone')
  const addressContent = managedSection(contentQ.data, 'office-address', 'Office Address')
  const linksContent = managedSection(contentQ.data, 'helpful-links', 'Helpful Links')
  const aboutQ = useQuery({
    queryKey: ['public-about'],
    queryFn: () => fetchJson<PublicAboutContent>('/public/about'),
    retry: 1,
  })
  const about = aboutQ.data
  const emails = (about?.contacts?.emails ?? []).map((e) => e.trim()).filter(Boolean)
  const primaryEmail = emails[0] ?? ''
  const phone = about?.contacts?.phone?.trim() ?? ''
  const address = about?.physical_address?.trim() ?? ''
  const hasAnyContact = emails.length > 0 || phone !== '' || address !== ''
  const [fullName, setFullName] = useState('')
  const [senderPhone, setSenderPhone] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [submitState, setSubmitState] = useState<
    'idle' | 'sending' | 'success' | 'error'
  >('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const isMessageReady =
    fullName.trim() !== '' &&
    senderEmail.trim() !== '' &&
    message.trim() !== '' &&
    submitState !== 'sending'

  const handleMessageSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isMessageReady) return

    setSubmitState('sending')
    setSubmitError(null)
    try {
      await postJson('/public/contact', {
        full_name: fullName.trim(),
        email: senderEmail.trim(),
        phone: senderPhone.trim() || null,
        message: message.trim(),
        website: website.trim() || null,
      })
      setSubmitState('success')
      setFullName('')
      setSenderPhone('')
      setSenderEmail('')
      setMessage('')
      setWebsite('')
    } catch {
      setSubmitState('error')
      setSubmitError('Could not send your message. Please try again or email us directly.')
    }
  }

  return (
    <>
      <PageHero
        variant="siteLogo"
        title={contentQ.data?.title || 'Contact Us'}
        subtitle={contentQ.data?.subtitle || 'Reach the Zimbabwe Cricket NPL team for media, support, and partnership enquiries.'}
      />
      <main className="container">
        <section className="menu-page contact-page">
          {aboutQ.isLoading ? <Spinner label="Loading contact details…" /> : null}
          {aboutQ.isError ? (
            <ErrorNotice message="Could not load contact details. Please try again later." />
          ) : null}
          {!aboutQ.isLoading && !aboutQ.isError && !hasAnyContact ? (
            <EmptyState
              title="Contact details coming soon"
              description="Phone, email, and office information will appear here once published."
            />
          ) : null}

          {!aboutQ.isLoading && !aboutQ.isError && hasAnyContact ? (
            <div className="contact-page__content">
              <section className="contact-page__message-box">
                <h2>{sendMessageContent.heading}</h2>
                <ManagedSiteHtml html={sendMessageContent.body_html} className="muted managed-rich-text" />
                <form className="contact-page__message-form" onSubmit={(e) => void handleMessageSubmit(e)}>
                  <input
                    type="text"
                    name="website"
                    className="contact-page__honeypot"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                  />
                  <label htmlFor="contact-full-name" className="contact-page__message-label">
                    Full name
                  </label>
                  <input
                    id="contact-full-name"
                    className="contact-page__text-input"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                  />
                  <label htmlFor="contact-phone-number" className="contact-page__message-label">
                    Phone number
                  </label>
                  <input
                    id="contact-phone-number"
                    className="contact-page__text-input"
                    placeholder="Enter your phone number"
                    value={senderPhone}
                    onChange={(event) => setSenderPhone(event.target.value)}
                  />
                  <label htmlFor="contact-email-address" className="contact-page__message-label">
                    Email
                  </label>
                  <input
                    id="contact-email-address"
                    className="contact-page__text-input"
                    type="email"
                    placeholder="Enter your email address"
                    value={senderEmail}
                    onChange={(event) => setSenderEmail(event.target.value)}
                    required
                  />
                  <label htmlFor="contact-message" className="contact-page__message-label">
                    Your message
                  </label>
                  <textarea
                    id="contact-message"
                    className="contact-page__message-input"
                    placeholder="Write your enquiry here..."
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={5}
                  />
                  <button
                    type="submit"
                    className="contact-page__message-submit"
                    disabled={!isMessageReady}
                  >
                    {submitState === 'sending' ? 'Sending…' : 'Send message'}
                  </button>
                  {submitState === 'success' ? (
                    <p className="contact-page__message-note" role="status">
                      Thank you — your message has been received. We will get back to you soon.
                    </p>
                  ) : null}
                  {submitState === 'error' && submitError ? (
                    <p className="login-error contact-page__message-note" role="alert">
                      {submitError}
                      {primaryEmail ? (
                        <>
                          {' '}
                          <a href={`mailto:${primaryEmail}`}>Email us directly</a>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </form>
              </section>
              <div className="contact-page__cards-column">
                <article className="contact-page__card">
                  <h2>{emailContent.heading}</h2>
                  <ManagedSiteHtml html={emailContent.body_html} className="muted managed-rich-text" />
                  {emails.length === 0 ? <p className="muted">No email published yet.</p> : null}
                  <ul className="contact-page__list">
                    {emails.map((email) => (
                      <li key={email}>
                        <a href={`mailto:${email}`}>{email}</a>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="contact-page__card">
                  <h2>{phoneContent.heading}</h2>
                  <ManagedSiteHtml html={phoneContent.body_html} className="muted managed-rich-text" />
                  {phone ? (
                    <p className="contact-page__single">
                      <a href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a>
                    </p>
                  ) : (
                    <p className="muted">No phone number published yet.</p>
                  )}
                </article>

                <article className="contact-page__card">
                  <h2>{addressContent.heading}</h2>
                  <ManagedSiteHtml html={addressContent.body_html} className="muted managed-rich-text" />
                  {address ? (
                    <p className="contact-page__single contact-page__single--multiline">{address}</p>
                  ) : (
                    <p className="muted">No office address published yet.</p>
                  )}
                </article>

                <article className="contact-page__card contact-page__card--wide">
                  <h2>{linksContent.heading}</h2>
                  <ManagedSiteHtml html={linksContent.body_html} className="muted managed-rich-text" />
                  <div className="contact-page__links">
                    <Link to="/about-us">About us</Link>
                    <Link to="/news" search={{ q: '' }}>
                      Newsroom
                    </Link>
                    <Link to="/gallery">Gallery</Link>
                    <Link to="/fixtures">Fixtures</Link>
                  </div>
                </article>
              </div>
            </div>
          ) : null}
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
export const SearchResultsPage = () => <SearchResultsPageImpl />
export const GalleryPage = () => <GalleryPageImpl />
export const GalleryImagesPage = () => <GalleryPageImpl mediaType="image" />
export const GalleryVideoPage = () => <GalleryPageImpl mediaType="video" />
export const AboutUsPage = () => <AboutPageImpl />
export const ContactUsPage = () => <ContactUsPageImpl />
export const FixturesPage = () => <FixturesResultsPage mode="fixtures" />
export const ResultsPage = () => <FixturesResultsPage mode="results" />
export const LiveScoresPage = () => <LiveScoresPageImpl />
export const CompareTeamsPage = () => <CompareTeamsPageImpl />
