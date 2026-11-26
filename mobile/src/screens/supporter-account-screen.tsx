import { Checkbox, Host, Switch } from '@expo/ui'
import { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { validateSupporterAuth, type SupporterAuthFields, type SupporterAuthMode } from '../../../website/src/lib/supporterValidation'
import { SiteLink } from '../components/app-link'
import { Action, Field, LoadState, MenuRow, Notice, Screen, Segments, ui } from '../components/native-ui'
import { readAlertRegistration, registerPhoneAlerts, removePhoneAlerts, supportsPhoneAlerts } from '../lib/club-alerts'
import {
  authenticate, deleteSupporterAccount, signOutSupporter, supporterRequest,
  useSupporterAccount, useSupporterResource, type Follows, type Preference, type Profile,
} from '../lib/supporter-account'
import { colors } from '../theme'

const authOptions = [{ value: 'login', label: 'Sign in' }, { value: 'register', label: 'Register' }] as const
const preferences: readonly { key: Preference; label: string }[] = [
  { key: 'push_consent', label: 'Match reminders and results in My NPL' },
  { key: 'marketing_consent', label: 'NPL news and supporter offers' },
  { key: 'analytics_consent', label: 'Consent-based engagement analytics' },
]
const defaultPreferences: Record<Preference, boolean> = { push_consent: false, marketing_consent: false, analytics_consent: false }
const blank: SupporterAuthFields = { display_name: '', email: '', password: '', phone: '', accept_terms: false, accept_privacy: false }
const policyVersion = '2026-09'

export function SupporterAccountScreen({ openDeletion = false }: { openDeletion?: boolean }) {
  const params = useLocalSearchParams<{ deletion?: string; preferences?: string }>()
  const session = useSupporterAccount()
  const [deleted, setDeleted] = useState(false)
  if (session === undefined) return <Screen title="Supporter account" back="My NPL"><LoadState loading retry={() => undefined} /></Screen>
  if (!session) return <AuthForm deleted={deleted} deletionEntry={openDeletion || params.deletion === '1'} />
  return <Dashboard showDeletion={openDeletion || params.deletion === '1'} showPreferences={params.preferences === '1'} onDeleted={() => setDeleted(true)} />
}

function AuthForm({ deleted, deletionEntry }: { deleted: boolean; deletionEntry: boolean }) {
  const [mode, setMode] = useState<SupporterAuthMode>('login')
  const [fields, setFields] = useState(blank)
  const [consents, setConsents] = useState(defaultPreferences)
  const [showOptional, setShowOptional] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempted, setAttempted] = useState(false)
  const registering = mode === 'register'

  function update<K extends keyof SupporterAuthFields>(key: K, value: SupporterAuthFields[K]) {
    setFields(current => ({ ...current, [key]: value }))
    if (error) setError('')
  }

  async function submit() {
    if (busy) return
    setAttempted(true)
    const validation = validateSupporterAuth(mode, fields)
    const firstError = Object.values(validation)[0]
    if (firstError) { setError(firstError); return }
    setBusy(true)
    setError('')
    try {
      await authenticate(fields.email, fields.password, registering ? {
        ...consents,
        display_name: fields.display_name.trim(),
        phone: fields.phone.trim() || null,
        accept_terms: fields.accept_terms,
        accept_privacy: fields.accept_privacy,
        policy_version: policyVersion,
      } : undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not continue. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <Screen back="My NPL" title="Supporter account">
    <Segments value={mode} options={authOptions} onChange={value => {
      if (busy) return
      setMode(value); setError(''); setAttempted(false); setShowPassword(false)
    }} />
    {error ? <Notice error>
      {error}{error === 'This account no longer exists.' ? '\nTap Register to create a new account.' : ''}
    </Notice> : deleted && !attempted ? <Notice>Your account has been deleted.</Notice>
      : deletionEntry && !registering && !attempted ? <Notice>Sign in to delete your supporter account.</Notice> : null}
    {registering ? <Field label="Name" value={fields.display_name} onChangeText={value => update('display_name', value)} placeholder="Your name" autoComplete="name" maxLength={255} editable={!busy} /> : null}
    <Field label="Email address" value={fields.email} onChangeText={value => update('email', value)}
      placeholder="fan@example.com" autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect={false} maxLength={255} editable={!busy} />
    <View>
      <Field label="Password" value={fields.password} onChangeText={value => update('password', value)}
        placeholder={registering ? 'At least 12 characters' : 'Enter your password'}
        autoComplete={registering ? 'new-password' : 'current-password'} passwordRules={registering ? 'minlength: 12; maxlength: 128;' : undefined}
        secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} editable={!busy}
        style={s.password} onSubmitEditing={registering ? undefined : () => void submit()} />
      <Pressable style={s.visibility} accessibilityRole="button" onPress={() => setShowPassword(value => !value)}>
        <Text style={s.visibilityText}>{showPassword ? 'Hide' : 'Show'}</Text>
      </Pressable>
    </View>
    {registering ? <>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showOptional }} onPress={() => setShowOptional(value => !value)} style={s.optional}>
        <Text style={ui.link}>Optional details and preferences</Text><Text style={s.visibilityText}>{showOptional ? '▴' : '▾'}</Text>
      </Pressable>
      {showOptional ? <>
        <Field label="Phone number" value={fields.phone} onChangeText={value => update('phone', value)} autoComplete="tel" inputMode="tel" maxLength={32} editable={!busy} />
        {preferences.map(item => <PreferenceToggle key={item.key} label={item.label} value={consents[item.key]} disabled={busy} onChange={value => setConsents(current => ({ ...current, [item.key]: value }))} />)}
      </> : null}
      <View style={s.consent}>
        <Host matchContents colorScheme="light"><Checkbox value={fields.accept_terms} onValueChange={value => update('accept_terms', value)} label="I accept the" disabled={busy} /></Host>
        <SiteLink path="/terms" style={ui.link}>Terms</SiteLink>
      </View>
      <View style={s.consent}>
        <Host matchContents colorScheme="light"><Checkbox value={fields.accept_privacy} onValueChange={value => update('accept_privacy', value)} label="I have read the" disabled={busy} /></Host>
        <SiteLink path="/privacy" style={ui.link}>Privacy Policy</SiteLink>
      </View>
    </> : null}
    <Action label={registering ? 'Create account' : 'Sign in'} busy={busy} onPress={() => void submit()} />
  </Screen>
}

