import { Stack } from 'expo-router'
import { AppHeader } from '../components/app-header'
import { NotificationLinks } from '../components/notification-links'

export default function Layout() {
  return <>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: true, header: () => <AppHeader /> }} />
    </Stack>
    <NotificationLinks />
  </>
}
