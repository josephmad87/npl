import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  setSupporterAnalyticsConsent,
  setSupporterSession,
  supporterFetch,
  supporterLogin,
  supporterRegister,
  useSupporterSession,
} from './lib/supporterApi'
import { SeoHead } from './components/SeoHead'
import { managedSection, useSitePageContent } from './lib/siteContent'
import { ManagedSiteHtml } from './components/ManagedSiteHtml'

type Account = {
  id: number
  email: string
  display_name: string
  marketing_consent: boolean
  push_consent: boolean
  analytics_consent: boolean
}
type Follow = { id: number; name: string; slug: string; image_url: string | null }
type Follows = { teams: Follow[]; players: Follow[] }
type Notification = { id: number; match_id: number | null; title: string; body: string; read_at: string | null; created_at: string }
type Page<T> = { items: T[] }
type Order = { id: number; order_number: string; product_name: string; status: string; payment_status: string; created_at: string }

function AuthPanel({ title, subtitle }: { title: string; subtitle: string }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [push, setPush] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      if (mode === 'login') await supporterLogin(email.trim(), password)
      else {
        await supporterRegister({
          email: email.trim(), password, display_name: displayName.trim(), accept_terms: acceptTerms,
          accept_privacy: acceptPrivacy, policy_version: '2026-09', marketing_consent: marketing,
          push_consent: push, analytics_consent: analytics,
        })
        setSupporterAnalyticsConsent(analytics)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="supporter-auth-card">
      <div className="supporter-auth-card__tabs" role="tablist" aria-label="Supporter account">
        <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>Sign in</button>
        <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => setMode('register')}>Register</button>
      </div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div className="supporter-form">
        {mode === 'register' ? <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" /></label> : null}
        <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
        <label>Password<input type="password" minLength={mode === 'register' ? 12 : 1} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></label>
        {mode === 'register' ? <>
          <label className="supporter-form__check"><input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} /><span>I accept the <Link to="/terms">Terms</Link>.</span></label>
          <label className="supporter-form__check"><input type="checkbox" checked={acceptPrivacy} onChange={(event) => setAcceptPrivacy(event.target.checked)} /><span>I have read the <Link to="/privacy">Privacy Policy</Link>.</span></label>
          <label className="supporter-form__check"><input type="checkbox" checked={push} onChange={(event) => setPush(event.target.checked)} /><span>Send team match reminders and results.</span></label>
          <label className="supporter-form__check"><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} /><span>Send optional NPL news and offers.</span></label>
          <label className="supporter-form__check"><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} /><span>Allow consent-based engagement analytics.</span></label>
        </> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button type="button" className="hero-readmore-btn" onClick={() => void submit()} disabled={busy || !email || !password || (mode === 'register' && (!displayName || !acceptTerms || !acceptPrivacy))}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </div>
    </section>
  )
}