type Section = 'Following' | 'Notifications' | 'Orders' | 'Preferences'
type Notification = { id: number; title: string; body: string; read_at: string | null; created_at: string; match_id?: number | null }
type Order = { order_number: string; product_name: string; status: string; payment_status: string }
const sections: readonly Section[] = ['Following', 'Notifications', 'Orders', 'Preferences']

function Dashboard({ showDeletion, showPreferences, onDeleted }: { showDeletion: boolean; showPreferences: boolean; onDeleted: () => void }) {
  const profile = useSupporterResource<Profile>('/me')
  const [section, setSection] = useState<Section | null>(showPreferences ? 'Preferences' : null)
  const [deleting, setDeleting] = useState(showDeletion)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function perform(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError('')
    try { await action() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your change.') }
    finally { setBusy(false) }
  }

  function confirmDeletion() {
    if (!profile.data || busy) return
    const { email } = profile.data
    Alert.alert('Delete account?', 'Your supporter account and follows will be permanently deleted.', [
      { text: 'Keep account', style: 'cancel' },
      { text: 'Permanently delete account', style: 'destructive', onPress: () => void perform(async () => {
        await deleteSupporterAccount(email)
        onDeleted()
      }) },
    ])
  }

  return <Screen back="My NPL" title="Supporter account">
    <LoadState loading={profile.loading} error={profile.error} retry={profile.refresh} />
    {error ? <Notice error>{error}</Notice> : null}
    <View style={[ui.panel, ui.row]}>
      <View style={s.profile}>
        <Text style={ui.heading}>{profile.data?.display_name || 'Your account'}</Text>
        {profile.data?.email ? <Text style={ui.muted}>{profile.data.email}</Text> : null}
      </View>
      <Action tone="secondary" label="Log out" busy={busy} onPress={() => void perform(async () => {
        if (supportsPhoneAlerts) await removePhoneAlerts(profile.data?.id)
        await signOutSupporter()
      })} />
    </View>
    {profile.data ? <>
      <View style={ui.menu}>
        {sections.map((item, index) => <View key={item}>
          {index > 0 ? <View style={ui.divider} /> : null}
          <MenuRow title={item} detail={item === 'Following' ? 'Clubs and players' : undefined}
            onPress={() => setSection(value => value === item ? null : item)} />
        </View>)}
      </View>
      {section === 'Preferences' ? <View style={ui.panel}>
        <Text style={ui.heading}>Notifications & preferences</Text>
        <PhoneAlerts key={profile.data.id} profile={profile.data} onChange={profile.refresh} />
        {preferences.map(item => <PreferenceToggle key={item.key} label={item.label}
          value={profile.data?.[item.key] ?? false} disabled={busy} onChange={value => void perform(async () => {
            await supporterRequest('/me', { method: 'PATCH', body: JSON.stringify({ [item.key]: value }) })
            profile.refresh()
          })} />)}
      </View> : section === 'Following' ? <FollowingPanel /> : section === 'Notifications' ? <NotificationsPanel />
        : section === 'Orders' ? <OrdersPanel /> : null}
      <View style={ui.panel}>
        {!deleting ? <Action label="Delete account" tone="danger" onPress={() => setDeleting(true)} />
          : <>
            <Text style={ui.heading}>Delete account</Text>
            <Text style={ui.muted}>Permanently remove your supporter profile, follows and inbox. Limited order and consent records may be retained as described in the Privacy Policy.</Text>
            <SiteLink path="/privacy" style={ui.link}>Privacy Policy</SiteLink>
            <Action label="Permanently delete account" tone="danger" busy={busy} onPress={confirmDeletion} />
            <Action label="Keep account" tone="secondary" disabled={busy} onPress={() => setDeleting(false)} />
          </>}
      </View>
    </> : null}
  </Screen>
}

function PhoneAlerts({ profile, onChange }: { profile: Profile; onChange: () => void }) {
  const settings = useSupporterResource<{ expo_enabled: boolean }>(supportsPhoneAlerts ? '/device-settings' : null)
  const devices = useSupporterResource<{ id: number }[]>(settings.data?.expo_enabled ? '/devices' : null)
  const [registration, setRegistration] = useState<number>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!supportsPhoneAlerts) return
    let active = true
    void readAlertRegistration().then(device => {
      if (active && device?.accountId === profile.id) setRegistration(device.id)
    }).catch(() => undefined)
    return () => { active = false }
  }, [profile.id])
  const enabled = profile.push_consent && devices.data?.some(device => device.id === registration)

  async function toggle() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (enabled) {
        await removePhoneAlerts(profile.id)
        setRegistration(undefined)
      } else {
        const device = await registerPhoneAlerts(profile.id, profile.push_consent)
        setRegistration(device.id)
      }
      devices.refresh()
      onChange()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not change phone alerts.')
    } finally {
      setBusy(false)
    }
  }

  return <View style={s.alertOptions}>
    <Text style={ui.rowTitle}>Phone alerts</Text>
    <Text style={ui.muted}>Reminders and final scores for the clubs you follow.</Text>
    {settings.data?.expo_enabled ? <Action tone="secondary" busy={busy || devices.loading}
      label={enabled ? 'Turn off alerts on this phone' : 'Enable alerts on this phone'} onPress={() => void toggle()} />
      : settings.loading ? null : <Text style={ui.muted}>{supportsPhoneAlerts ? 'Phone alerts are currently unavailable.' : 'Install the NPL app to enable phone alerts.'}</Text>}
    {error ? <Notice error>{error}</Notice> : null}
  </View>
}

