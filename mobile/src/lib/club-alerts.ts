import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import { supporterRequest, SupporterError } from './supporter-account'

type Notifications = typeof import('expo-notifications')
type Registration = { id: number; accountId: number }
const storage = 'npl.supporter.alert-device'
const channel = 'match-alerts'
export const supportsPhoneAlerts = Constants.executionEnvironment !== 'storeClient'
  && (process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android')

export async function loadNotifications(): Promise<Notifications> {
  if (!supportsPhoneAlerts) throw new Error('Phone notifications are available in the installed NPL app.')
  return import('expo-notifications')
}

export async function readAlertRegistration() {
  const saved = await SecureStore.getItemAsync(storage)
  return saved ? JSON.parse(saved) as Registration : undefined
}

export async function registerPhoneAlerts(accountId: number, inboxEnabled: boolean) {
  const notifications = await loadNotifications()
  if (process.env.EXPO_OS === 'android') {
    await notifications.setNotificationChannelAsync(channel, {
      name: 'Club match alerts', importance: notifications.AndroidImportance.DEFAULT,
    })
  }
  const allowed = (permission: Awaited<ReturnType<Notifications['getPermissionsAsync']>>) =>
    permission.granted || permission.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL
  let permission = await notifications.getPermissionsAsync()
  if (!allowed(permission) && permission.canAskAgain) permission = await notifications.requestPermissionsAsync()
  if (!allowed(permission)) throw new Error('Allow notifications for NPL Zimbabwe in your phone settings, then try again.')
  const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId
  let token: string
  try { token = (await notifications.getExpoPushTokenAsync({ projectId })).data }
  catch { throw new Error('This phone could not register for club alerts. Try again later.') }
  if (!inboxEnabled) {
    await supporterRequest('/me', { method: 'PATCH', body: JSON.stringify({ push_consent: true }) })
  }
  const device = await supporterRequest<{ id: number }>('/devices', {
    method: 'POST', body: JSON.stringify({ provider: 'expo', platform: process.env.EXPO_OS, device_token: token }),
  })
  const registration = { id: device.id, accountId }
  try { await SecureStore.setItemAsync(storage, JSON.stringify(registration)) }
  catch (error) {
    await supporterRequest('/devices/' + device.id, { method: 'DELETE' })
    throw error
  }
  return registration
}

export async function removePhoneAlerts(accountId?: number) {
  const device = await readAlertRegistration()
  if (!device || accountId !== undefined && device.accountId !== accountId) return
  await supporterRequest('/devices/' + device.id, { method: 'DELETE' }).catch(error => {
    if (!(error instanceof SupporterError) || error.status !== 404) throw error
  })
  await SecureStore.deleteItemAsync(storage)
}
