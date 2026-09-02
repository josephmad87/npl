import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router'
import { RootLayout } from './RootLayout'
import { NotFoundPage } from './NotFoundPage'

const App = lazyRouteComponent(() => import('./App'))
const MatchDetailPage = lazyRouteComponent(() => import('./MatchDetailPage'))
const PlayerDetailPage = lazyRouteComponent(() => import('./PlayerDetailPage'))
const NewsArticlePage = lazyRouteComponent(() => import('./NewsArticlePage'))
const MerchandisePage = lazyRouteComponent(() => import('./MerchandisePage'))
const TeamMerchandisePage = lazyRouteComponent(
  () => import('./MerchandisePage'),
  'TeamMerchandisePage',
)
const MerchandiseProductPage = lazyRouteComponent(() => import('./MerchandiseProductPage'))
const MerchandiseOrderTrackingPage = lazyRouteComponent(() => import('./MerchandiseOrderTrackingPage'))
const SupporterAccountPage = lazyRouteComponent(() => import('./SupporterAccountPage'))

const menuPage = <TKey extends keyof typeof import('./MenuPages')>(exportName: TKey) =>
  lazyRouteComponent(() => import('./MenuPages'), exportName)
const entityPage = <TKey extends keyof typeof import('./EntityDetailPages')>(exportName: TKey) =>
  lazyRouteComponent(() => import('./EntityDetailPages'), exportName)
const legalPage = <TKey extends keyof typeof import('./LegalSupportPages')>(exportName: TKey) =>
  lazyRouteComponent(() => import('./LegalSupportPages'), exportName)

const AboutUsPage = menuPage('AboutUsPage')
const CompareTeamsPage = menuPage('CompareTeamsPage')
const ContactUsPage = menuPage('ContactUsPage')
const FixturesPage = menuPage('FixturesPage')
const LiveScoresPage = menuPage('LiveScoresPage')
const GalleryImagesPage = menuPage('GalleryImagesPage')
const GalleryPage = menuPage('GalleryPage')
const GalleryVideoPage = menuPage('GalleryVideoPage')
const MensFixturesPage = menuPage('MensFixturesPage')
const MensPage = menuPage('MensPage')
const MensResultsPage = menuPage('MensResultsPage')
const MensSeasonsPage = menuPage('MensSeasonsPage')
const MensTeamsPage = menuPage('MensTeamsPage')
const NewsPage = menuPage('NewsPage')
const SearchResultsPage = menuPage('SearchResultsPage')
const ResultsPage = menuPage('ResultsPage')
const WomenFixturesPage = menuPage('WomenFixturesPage')
const WomenPage = menuPage('WomenPage')
const WomenResultsPage = menuPage('WomenResultsPage')
const WomenSeasonsPage = menuPage('WomenSeasonsPage')
const WomenTeamsPage = menuPage('WomenTeamsPage')
const YouthFixturesPage = menuPage('YouthFixturesPage')
const YouthPage = menuPage('YouthPage')
const YouthResultsPage = menuPage('YouthResultsPage')
const YouthSeasonsPage = menuPage('YouthSeasonsPage')
const YouthTeamsPage = menuPage('YouthTeamsPage')
const LeagueDetailPage = entityPage('LeagueDetailPage')
const SeasonDetailPage = entityPage('SeasonDetailPage')
const TeamDetailPage = entityPage('TeamDetailPage')
const AccountDeletionPage = legalPage('AccountDeletionPage')
const PrivacyPage = legalPage('PrivacyPage')
const SupportPage = legalPage('SupportPage')
const TermsPage = legalPage('TermsPage')
const CompetitionInformationPage = legalPage('CompetitionInformationPage')
const SafeguardingPage = legalPage('SafeguardingPage')
const ScorecardCorrectionsPage = legalPage('ScorecardCorrectionsPage')
const SupporterInformationPage = legalPage('SupporterInformationPage')

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
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
      search.type === 'league' ||
      search.type === 'fixture' ||
      search.type === 'result'
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

const merchandiseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/merchandise',
  component: MerchandisePage,
  validateSearch: (search: Record<string, unknown>) => {
    const rawTeamId = search.team_id

    if (typeof rawTeamId === 'number' && Number.isFinite(rawTeamId)) {
      return { team_id: rawTeamId }
    }

    if (
      typeof rawTeamId === 'string' &&
      rawTeamId.trim() !== '' &&
      !Number.isNaN(Number(rawTeamId))
    ) {
      return { team_id: Number(rawTeamId) }
    }

    return {}
  },
})

const merchandiseProductRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/merchandise/$productId',
  component: MerchandiseProductPage,
})

const merchandiseOrderTrackingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/merchandise/orders/$orderNumber',
  component: MerchandiseOrderTrackingPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
})

const supporterAccountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/my-npl',
  component: SupporterAccountPage,
})

const teamMerchandiseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/merchandise/teams/$teamSlug',
  component: TeamMerchandisePage,
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
const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: PrivacyPage,
})
const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terms',
  component: TermsPage,
})
const supportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/support',
  component: SupportPage,
})
const accountDeletionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account-deletion',
  component: AccountDeletionPage,
})
const competitionInformationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/competition',
  component: CompetitionInformationPage,
})
const safeguardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/safeguarding',
  component: SafeguardingPage,
})
const scorecardCorrectionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/scorecard-corrections',
  component: ScorecardCorrectionsPage,
})
const supporterInformationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/supporters',
  component: SupporterInformationPage,
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

const matchSeoDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leagues/$leagueSlug/seasons/$seasonSlug/matches/$matchId/$matchSlug',
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
const compareTeamsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/compare-teams',
  component: CompareTeamsPage,
})
const liveScoresRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/live',
  component: LiveScoresPage,
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
  merchandiseRoute,
  merchandiseProductRoute,
  merchandiseOrderTrackingRoute,
  teamMerchandiseRoute,
  supporterAccountRoute,
  galleryImagesRoute,
  galleryVideoRoute,
  aboutUsRoute,
  contactUsRoute,
  privacyRoute,
  termsRoute,
  supportRoute,
  accountDeletionRoute,
  competitionInformationRoute,
  safeguardingRoute,
  scorecardCorrectionsRoute,
  supporterInformationRoute,
  teamDetailRoute,
  leagueDetailRoute,
  seasonDetailRoute,
  matchDetailRoute,
  matchSeoDetailRoute,
  playerDetailRoute,
  fixturesRoute,
  resultsRoute,
  liveScoresRoute,
  compareTeamsRoute,
])

export const router = createRouter({
  routeTree,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
