import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Loader2, Save } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { PlatformSettingsDto } from '@/lib/api-types'
import { ApiError } from '@/lib/api'
import { adminGet, adminPatch } from '@/lib/admin-client'
import { PageHeader } from '@/components/PageHeader'
import { SectionHintTip } from '@/components/SectionHintTip'
import { getSession } from '@/lib/session'

export const Route = createFileRoute('/_shell/settings/')({
  beforeLoad: () => {
    if (getSession()?.role !== 'super_admin') {
      throw redirect({ to: '/profile' })
    }
  },
  component: PlatformSettingsPage,
})

function parseFeatureFlagsJson(raw: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new SyntaxError('Feature flags must be valid JSON.')
  }
  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    throw new Error('Feature flags must be a JSON object (e.g. {"enableBeta": false}).')
  }
  return parsed as Record<string, unknown>
}

function parseNotificationHooksJson(raw: string): PlatformSettingsDto['notification_hooks'] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new SyntaxError('Notification hooks must be valid JSON.')
  }
  if (!Array.isArray(parsed)) {
    throw new TypeError(
      'Notification hooks must be a JSON array of { "name", "url" } objects.',
    )
  }
  const out: PlatformSettingsDto['notification_hooks'] = []
  for (const item of parsed) {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof (item as { name?: unknown }).name !== 'string' ||
      typeof (item as { url?: unknown }).url !== 'string'
    ) {
      throw new Error('Each hook must be an object with string "name" and "url".')
    }
    const name = (item as { name: string }).name.trim()
    const url = (item as { url: string }).url.trim()
    if (!name || !url) {
      throw new Error('Each hook must have non-empty name and url.')
    }
    out.push({ name, url })
  }
  return out
}

