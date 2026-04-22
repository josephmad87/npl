import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import App from './App'
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

const routeTree = rootRoute.addChildren([indexRoute, newsArticleRoute])

export const router = createRouter({
  routeTree,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
