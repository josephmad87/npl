import { Check, Copy, LogIn, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { apiFetch } from '@/lib/api'
import type {
  LoginResponse,
  MfaEnrollmentConfirmOut,
  MfaEnrollmentOut,
  TokenResponse,
  UserMe,
} from '@/lib/api-types'
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

type LoginStep = 'credentials' | 'verify' | 'enroll' | 'recovery'

function LoginPage() {
  const router = useRouter()
  const { redirect: redirectParam } = Route.useSearch()
  const [step, setStep] = useState<LoginStep>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [challengeToken, setChallengeToken] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [enrollment, setEnrollment] = useState<MfaEnrollmentOut | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [pendingTokens, setPendingTokens] = useState<TokenResponse | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function completeSignIn(tokens: TokenResponse) {
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
  }

  function resetToCredentials() {
    setStep('credentials')
    setPassword('')
    setChallengeToken('')
    setVerificationCode('')
    setEnrollment(null)
    setRecoveryCodes([])
    setPendingTokens(null)
    setCopied(false)
    setError(null)
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    setBusy(true)
    try {
      const result = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      })
      setChallengeToken(result.challenge_token)
      setPassword('')
      if (result.status === 'mfa_required') {
        setStep('verify')
        return
      }
      const setup = await apiFetch<MfaEnrollmentOut>('/auth/mfa/enroll', {
        method: 'POST',
        body: JSON.stringify({ challenge_token: result.challenge_token }),
      })
      setEnrollment(setup)
      setStep('enroll')
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  async function submitVerification(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!verificationCode.trim()) {
      setError('Enter an authenticator or recovery code.')
      return
    }
    setBusy(true)
    try {
      const tokens = await apiFetch<TokenResponse>('/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({
          challenge_token: challengeToken,
          code: verificationCode.trim(),
        }),
      })
      await completeSignIn(tokens)
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Verification failed.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmEnrollment(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (verificationCode.trim().length !== 6) {
      setError('Enter the six-digit code from your authenticator app.')
      return
    }
    setBusy(true)
    try {
      const result = await apiFetch<MfaEnrollmentConfirmOut>(
        '/auth/mfa/confirm-enrollment',
        {
          method: 'POST',
          body: JSON.stringify({
            challenge_token: challengeToken,
            code: verificationCode.trim(),
          }),
        },
      )
      setPendingTokens(result.tokens)
      setRecoveryCodes(result.recovery_codes)
      setVerificationCode('')
      setStep('recovery')
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not enable MFA.')
    } finally {
      setBusy(false)
    }
  }

  async function copyRecoveryCodes() {
    await navigator.clipboard.writeText(recoveryCodes.join('\n'))
    setCopied(true)
  }

  const wideCard = step === 'enroll' || step === 'recovery'

  return (
    <main id="main-content" className="login-page" tabIndex={-1}>
      <div className={`login-card${wideCard ? ' login-card--wide' : ''}`}>
        <h1 className="app-display">NPL Admin</h1>

        {step === 'credentials' ? (
          <>
            <p>Sign in to continue to the NPL administration portal.</p>
            {error ? <div className="login-error">{error}</div> : null}
            <form onSubmit={(e) => void submitCredentials(e)}>
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
                disabled={busy}
              >
                <LogIn size={18} strokeWidth={2} aria-hidden />
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </>
        ) : null}

        {step === 'verify' ? (
          <>
            <div className="mfa-login__heading">
              <ShieldCheck size={24} aria-hidden />
              <div>
                <h2>Two-factor verification</h2>
                <p>Enter the current code from your authenticator app or one recovery code.</p>
              </div>
            </div>
            {error ? <div className="login-error">{error}</div> : null}
            <form onSubmit={(e) => void submitVerification(e)}>
              <div className="field">
                <label htmlFor="mfa_code">Authenticator or recovery code</label>
                <input
                  id="mfa_code"
                  autoComplete="one-time-code"
                  autoFocus
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="btn-primary btn--with-icon"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={busy}
              >
                <ShieldCheck size={18} aria-hidden />
                {busy ? 'Verifying…' : 'Verify and sign in'}
              </button>
              <button type="button" className="mfa-login__back" onClick={resetToCredentials}>
                Back to password sign-in
              </button>
            </form>
          </>
        ) : null}

        {step === 'enroll' && enrollment ? (
          <>
            <div className="mfa-login__heading">
              <ShieldCheck size={24} aria-hidden />
              <div>
                <h2>Protect your account</h2>
                <p>MFA is required for every NPL administrator.</p>
              </div>
            </div>
            <div className="mfa-enrollment">
              <img src={enrollment.qr_data_uri} alt="Authenticator setup QR code" />
              <div>
                <ol>
                  <li>Open an authenticator app on your phone.</li>
                  <li>Scan this QR code or enter the setup key below.</li>
                  <li>Enter the six-digit code generated by the app.</li>
                </ol>
                <span className="mfa-enrollment__label">Manual setup key</span>
                <code className="mfa-enrollment__secret">{enrollment.secret}</code>
              </div>
            </div>
            {error ? <div className="login-error">{error}</div> : null}
            <form onSubmit={(e) => void confirmEnrollment(e)}>
              <div className="field">
                <label htmlFor="enrollment_code">Six-digit code</label>
                <input
                  id="enrollment_code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <button
                type="submit"
                className="btn-primary btn--with-icon"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={busy}
              >
                <ShieldCheck size={18} aria-hidden />
                {busy ? 'Enabling…' : 'Enable MFA'}
              </button>
              <button type="button" className="mfa-login__back" onClick={resetToCredentials}>
                Cancel
              </button>
            </form>
          </>
        ) : null}

        {step === 'recovery' && pendingTokens ? (
          <>
            <div className="mfa-login__heading">
              <ShieldCheck size={24} aria-hidden />
              <div>
                <h2>MFA is enabled</h2>
                <p>Save these recovery codes before continuing. Each code works once.</p>
              </div>
            </div>
            <div className="mfa-recovery-codes" aria-label="MFA recovery codes">
              {recoveryCodes.map((code) => (
                <code key={code}>{code}</code>
              ))}
            </div>
            <button
              type="button"
              className="btn-ghost btn--with-icon mfa-recovery-codes__copy"
              onClick={() => void copyRecoveryCodes()}
            >
              {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
              {copied ? 'Copied' : 'Copy recovery codes'}
            </button>
            <button
              type="button"
              className="btn-primary btn--with-icon"
              style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
              onClick={() => void completeSignIn(pendingTokens)}
            >
              <LogIn size={18} aria-hidden />
              I saved the codes — continue
            </button>
          </>
        ) : null}
      </div>
    </main>
  )
}
