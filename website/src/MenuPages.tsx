import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState, useSearch } from '@tanstack/react-router'
import nplLogoUrl from './assets/logo.jpeg'
import { EmptyState } from './components/EmptyState'
import { ErrorNotice } from './components/ErrorNotice'
import { LeagueSeasonHub } from './components/LeagueSeasonHub'
import { GalleryCard } from './components/GalleryCard'
import { GalleryLightbox } from './components/GalleryLightbox'
import { MatchCard } from './components/MatchCard'
import { MatchCarousel } from './components/MatchCarousel'
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
import { extractList, fetchAllPaginatedList, fetchJson, resolveMediaUrl } from './lib/publicApi'

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
  const { data: results = [] } = useLatestResults(category, 10)
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
        <section className="home-section home-match-carousel-section home-match-carousel-section--category-results">
          {results.length > 0 ? (
            <MatchCarousel
              title="Latest Results"
              linkTo={`/${category}/results`}
              matches={results}
              teamsMap={teamsMap}
              mode="result"
            />
          ) : null}
          {results.length === 0 ? (
            <>
        <SectionHeader title="Latest Results" linkTo={`/${category}/results`} />
              <EmptyState title="No results yet" />
            </>
          ) : null}
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

const PUBLIC_LIST_PAGE_SIZE = 100

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

