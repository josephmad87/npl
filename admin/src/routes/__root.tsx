import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

export type AppRouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: () => <Outlet />,
})
