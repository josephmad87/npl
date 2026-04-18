import { createFileRoute, redirect } from '@tanstack/react-router'

/** Legacy URL: profile now lives at `/profile`. */
export const Route = createFileRoute('/_shell/settings/profile')({
  beforeLoad: () => {
    throw redirect({ to: '/profile', replace: true })
  },
})