function PlatformSettingsPage() {
  const queryClient = useQueryClient()
  const q = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminGet<PlatformSettingsDto>('/admin/settings'),
    refetchOnWindowFocus: false,
  })

  const [siteName, setSiteName] = useState('')
  const [defaultSeason, setDefaultSeason] = useState('')
  const [cdnUrl, setCdnUrl] = useState('')
  const [flagsJson, setFlagsJson] = useState('{}')
  const [hooksJson, setHooksJson] = useState('[]')
  const [formError, setFormError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState<string | null>(null)

  useEffect(() => {
    if (!q.data) return
    setSiteName(q.data.site_name)
    setDefaultSeason(q.data.default_season)
    setCdnUrl(q.data.media_cdn_base_url)
    setFlagsJson(JSON.stringify(q.data.feature_flags ?? {}, null, 2))
    setHooksJson(JSON.stringify(q.data.notification_hooks ?? [], null, 2))
  }, [q.data])

  const saveMutation = useMutation({
    mutationFn: (body: Omit<PlatformSettingsDto, 'updated_at'>) =>
      adminPatch<PlatformSettingsDto>('/admin/settings', body),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin', 'settings'], data)
      setSiteName(data.site_name)
      setDefaultSeason(data.default_season)
      setCdnUrl(data.media_cdn_base_url)
      setFlagsJson(JSON.stringify(data.feature_flags ?? {}, null, 2))
      setHooksJson(JSON.stringify(data.notification_hooks ?? [], null, 2))
      setFormError(null)
      setSavedFlash(`Saved at ${new Date().toLocaleString()}`)
    },
    onError: (e: unknown) => {
      setSavedFlash(null)
      if (e instanceof ApiError) {
        setFormError(e.message)
        return
      }
      setFormError(e instanceof Error ? e.message : 'Save failed')
    },
  })

  function handleSave() {
    setFormError(null)
    setSavedFlash(null)
    let feature_flags: Record<string, unknown>
    let notification_hooks: PlatformSettingsDto['notification_hooks']
    try {
      feature_flags = parseFeatureFlagsJson(flagsJson)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Invalid feature flags JSON')
      return
    }
    try {
      notification_hooks = parseNotificationHooksJson(hooksJson)
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : 'Invalid notification hooks JSON',
      )
      return
    }
    saveMutation.mutate({
      site_name: siteName.trim(),
      default_season: defaultSeason.trim(),
      media_cdn_base_url: cdnUrl.trim(),
      feature_flags,
      notification_hooks,
    })
  }

  let panelBody: ReactNode
  if (q.isLoading) {
    panelBody = <p className="muted settings-panel__intro">Loading settings…</p>
  } else if (q.isError) {
    panelBody = (
      <p className="login-error settings-panel__intro">{q.error.message}</p>
    )
  } else {
    panelBody = (
      <>
        {q.data ? (
          <p className="settings-form__meta">
            Last updated on server:{' '}
            {new Date(q.data.updated_at).toLocaleString()}
          </p>
        ) : null}

        <form
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
        >
          <div className="settings-form__group">
            <label
              className="settings-form__label settings-form__label--with-tip"
              htmlFor="site_name"
            >
              <span>Site name</span>
              <SectionHintTip ariaHelp="Public site and email branding (e.g. National Premier League).">
                <span className="section-hint-tip__text">
                  Public site and email branding (e.g. National Premier League).
                </span>
              </SectionHintTip>
            </label>
            <input
              id="site_name"
              className="inline-edit__control"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              maxLength={200}
              autoComplete="organization"
            />
          </div>

          <div className="settings-form__group">
            <label
              className="settings-form__label settings-form__label--with-tip"
              htmlFor="default_season"
            >
              <span>Default season</span>
              <SectionHintTip ariaHelp="Season label or slug the product should prefer when none is selected (consumed by schedulers and links when implemented).">
                <span className="section-hint-tip__text">
                  Season label or slug the product should prefer when none is
                  selected (consumed by schedulers and links when implemented).
                </span>
              </SectionHintTip>
            </label>
            <input
              id="default_season"
              className="inline-edit__control"
              value={defaultSeason}
              onChange={(e) => setDefaultSeason(e.target.value)}
              maxLength={120}
              placeholder="e.g. 2025/26 or season slug"
            />
          </div>

          <div className="settings-form__group">
            <label
              className="settings-form__label settings-form__label--with-tip"
              htmlFor="media_cdn"
            >
              <span>Media CDN base URL</span>
              <SectionHintTip ariaHelp="Prefix for resolving gallery and article imagery; no trailing slash required.">
                <span className="section-hint-tip__text">
                  Prefix for resolving gallery and article imagery; no trailing
                  slash required.
                </span>
              </SectionHintTip>
            </label>
            <input
              id="media_cdn"
              className="inline-edit__control"
              value={cdnUrl}
              onChange={(e) => setCdnUrl(e.target.value)}
              maxLength={1000}
              placeholder="https://cdn.example.com"
              inputMode="url"
            />
          </div>

          <div className="settings-form__group">
            <label
              className="settings-form__label settings-form__label--with-tip"
              htmlFor="feature_flags"
            >
              <span>Feature flags</span>
              <SectionHintTip ariaHelp='JSON object of string keys to boolean, number, or string values (e.g. {"enableLiveScores": true}).'>
                <span className="section-hint-tip__text">
                  JSON object of string keys to boolean, number, or string values
                  (e.g. <code>{`{"enableLiveScores": true}`}</code>).
                </span>
              </SectionHintTip>
            </label>
            <textarea
              id="feature_flags"
              className="inline-edit__control"
              rows={6}
              value={flagsJson}
              onChange={(e) => setFlagsJson(e.target.value)}
              spellCheck={false}
            />
          </div>

          <div className="settings-form__group">
            <label
              className="settings-form__label settings-form__label--with-tip"
              htmlFor="notification_hooks"
            >
              <span>Notification hooks</span>
              <SectionHintTip ariaHelp='JSON array of objects with "name" and "url" (e.g. Slack incoming webhooks or custom HTTPS endpoints).'>
                <span className="section-hint-tip__text">
                  JSON array of objects with <code>name</code> and{' '}
                  <code>url</code> (e.g. Slack incoming webhooks or custom HTTPS
                  endpoints).
                </span>
              </SectionHintTip>
            </label>
            <textarea
              id="notification_hooks"
              className="inline-edit__control"
              rows={8}
              value={hooksJson}
              onChange={(e) => setHooksJson(e.target.value)}
              spellCheck={false}
            />
          </div>

          {formError ? (
            <p className="settings-form__error">{formError}</p>
          ) : null}
          {savedFlash ? (
            <p className="settings-panel__saved">{savedFlash}</p>
          ) : null}

          <div className="settings-form__actions">
            <button
              type="submit"
              className="btn-primary btn--with-icon"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2
                  size={18}
                  strokeWidth={2}
                  className="npl-icon-spin"
                  aria-hidden
                />
              ) : (
                <Save size={18} strokeWidth={2} aria-hidden />
              )}
              {saveMutation.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Platform settings"
        descriptionAsTooltip
        description="Super-admin configuration stored in the database (GET/PATCH /admin/settings). Feature flags and hooks are edited as JSON for flexibility. These values apply across the admin console and public surfaces once wired into templates and jobs. Empty CDN is allowed until you ship assets to a CDN."
      />
      <div className="settings-panel">{panelBody}</div>
    </>
  )
}
