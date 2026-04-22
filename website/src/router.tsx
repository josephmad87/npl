import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import App from './App'
import {
  AboutUsPage,
  FixturesPage,
  GalleryImagesPage,
  GalleryPage,
  GalleryVideoPage,
  LadiesFixturesPage,
  LadiesPage,
  LadiesResultsPage,
  LadiesTeamsPage,
  MensFixturesPage,
  MensPage,
  MensResultsPage,
  MensSeasonsPage,
  MensTeamsPage,
  NewsPage,
  ResultsPage,
  YouthFixturesPage,
  YouthPage,
  YouthResultsPage,
  YouthTeamsPage,
} from './MenuPages'
import MatchDetailPage from './MatchDetailPage'
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
const mensSeasonsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mens/seasons',
  component: MensSeasonsPage,
})
const mensTeamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mens/teams',
  component: MensTeamsPage,
})

const ladiesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/ladies', component: LadiesPage })
const ladiesFixturesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ladies/fixtures',
  component: LadiesFixturesPage,
})
const ladiesResultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ladies/results',
  component: LadiesResultsPage,
})
const ladiesTeamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ladies/teams',
  component: LadiesTeamsPage,
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

const newsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/news',
  component: NewsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === 'string' ? search.q : '',
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
  ladiesRoute,
  ladiesFixturesRoute,
  ladiesResultsRoute,
  ladiesTeamsRoute,
  youthRoute,
  youthFixturesRoute,
  youthResultsRoute,
  youthTeamsRoute,
  newsRoute,
  galleryRoute,
  galleryImagesRoute,
  galleryVideoRoute,
  aboutUsRoute,
  teamDetailRoute,
  leagueDetailRoute,
  seasonDetailRoute,
  matchDetailRoute,
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