function PreferenceToggle({ label, value, disabled, onChange }: {
  label: string; value: boolean; disabled?: boolean; onChange: (value: boolean) => void
}) {
  return <Host matchContents colorScheme="light" style={s.toggle}>
    <Switch label={label} value={value} disabled={disabled} onValueChange={onChange} />
  </Host>
}

function FollowingPanel() {
  const resource = useSupporterResource<Follows>('/follows')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function remove(group: 'players' | 'teams', id: number) {
    if (pending) return
    setPending(true)
    setError('')
    try { await supporterRequest('/follows/' + group + '/' + id, { method: 'DELETE' }); resource.refresh() }
    catch { setError('Could not update your follows. Try again.') }
    finally { setPending(false) }
  }
  return <View style={ui.panel}>
    <Text style={ui.heading}>Following</Text>
    <LoadState loading={resource.loading} error={resource.error} retry={resource.refresh} empty={resource.data && !resource.data.players.length && !resource.data.teams.length ? 'Follow teams or players from their profiles.' : undefined} />
    {error ? <Notice error>{error}</Notice> : null}
    {(['teams', 'players'] as const).flatMap(group => resource.data?.[group].map(item => <View style={ui.row} key={group + item.id}>
      <SiteLink path={'/' + group + '/' + item.slug} style={[ui.link, s.profile]}>{item.name}</SiteLink>
      <Action tone="secondary" label="Unfollow" disabled={pending} onPress={() => void remove(group, item.id)} />
    </View>) ?? [])}
  </View>
}

