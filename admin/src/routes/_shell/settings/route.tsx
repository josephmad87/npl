import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_shell/settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  return (
    <div className="settings-layout">
      <Outlet />
    </div>
  )
}
