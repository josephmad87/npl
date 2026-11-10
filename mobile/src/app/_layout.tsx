import { AppHeader } from '../components/app-header'
import { Stack } from 'expo-router'
import { colors } from '../theme'
export default function Layout() {
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.ink, headerTitleStyle: { fontSize: 16, fontWeight: '700' }, headerShadowVisible: false }}><Stack.Screen name="(tabs)" options={{ header: () => <AppHeader /> }} /><Stack.Screen name="page" options={{ header: ({ route }) => <AppHeader detail title={(route.params as { title?: string } | undefined)?.title} /> }} /></Stack>
}
