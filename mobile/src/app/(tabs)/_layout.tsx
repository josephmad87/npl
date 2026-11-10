import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { colors } from '../../theme'
export default function TabLayout() {
  return <NativeTabs tintColor={colors.brand}>
    <NativeTabs.Trigger name="index"><NativeTabs.Trigger.Icon sf="house.fill" md="home" /><NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="live"><NativeTabs.Trigger.Icon sf="dot.radiowaves.left.and.right" md="sensors" /><NativeTabs.Trigger.Label>Live</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="results"><NativeTabs.Trigger.Icon sf="list.bullet.rectangle" md="scoreboard" /><NativeTabs.Trigger.Label>Results</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="news"><NativeTabs.Trigger.Icon sf="newspaper" md="newspaper" /><NativeTabs.Trigger.Label>News</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="account"><NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" /><NativeTabs.Trigger.Label>My NPL</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  </NativeTabs>
}
