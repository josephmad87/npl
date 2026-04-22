import { Outlet } from '@tanstack/react-router'
import './App.css'
import { SiteHeader } from './SiteHeader'

export function RootLayout() {
  return (
    <div className="app-layout">
      <SiteHeader />
      <div className="app-layout-content">
        <Outlet />
      </div>
    </div>
  )
}
