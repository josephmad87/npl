import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import App from './App'
import {
  AboutUsPage,
  ContactUsPage,
  FixturesPage,
  GalleryImagesPage,
  GalleryPage,
  GalleryVideoPage,
  MensFixturesPage,
  MensPage,
  MensResultsPage,
  MensSeasonsPage,
  MensTeamsPage,
  NewsPage,
  SearchResultsPage,
  ResultsPage,
  WomenFixturesPage,
  WomenPage,
  WomenResultsPage,
  WomenSeasonsPage,
  WomenTeamsPage,
  YouthFixturesPage,
  YouthPage,
  YouthResultsPage,
  YouthSeasonsPage,
  YouthTeamsPage,
} from './MenuPages'
import MatchDetailPage from './MatchDetailPage'
import PlayerDetailPage from './PlayerDetailPage'
import { LeagueDetailPage, SeasonDetailPage, TeamDetailPage } from './EntityDetailPages'
import NewsArticlePage from './NewsArticlePage'
import { RootLayout } from './RootLayout'

const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: App,
})

const newsArticleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/news/$slug',
  component: NewsArticlePage,
})

const mensRoute = createRoute({ getParentRoute: () => rootRoute, path: '/mens', component: MensPage })
const mensFixturesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mens/fixtures',
  component: MensFixturesPage,
})
const mensResultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mens/results',
  component: MensResultsPage,
})
const seasonListSearch = (search: Record<string, unknown>) => ({
  leagueSlug: typeof search.leagueSlug === 'string' ? search.leagueSlug : '',
})

const mensSeasonsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mens/seasons',
  component: MensSeasonsPage,
  validateSearch: seasonListSearch,
})
const mensTeamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mens/teams',
  component: MensTeamsPage,
})

const ladiesToWomenRoot = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ladies',
  beforeLoad: () => {
    throw redirect({ to: '/women', replace: true })
  },
})
const ladiesToWomenFixtures = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ladies/fixtures',
  beforeLoad: () => {
    throw redirect({ to: '/women/fixtures', replace: true })
  },
})
const ladiesToWomenResults = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ladies/results',
  beforeLoad: () => {
    throw redirect({ to: '/women/results', replace: true })
  },
})
const ladiesToWomenTeams = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ladies/teams',
  beforeLoad: () => {
    throw redirect({ to: '/women/teams', replace: true })
  },
})

const womenRoute = createRoute({ getParentRoute: () => rootRoute, path: '/women', component: WomenPage })
const womenFixturesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/women/fixtures',
  component: WomenFixturesPage,
})
const womenResultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/women/results',
  component: WomenResultsPage,
})
const womenTeamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/women/teams',
  component: WomenTeamsPage,
})
const womenSeasonsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/women/seasons',
  component: WomenSeasonsPage,
  validateSearch: seasonListSearch,
})

const youthRoute = createRoute({ getParentRoute: () => rootRoute, path: '/youth', component: YouthPage })
const youthFixturesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/youth/fixtures',
  component: YouthFixturesPage,
})
const youthResultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/youth/results',
  component: YouthResultsPage,
})
const youthTeamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/youth/teams',
  component: YouthTeamsPage,
})
const youthSeasonsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/youth/seasons',
  component: YouthSeasonsPage,
  validateSearch: seasonListSearch,
})

const newsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/news',
  component: NewsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : '',
  }),
})
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: SearchResultsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : '',
    type:
      search.type === 'all' ||
      search.type === 'news' ||
      search.type === 'team' ||
      search.type === 'player' ||
      search.type === 'league'
        ? search.type
        : 'all',
  }),
})
const galleryRoute = createRoute({ getParentRoute: () => rootRoute, path: '/gallery', component: GalleryPage })
const galleryImagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery/images',
  component: GalleryImagesPage,
})
const galleryVideoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gallery/video',
  component: GalleryVideoPage,
})
const aboutUsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about-us',
  component: AboutUsPage,
})
const contactUsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/contact-us',
  component: ContactUsPage,
})
const teamDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/teams/$slug',
  component: TeamDetailPage,
})
const leagueDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leagues/$slug',
  component: LeagueDetailPage,
})
const seasonDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leagues/$leagueSlug/seasons/$seasonSlug',
  component: SeasonDetailPage,
})
const matchDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/matches/$matchId',
  component: MatchDetailPage,
})
const playerDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/players/$slug',
  component: PlayerDetailPage,
})
const fixturesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/fixtures',
  component: FixturesPage,
})
const resultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/results',
  component: ResultsPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  newsArticleRoute,
  mensRoute,
  mensFixturesRoute,
  mensResultsRoute,
  mensSeasonsRoute,
  mensTeamsRoute,
  ladiesToWomenRoot,
  ladiesToWomenFixtures,
  ladiesToWomenResults,
  ladiesToWomenTeams,
  womenRoute,
  womenFixturesRoute,
  womenResultsRoute,
  womenSeasonsRoute,
  womenTeamsRoute,
  youthRoute,
  youthFixturesRoute,
  youthResultsRoute,
  youthSeasonsRoute,
  youthTeamsRoute,
  newsRoute,
  searchRoute,
  galleryRoute,
  galleryImagesRoute,
  galleryVideoRoute,
  aboutUsRoute,
  contactUsRoute,
  teamDetailRoute,
  leagueDetailRoute,
  seasonDetailRoute,
  matchDetailRoute,
  playerDetailRoute,
  fixturesRoute,
  resultsRoute,
])

export const router = createRouter({
  routeTree,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