function FixturesResultsPage({ category, mode }: { category?: string; mode: 'fixtures' | 'results' }) {
  const endpoint = mode === 'fixtures' ? '/public/fixtures' : '/public/results'
  const { data = [], isLoading, isError } = useQuery({
    queryKey: [endpoint, 'all-pages', category ?? 'all', mode],
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
  const title = `${category ? `${formatCategoryLabel(category)} ` : ''}${mode === 'fixtures' ? 'Fixtures' : 'Results'}`
  const pageSubtitle = useMemo(() => {
    const cat = category ? formatCategoryLabel(category).toLowerCase() : null
    if (mode === 'fixtures') {
      return cat
        ? `Upcoming and scheduled ${cat} matches.`
        : 'Upcoming and scheduled matches across all competitions.'
    }
    return cat
      ? `Completed ${cat} match results and scorelines.`
      : 'Completed match results and scorelines across all competitions.'
  }, [mode, category])
  const [selectedYear, setSelectedYear] = useState('all')
  const [selectedLeague, setSelectedLeague] = useState('all')

  const yearTabs = useMemo(() => {
    const years = Array.from(new Set(data.map(resultYearLabel)))
    return years.sort((a, b) => {
      if (a === 'Unknown year') return 1
      if (b === 'Unknown year') return -1
      return Number(b) - Number(a)
    })
  }, [data])

  const leagueTabs = useMemo(() => {
    const source =
      selectedYear === 'all'
        ? data
        : data.filter((match) => resultYearLabel(match) === selectedYear)
    return Array.from(new Set(source.map(resultLeagueLabel))).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [data, selectedYear])

  const filteredResults = useMemo(() => {
    if (mode !== 'results') return data
    return data.filter((match) => {
      if (selectedYear !== 'all' && resultYearLabel(match) !== selectedYear) return false
      if (selectedLeague !== 'all' && resultLeagueLabel(match) !== selectedLeague) return false
      return true
    })
  }, [data, mode, selectedYear, selectedLeague])

  useEffect(() => {
    if (selectedYear !== 'all' && !yearTabs.includes(selectedYear)) {
      setSelectedYear('all')
    }
  }, [selectedYear, yearTabs])

  useEffect(() => {
    if (selectedLeague !== 'all' && !leagueTabs.includes(selectedLeague)) {
      setSelectedLeague('all')
    }
  }, [selectedLeague, leagueTabs])

  return (
    <>
      <PageHero variant="siteLogo" title={title} subtitle={pageSubtitle} />
    <main className="container">
        <section className="menu-page listings-page">
          {isLoading ? <Spinner label={mode === 'fixtures' ? 'Loading fixtures…' : 'Loading results…'} /> : null}
          {isError ? <ErrorNotice message={`Could not load ${mode === 'fixtures' ? 'fixtures' : 'results'}.`} /> : null}
          {!isLoading && !isError && data.length === 0 ? (
            <EmptyState
              title={mode === 'fixtures' ? 'No fixtures to show' : 'No results to show yet'}
              description={
                mode === 'fixtures'
                  ? 'Check back when the schedule is published, or browse another competition.'
                  : 'Results will appear here once matches are completed.'
              }
            />
          ) : null}
          {!isLoading && !isError && data.length > 0 ? (
            <>
            {mode === 'results' ? (
              <div className="results-tabs" aria-label="Filter results by year and league">
                <div className="results-tabs__row">
                  <span className="results-tabs__label">Year</span>
                  <div className="results-tabs__list" role="tablist" aria-label="Years">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selectedYear === 'all'}
                      className={`results-tabs__btn${selectedYear === 'all' ? ' is-active' : ''}`}
                      onClick={() => {
                        setSelectedYear('all')
                        setSelectedLeague('all')
                      }}
                    >
                      All
                    </button>
                    {yearTabs.map((year) => (
                      <button
                        key={year}
                        type="button"
                        role="tab"
                        aria-selected={selectedYear === year}
                        className={`results-tabs__btn${selectedYear === year ? ' is-active' : ''}`}
                        onClick={() => {
                          setSelectedYear(year)
                          setSelectedLeague('all')
                        }}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="results-tabs__row">
                  <span className="results-tabs__label">League</span>
                  <div className="results-tabs__list" role="tablist" aria-label="Leagues">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selectedLeague === 'all'}
                      className={`results-tabs__btn${selectedLeague === 'all' ? ' is-active' : ''}`}
                      onClick={() => setSelectedLeague('all')}
                    >
                      All
                    </button>
                    {leagueTabs.map((league) => (
                      <button
                        key={league}
                        type="button"
                        role="tab"
                        aria-selected={selectedLeague === league}
                        className={`results-tabs__btn${selectedLeague === league ? ' is-active' : ''}`}
                        onClick={() => setSelectedLeague(league)}
                      >
                        {league}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            <div
              className={
                mode === 'results'
                  ? 'home-grid home-grid--matches home-grid--results-list'
                  : 'home-grid home-grid--matches'
              }
            >
            {(mode === 'results' ? filteredResults : data).map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  teamsMap={teamsMap}
                  mode={mode === 'fixtures' ? 'fixture' : 'result'}
                />
            ))}
          </div>
          {mode === 'results' && filteredResults.length === 0 ? (
            <EmptyState title="No results for this year and league filter" />
          ) : null}
          </>
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
  const label = formatCategoryLabel(category)

  return (
    <>
      <PageHero
        variant="siteLogo"
        title={`${label} Teams`}
        subtitle="Squads, home grounds, and club profiles"
      />
    <main className="container">
        <section className="menu-page teams-page">
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
      <>
        <PageHero
          variant="siteLogo"
          title={`${formatCategoryLabel(category)} Seasons`}
          subtitle="Browse by league and season"
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
          title={`${formatCategoryLabel(category)} Seasons`}
          subtitle="Browse by league and season"
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
          title={`${formatCategoryLabel(category)} Seasons`}
          subtitle="Browse by league and season"
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
    queryFn: async () => extractList<ArticleLite>(await fetchJson<unknown>(`/public/news?page=1&page_size=20${qParam}`)),
    retry: 1,
  })

  return (
    <>
      <PageHero
        fullWidth
        title="News"
        subtitle="Match reports, features, and competition updates"
        imageUrl={resolveMediaUrl(news[0]?.featured_image_url)}
      />
    <main className="container">
        <section className="menu-page news-page">
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

function GalleryPageImpl({ mediaType }: { mediaType?: 'image' | 'video' }) {
  const filter = mediaType ? `&media_type=${mediaType}` : ''
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['gallery-page', mediaType ?? 'all'],
    queryFn: async () => extractList<GalleryItem>(await fetchJson<unknown>(`/public/gallery?page=1&page_size=40${filter}`)),
    retry: 1,
  })
  const [active, setActive] = useState<GalleryItem | null>(null)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const heroTitle = mediaType ? `${formatCategoryLabel(mediaType)}s` : 'Gallery'
  const heroSubtitle = mediaType
    ? mediaType === 'image'
      ? 'Photos from matches, events, and behind the scenes'
      : 'Match highlights and event coverage'
    : 'Photos and video from across the National Premier League'

  return (
    <>
      <PageHero variant="siteLogo" title={heroTitle} subtitle={heroSubtitle} />
    <main className="container">
        <section className="menu-page gallery-page">
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

type PublicAboutContent = {
  mission: string
  vision: string
  history: string
  team: Array<{ position?: string | null; picture_url?: string | null }>
  contacts: { emails: string[]; phone: string }
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
  className,
}: {
  title: string
  text: string
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
      <div className="about-page__story-body">
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </section>
  )
}

function AboutPageImpl() {
  const aboutQ = useQuery({
    queryKey: ['public-about'],
    queryFn: () => fetchJson<PublicAboutContent>('/public/about'),
    retry: 1,
  })

  const about = aboutQ.data

  const heroSubtitle = useMemo(() => {
    const m = about?.mission?.trim()
    if (!m) {
      return 'Mission, leadership, contact details, and official partners.'
    }
    const first = m.split(/\n\s*\n/u)[0]?.trim() ?? m
    return first.length > 200 ? `${first.slice(0, 197)}…` : first
  }, [about?.mission])

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
          title="About Zimbabwe Cricket NPL"
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
          title="About Zimbabwe Cricket NPL"
          subtitle="Official league information"
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
        title="About Zimbabwe Cricket NPL"
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
                title="Mission"
                text={about.mission}
                className="about-page__story-card--mission"
              />
              <AboutTextSection
                title="Vision"
                text={about.vision}
                className="about-page__story-card--vision"
              />
            </div>
            <div className="about-page__story-row about-page__story-row--single">
              <AboutTextSection
                title="History"
                text={about.history}
                className="about-page__story-card--history"
              />
            </div>
          </section>

          {teamMembers.length > 0 ? (
            <section className="about-page__block about-page__block--card">
              <h2 className="about-page__block-title">Leadership &amp; team</h2>
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
              <h2 className="about-page__block-title">Contact</h2>
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
                  <h3 className="about-page__address-label">Physical address</h3>
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
  const aboutQ = useQuery({
    queryKey: ['public-about'],
    queryFn: () => fetchJson<PublicAboutContent>('/public/about'),
    retry: 1,
  })
  const about = aboutQ.data
  const emails = (about?.contacts?.emails ?? []).map((e) => e.trim()).filter(Boolean)
  const phone = about?.contacts?.phone?.trim() ?? ''
  const address = about?.physical_address?.trim() ?? ''
  const hasAnyContact = emails.length > 0 || phone !== '' || address !== ''

  return (
    <>
      <PageHero
        variant="siteLogo"
        title="Contact Us"
        subtitle="Reach the Zimbabwe Cricket NPL team for media, support, and partnership enquiries."
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
            <div className="contact-page__grid">
              <article className="contact-page__card">
                <h2>Email</h2>
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
                <h2>Phone</h2>
                {phone ? (
                  <p className="contact-page__single">
                    <a href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a>
                  </p>
                ) : (
                  <p className="muted">No phone number published yet.</p>
                )}
              </article>

              <article className="contact-page__card">
                <h2>Office address</h2>
                {address ? (
                  <p className="contact-page__single contact-page__single--multiline">{address}</p>
                ) : (
                  <p className="muted">No office address published yet.</p>
                )}
              </article>

              <article className="contact-page__card contact-page__card--wide">
                <h2>Helpful links</h2>
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
export const GalleryPage = () => <GalleryPageImpl />
export const GalleryImagesPage = () => <GalleryPageImpl mediaType="image" />
export const GalleryVideoPage = () => <GalleryPageImpl mediaType="video" />
export const AboutUsPage = () => <AboutPageImpl />
export const ContactUsPage = () => <ContactUsPageImpl />
export const FixturesPage = () => <FixturesResultsPage mode="fixtures" />
export const ResultsPage = () => <FixturesResultsPage mode="results" />