function NotificationsPanel() {
  const resource = useSupporterResource<{ items: Notification[] }>('/notifications?page_size=50')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function markRead(id: number) {
    if (pending) return
    setPending(true)
    setError('')
    try {
      await supporterRequest('/notifications/' + id + '/read', { method: 'POST' })
      resource.refresh()
    } catch { setError('Could not update the notification. Try again.') }
    finally { setPending(false) }
  }
  return <View style={ui.panel}>
    <Text style={ui.heading}>Notifications</Text>
    <LoadState loading={resource.loading} error={resource.error} retry={resource.refresh} empty={resource.data && !resource.data.items.length ? 'No notifications yet.' : undefined} />
    {error ? <Notice error>{error}</Notice> : null}
    {resource.data?.items.map(item => <View key={item.id} style={s.item}>
      <Text style={ui.rowTitle}>{item.title}</Text><Text style={ui.muted}>{item.body}</Text>
      {item.match_id ? <SiteLink path={'/matches/' + item.match_id} style={ui.link} push>Open match ›</SiteLink> : null}
      {!item.read_at ? <Action label="Mark read" tone="secondary" disabled={pending} onPress={() => void markRead(item.id)} /> : null}
    </View>)}
  </View>
}

function OrdersPanel() {
  const resource = useSupporterResource<Order[]>('/orders')
  return <View style={ui.panel}>
    <Text style={ui.heading}>Orders</Text>
    <LoadState loading={resource.loading} error={resource.error} retry={resource.refresh} empty={resource.data && !resource.data.length ? 'No account-linked orders yet.' : undefined} />
    {resource.data?.map(order => <View key={order.order_number} style={s.item}>
      <Text style={ui.rowTitle}>{order.product_name}</Text>
      <Text style={ui.muted}>{[order.order_number, order.status, order.payment_status].join(' · ').replaceAll('_', ' ')}</Text>
    </View>)}
  </View>
}

const s = StyleSheet.create({
  alertOptions: { gap: 6, paddingBottom: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  profile: { flex: 1, gap: 4 },
  consent: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, minHeight: 44, marginVertical: -4 },
  optional: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  password: { paddingRight: 66 },
  visibility: { position: 'absolute', right: 4, bottom: 1, minWidth: 55, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  visibilityText: { fontWeight: '700', color: colors.accent },
  toggle: { minHeight: 44, width: '100%', justifyContent: 'center' },
  item: { gap: 5, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
})
