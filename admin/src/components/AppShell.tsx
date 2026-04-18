import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import nplLogoUrl from '@/assets/logo.jpeg'
import { adminRouteIconForPath } from '@/lib/adminRouteIcons'
import { NAV_ITEMS, navVisibleForRole } from '@/lib/nav'
import { clearSession, getSession, roleLabel } from '@/lib/session'

const SIDEBAR_COLLAPSED_KEY = 'npl-admin-sidebar-collapsed'
const MOBILE_MQ = '(max-width: 900px)'

function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function AppShell() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const session = getSession()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof window !== 'undefined' ? readSidebarCollapsed() : false,
  )
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const sync = () => {
      setIsMobile(mq.matches)
      if (!mq.matches) setMobileNavOpen(false)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!isMobile || !mobileNavOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isMobile, mobileNavOpen])

  useEffect(() => {
    if (!isMobile || !mobileNavOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMobile, mobileNavOpen])

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((c) => {
      const next = !c
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), [])

  const shellClass = [
    'app-shell',
    sidebarCollapsed && !isMobile ? 'app-shell--sidebar-collapsed' : '',
    isMobile && mobileNavOpen ? 'app-shell--mobile-nav-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClass}>
      {isMobile && mobileNavOpen ? (
        <button
          type="button"
          className="app-shell__backdrop"
          aria-label="Close navigation menu"
          onClick={closeMobileNav}
        />
      ) : null}
      <aside
        id="app-shell-sidebar"
        className="app-shell__sidebar"
        aria-label="Main navigation"
      >
        <div className="app-shell__brand">
          <Link
            to="/"
            className="app-shell__brand-logo-card"
            aria-label="NPL Admin home"
            onClick={closeMobileNav}
          >
            <img src={nplLogoUrl} alt="" decoding="async" />
          </Link>
          <div className="app-shell__brand-text">
            <div className="app-shell__brand-title app-display">NPL Admin</div>
          </div>
        </div>
        <nav
          id="app-shell-nav-modules"
          className="app-shell__nav"
          aria-label="Modules"
        >
          {NAV_ITEMS.filter((item) =>
            navVisibleForRole(item, session?.role),
          ).map((item) => {
            const active =
              item.to === '/'
                ? pathname === '/'
                : pathname === item.to || pathname.startsWith(`${item.to}/`)
            const Icon = adminRouteIconForPath(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                data-active={active}
                title={item.label}
                onClick={closeMobileNav}
              >
                <Icon
                  className="app-shell__nav-icon"
                  size={20}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="app-shell__nav-text" aria-hidden="true">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>
        {!isMobile ? (
          <div className="app-shell__sidebar-footer">
            <button
              type="button"
              className="app-shell__sidebar-toggle btn--with-icon"
              onClick={toggleSidebarCollapsed}
              aria-expanded={!sidebarCollapsed}
              aria-controls="app-shell-sidebar"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen size={18} strokeWidth={2} aria-hidden />
              ) : (
                <PanelLeftClose size={18} strokeWidth={2} aria-hidden />
              )}
              <span className="app-shell__sidebar-toggle-label">
                {sidebarCollapsed ? 'Expand' : 'Collapse'}
              </span>
            </button>
            <div className="app-shell__api-hint muted">
              API:{' '}
              <code style={{ color: 'var(--text-muted)' }}>/api/v1</code>
            </div>
          </div>
        ) : (
          <div className="app-shell__api-hint muted app-shell__api-hint--mobile">
            API: <code style={{ color: 'var(--text-muted)' }}>/api/v1</code>
          </div>
        )}
      </aside>
      <div className="app-shell__main">
        <header className="app-shell__header">
          <div className="app-shell__header-leading">
            {isMobile ? (
              <button
                type="button"
                className="app-shell__menu-btn"
                aria-expanded={mobileNavOpen}
                aria-controls="app-shell-sidebar"
                onClick={() => setMobileNavOpen((o) => !o)}
              >
                <Menu size={22} strokeWidth={2} aria-hidden />
                <span className="visually-hidden">Menu</span>
              </button>
            ) : null}
            <div className="app-shell__header-title app-display">
              Operations console
            </div>
          </div>
          <div className="app-shell__header-actions">
            {session ? (
              <>
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  {session.name}
                  <span style={{ margin: '0 0.35rem', opacity: 0.5 }}>·</span>
                  {session.email}
                </span>
                <span className="badge badge--role">{roleLabel(session.role)}</span>
                <button
                  type="button"
                  className="btn-ghost btn--with-icon"
                  onClick={() => {
                    clearSession()
                    void navigate({
                      to: '/login',
                      search: { redirect: undefined },
                    })
                  }}
                >
                  <LogOut size={18} strokeWidth={2} aria-hidden />
                  Sign out
                </button>
              </>
            ) : null}
          </div>
        </header>
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
