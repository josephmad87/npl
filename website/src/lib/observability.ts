import * as Sentry from '@sentry/react'

function sampleRate(raw: string | undefined): number {
  const value = Number(raw ?? '0')
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0
}

export function initErrorMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim()
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENV?.trim() || import.meta.env.MODE,
    release: import.meta.env.VITE_APP_RELEASE?.trim() || undefined,
    sendDefaultPii: false,
    tracesSampleRate: sampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE),
  })
}