export default function SupporterAccountPage() {
  const session = useSupporterSession()
  const contentQ = useSitePageContent('my-npl')
  const queryClient = useQueryClient()
  const accountQ = useQuery({ queryKey: ['supporter', 'me'], queryFn: () => supporterFetch<Account>('/supporters/me'), enabled: Boolean(session) })
  const followsQ = useQuery({ queryKey: ['supporter', 'follows'], queryFn: () => supporterFetch<Follows>('/supporters/follows'), enabled: Boolean(session) })
  const notificationsQ = useQuery({ queryKey: ['supporter', 'notifications'], queryFn: () => supporterFetch<Page<Notification>>('/supporters/notifications?page_size=50'), enabled: Boolean(session) })
  const ordersQ = useQuery({ queryKey: ['supporter', 'orders'], queryFn: () => supporterFetch<Order[]>('/supporters/orders'), enabled: Boolean(session) })
  const account = accountQ.data
  const unread = useMemo(() => notificationsQ.data?.items.filter((item) => !item.read_at) ?? [], [notificationsQ.data])
  const pageTitle = contentQ.data?.title || 'My NPL'
  const pageSubtitle = contentQ.data?.subtitle || 'Follow teams and players, receive match alerts, vote, and see your orders.'
  const preferencesContent = managedSection(contentQ.data, 'preferences', 'Notification and Consent Choices')
  const followingContent = managedSection(contentQ.data, 'following', 'Following')
  const notificationsContent = managedSection(contentQ.data, 'notifications', 'Notifications')
  const ordersContent = managedSection(contentQ.data, 'orders', 'Your Merchandise Orders')
  const closeAccountContent = managedSection(contentQ.data, 'close-account', 'Close Account')

  useEffect(() => {
    if (account) setSupporterAnalyticsConsent(account.analytics_consent)
  }, [account])

  const setPreference = async (field: 'marketing_consent' | 'push_consent' | 'analytics_consent', value: boolean) => {
    const updated = await supporterFetch<Account>('/supporters/me', { method: 'PATCH', body: JSON.stringify({ [field]: value }) })
    if (field === 'analytics_consent') setSupporterAnalyticsConsent(updated.analytics_consent)
    await queryClient.invalidateQueries({ queryKey: ['supporter', 'me'] })
  }
  const markRead = async (id: number) => {
    await supporterFetch(`/supporters/notifications/${id}/read`, { method: 'POST' })
    const { recordFanEngagement } = await import('./lib/supporterApi')
    recordFanEngagement('notification_open', 'notification', id)
    await queryClient.invalidateQueries({ queryKey: ['supporter', 'notifications'] })
  }
  const removeFollow = async (kind: 'team' | 'player', id: number) => {
    await supporterFetch(`/supporters/follows/${kind}s/${id}`, { method: 'DELETE' })
    await queryClient.invalidateQueries({ queryKey: ['supporter', 'follows'] })
  }

  return <main className="container supporter-account-page">
    <SeoHead title={pageTitle} description={pageSubtitle} canonicalPath="/my-npl" noIndex />
    {!session ? <AuthPanel title={pageTitle} subtitle={pageSubtitle} /> : accountQ.isLoading ? <p>Loading your supporter account…</p> : accountQ.isError || !account ? <section><h1>{pageTitle}</h1><p className="form-error">Could not load your account.</p><button type="button" onClick={() => setSupporterSession(null)}>Sign out</button></section> : <>
      <header className="supporter-account-page__head"><div><p className="eyebrow">Supporter account</p><h1>{pageTitle}</h1><p>Welcome, {account.display_name} · {account.email}</p></div><button type="button" className="supporter-link-button" onClick={() => setSupporterSession(null)}>Sign out</button></header>
      <div className="supporter-dashboard">
        <section className="supporter-dashboard__card"><h2>{preferencesContent.heading}</h2><ManagedSiteHtml html={preferencesContent.body_html} /><label className="supporter-form__check"><input type="checkbox" checked={account.push_consent} onChange={(event) => void setPreference('push_consent', event.target.checked)} /><span>Match reminders 24 hours and one hour before, plus results</span></label><label className="supporter-form__check"><input type="checkbox" checked={account.marketing_consent} onChange={(event) => void setPreference('marketing_consent', event.target.checked)} /><span>NPL news and supporter offers</span></label><label className="supporter-form__check"><input type="checkbox" checked={account.analytics_consent} onChange={(event) => void setPreference('analytics_consent', event.target.checked)} /><span>Consent-based engagement analytics</span></label><p className="muted">You can change these at any time. The mobile apps register their push device only when match alerts are enabled.</p></section>
        <section className="supporter-dashboard__card"><h2>{followingContent.heading}</h2><ManagedSiteHtml html={followingContent.body_html} /><h3>Teams</h3>{followsQ.data?.teams.length ? <ul>{followsQ.data.teams.map((item) => <li key={item.id}><Link to="/teams/$slug" params={{ slug: item.slug }}>{item.name}</Link><button type="button" onClick={() => void removeFollow('team', item.id)}>Unfollow</button></li>)}</ul> : <p className="muted">No teams followed yet.</p>}<h3>Players</h3>{followsQ.data?.players.length ? <ul>{followsQ.data.players.map((item) => <li key={item.id}><Link to="/players/$slug" params={{ slug: item.slug }}>{item.name}</Link><button type="button" onClick={() => void removeFollow('player', item.id)}>Unfollow</button></li>)}</ul> : <p className="muted">No players followed yet.</p>}</section>
        <section className="supporter-dashboard__card"><h2>{notificationsContent.heading} {unread.length ? <span className="supporter-count">{unread.length} new</span> : null}</h2><ManagedSiteHtml html={notificationsContent.body_html} />{notificationsQ.data?.items.length ? <ul>{notificationsQ.data.items.map((item) => <li key={item.id} className={item.read_at ? '' : 'is-unread'}><div><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></div>{!item.read_at ? <button type="button" onClick={() => void markRead(item.id)}>Mark read</button> : null}</li>)}</ul> : <p className="muted">No notifications yet.</p>}</section>
        <section className="supporter-dashboard__card"><h2>{ordersContent.heading}</h2><ManagedSiteHtml html={ordersContent.body_html} />{ordersQ.data?.length ? <ul>{ordersQ.data.map((order) => <li key={order.id}><div><strong>{order.order_number}</strong><p>{order.product_name}</p></div><span>{order.status.replaceAll('_', ' ')} · {order.payment_status}</span></li>)}</ul> : <p className="muted">No account-linked orders yet.</p>}</section>
      </div>
      <section className="supporter-danger-zone"><h2>{closeAccountContent.heading}</h2><ManagedSiteHtml html={closeAccountContent.body_html} /><button type="button" className="supporter-link-button" onClick={() => { if (globalThis.confirm('Close and anonymise your My NPL account?')) void supporterFetch('/supporters/me', { method: 'DELETE' }).then(() => setSupporterSession(null)) }}>Close my account</button></section>
    </>}
  </main>
}
