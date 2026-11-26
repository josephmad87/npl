self.addEventListener('push', event => {
  let payload
  try { payload = event.data?.json() } catch { return }
  const match = payload?.data?.match_id
  if (!Number.isSafeInteger(match) || match <= 0 || typeof payload.title !== 'string') return
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: typeof payload.body === 'string' ? payload.body : '',
    icon: '/apple-touch-icon.png',
    tag: 'npl-alert-' + payload.id,
    data: { match },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const match = event.notification.data?.match
  if (!Number.isSafeInteger(match) || match <= 0) return
  const url = new URL('/matches/' + match, self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = windows.find(client => client.url === url)
    if (open) return open.focus()
    return self.clients.openWindow(url)
  })())
})
