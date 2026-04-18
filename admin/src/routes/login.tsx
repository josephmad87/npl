import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { apiFetch } from '@/lib/api'
import type { TokenResponse, UserMe } from '@/lib/api-types'
import { getSession, parseAdminRole, setSession } from '@/lib/session'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect:
      typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: () => {
    if (getSession()) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})

function safeInternalPath(redirect: string | undefined): string {
  if (!redirect) return '/'
  try {
    const u = new URL(redirect, window.location.origin)
    if (u.origin === window.location.origin && u.pathname.startsWith('/')) {
      const path = `${u.pathname}${u.search}`
      return path.length > 0 ? path : '/'
    }
  } catch {
    /* ignore */
  }
  return '/'
}

function LoginPage() {
  const router = useRouter()
  const { redirect: redirectParam } = Route.useSearch()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="app-display">NPL Admin</h1>
        {error ? <div className="login-error">{error}</div> : null}
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            if (!email.trim() || !password) {
              setError('Email and password are required.')
              return
            }
            try {
              const tokens = await apiFetch<TokenResponse>('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                  email: email.trim(),
                  password,
                }),
              })
              const me = await apiFetch<UserMe>('/auth/me', {
                accessToken: tokens.access_token,
              })
              setSession({
                email: me.email,
                name: me.full_name ?? me.email,
                role: parseAdminRole(me.role),
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
              })
              router.history.push(safeInternalPath(redirectParam))
            } catch (err: unknown) {
              const msg =
                err instanceof Error ? err.message : 'Sign-in failed.'
              setError(msg)
            }
          }}
        >
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn-primary btn--with-icon"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <LogIn size={18} strokeWidth={2} aria-hidden />
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}
