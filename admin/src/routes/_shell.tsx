import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/AppShell'
import { getSession } from '@/lib/session'

export const Route = createFileRoute('/_shell')({
  beforeLoad: ({ location }) => {
    if (!getSession()) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
  component: AppShell,
})
