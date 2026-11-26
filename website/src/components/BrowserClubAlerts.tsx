import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchJson } from '../lib/publicApi'
import { supporterFetch } from '../lib/supporterApi'

const key = 'npl-browser-alert-device'
type Registration = { id: number; account: number }
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function savedDevice(): Registration | null {
  try { return JSON.parse(localStorage.getItem(key) || 'null') as Registration | null }
  catch { return null }
}

export async function stopBrowserClubAlerts(account?: number) {
  if (!supported()) return
  const device = savedDevice()
  const worker = await navigator.serviceWorker.getRegistration('/')
  const subscription = await worker?.pushManager.getSubscription()
  await subscription?.unsubscribe()
  localStorage.removeItem(key)
  if (device && (!account || device.account === account)) {
    await supporterFetch('/supporters/devices/' + device.id, { method: 'DELETE' }).catch(() => undefined)
  }
}

function vapidKey(key: string) {
  const base64 = key.replaceAll('-', '+').replaceAll('_', '/')
  return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), c => c.charCodeAt(0))
}

export function BrowserClubAlerts({ account, consent }: { account: number; consent: boolean }) {
  const queryClient = useQueryClient()
  const [registration, setRegistration] = useState(() => savedDevice()?.account === account ? savedDevice()?.id : undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const settings = useQuery({
    queryKey: ['match-alert-settings'],
    queryFn: () => fetchJson<{ web_public_key: string | null }>('/supporters/device-settings'),
    enabled: supported(),
  })
  const publicKey = settings.data?.web_public_key
  const worker = useQuery({
    queryKey: ['npl-web-push-worker'],
    queryFn: async () => {
      await navigator.serviceWorker.register('/npl-club-alerts.js', { scope: '/' })
      return navigator.serviceWorker.ready
    },
    enabled: Boolean(publicKey),
    staleTime: Infinity,
  })
  const devices = useQuery({
    queryKey: ['supporter', 'device-list', account],
    queryFn: () => supporterFetch<{ id: number }[]>('/supporters/devices'),
    enabled: Boolean(publicKey && registration),
  })
  const enabled = consent && devices.data?.some(device => device.id === registration)

  async function toggle() {
    if (busy || !publicKey || !worker.data) return
    setBusy(true)
    setError('')
    try {
      if (enabled) {
        await stopBrowserClubAlerts(account)
        setRegistration(undefined)
      } else {
        if (await Notification.requestPermission() !== 'granted') {
          throw new Error('Allow NPL notifications in your browser settings, then try again.')
        }
        const subscription = await worker.data.pushManager.getSubscription()
          ?? await worker.data.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey(publicKey) })
        try {
          if (!consent) {
            await supporterFetch('/supporters/me', { method: 'PATCH', body: JSON.stringify({ push_consent: true }) })
          }
          const device = await supporterFetch<{ id: number }>('/supporters/devices', {
            method: 'POST', body: JSON.stringify({ provider: 'web', platform: 'web', device_token: JSON.stringify(subscription.toJSON()) }),
          })
          localStorage.setItem(key, JSON.stringify({ id: device.id, account }))
          setRegistration(device.id)
        } catch (cause) {
          await subscription.unsubscribe()
          throw cause
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['supporter', 'device-list', account] }),
        queryClient.invalidateQueries({ queryKey: ['supporter', 'me'] }),
      ])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update browser alerts.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="supporter-browser-alerts">
    <h3>Browser alerts</h3>
    {!supported() ? <p className="muted">Use a supported browser or add NPL to your iPhone Home Screen to receive alerts.</p>
      : publicKey ? <button type="button" disabled={busy || !worker.data || devices.isLoading} onClick={() => void toggle()}>
        {enabled ? 'Turn off alerts in this browser' : 'Enable alerts in this browser'}
      </button> : settings.isLoading ? null : <p className="muted">Browser alerts are currently unavailable.</p>}
    {worker.isError || error ? <p role="alert" className="form-error">{error || 'Could not set up browser notifications.'}</p> : null}
  </div>
}
