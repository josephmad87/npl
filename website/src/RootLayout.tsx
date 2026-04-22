import { Outlet } from '@tanstack/react-router'
import './App.css'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

export function RootLayout() {
  return (
    <div className="app-layout">
      <SiteHeader />
      <div className="app-layout-content">
        <Outlet />
      </div>
      <SiteFooter />
    </div>
  )
}
