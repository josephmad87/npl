import { useEffect } from 'react'
import { router, useRootNavigationState } from 'expo-router'
import type { NotificationResponse } from 'expo-notifications'
import { nativeHref } from './app-link'
import { loadNotifications, supportsPhoneAlerts } from '../lib/club-alerts'
import { supporterRequest } from '../lib/supporter-account'

export function NotificationLinks() {
  const ready = Boolean(useRootNavigationState()?.key)
  useEffect(() => {
    if (!ready || !supportsPhoneAlerts) return
    let mounted = true
    let unsubscribe: (() => void) | undefined
    void loadNotifications().then(notifications => {
      if (!mounted) return
      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
        }),
      })
      const open = (response: NotificationResponse) => {
        if (response.actionIdentifier !== notifications.DEFAULT_ACTION_IDENTIFIER) return
        const { match_id: matchId, notification_id: notificationId } = response.notification.request.content.data || {}
        if (typeof matchId !== 'number' || !Number.isSafeInteger(matchId) || matchId <= 0) return
        notifications.clearLastNotificationResponse()
        router.push(nativeHref('/matches/' + matchId))
        if (typeof notificationId === 'number' && Number.isSafeInteger(notificationId) && notificationId > 0) {
          void supporterRequest('/notifications/' + notificationId + '/read', { method: 'POST' }).catch(() => undefined)
        }
      }
      const subscription = notifications.addNotificationResponseReceivedListener(open)
      unsubscribe = () => subscription.remove()
      const pending = notifications.getLastNotificationResponse()
      if (pending) open(pending)
    }).catch(() => undefined)
    return () => { mounted = false; unsubscribe?.() }
  }, [ready])
  return null
}
