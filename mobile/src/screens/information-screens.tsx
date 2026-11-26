import { useState } from 'react'
import { Text, View } from 'react-native'
import { SiteLink } from '../components/app-link'
import { MediaImage } from '../components/native-media'
import { Action, Field, LoadState, Notice, Screen, ui } from '../components/native-ui'
import { RichText } from '../components/rich-text'
import { publicRequest, usePublic } from '../lib/public-resource'

type Page = { title: string; subtitle?: string; intro_html?: string; sections: { id: string; heading: string; body_html: string }[] }
type About = {
  mission: string; vision: string; history: string; physical_address: string;
  team: { position: string; picture_url: string }[]; contacts: { emails: string[]; phone: string };
}

export function InformationScreen({ slug, title }: { slug: string; title: string }) {
  const isAbout = slug === 'about-us'
  const page = usePublic<Page>('/site-pages/' + encodeURIComponent(slug))
  const about = usePublic<About>(isAbout ? '/about' : null)
  const data = page.data
  const retry = () => void Promise.all([page.refresh(), about.refresh()])
  return <Screen back="Back" title={data?.title || title} onRefresh={retry} refreshing={page.loading && Boolean(data)}>
    <LoadState loading={page.loading && !data} error={page.error || about.error} retry={retry} />
    {data?.subtitle ? <Text style={ui.muted}>{data.subtitle}</Text> : null}
    <RichText content={data?.intro_html} basePath={'/' + slug} />
    {about.data ? <>
      {(['history', 'mission', 'vision'] as const).map(key => about.data?.[key] ? <View key={key} style={ui.panel}>
        <Text accessibilityRole="header" style={ui.heading}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
        <RichText content={about.data[key]} basePath="/about-us" />
      </View> : null)}
      {about.data.physical_address ? <Text style={ui.text}>{about.data.physical_address}</Text> : null}
      {about.data.team.filter(item => item.picture_url || item.position).map((item, index) => <View key={index} style={ui.panel}>
        <MediaImage source={item.picture_url} fit="contain" label={item.position} />
        {item.position ? <Text style={ui.rowTitle}>{item.position}</Text> : null}
      </View>)}
      <SiteLink path="/contact-us" style={ui.link}>Contact NPL ›</SiteLink>
    </> : null}
    {data?.sections.filter(item => item.body_html.trim() && (!isAbout || !['history', 'mission', 'vision', 'team', 'contact'].includes(item.id)))
      .map(item => <View key={item.id} style={ui.panel}>
        {item.heading ? <Text accessibilityRole="header" style={ui.heading}>{item.heading}</Text> : null}
        <RichText content={item.body_html} basePath={'/' + slug} />
      </View>)}
    {slug === 'account-deletion' || slug === 'support' ? <SiteLink path="/my-npl#delete-account-heading" style={ui.link}>Open supporter account ›</SiteLink> : null}
  </Screen>
}

export function ContactScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const about = usePublic<About>('/about')
  async function send() {
    if (busy) return
    setSent(false)
    if (!name.trim() || !/^[^@\s]+@[^@\s]+$/.test(email.trim()) || !message.trim()) {
      setError('Enter your name, email address and message.')
      return
    }
    setBusy(true)
    setError('')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    try {
      await publicRequest('/contact', controller.signal, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name.trim(), email: email.trim(),
          message: [subject.trim() && 'Subject: ' + subject.trim(), message.trim()].filter(Boolean).join('\n\n'),
        }),
      })
      setSent(true)
      setSubject('')
      setMessage('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send your message.')
    } finally { clearTimeout(timer); setBusy(false) }
  }
  return <Screen title="Contact NPL" back="My NPL">
    {sent ? <Notice>Your message has been sent.</Notice> : null}
    {error ? <Notice error>{error}</Notice> : null}
    <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" maxLength={255} editable={!busy} />
    <Field label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" autoComplete="email" autoCapitalize="none" inputMode="email" maxLength={255} editable={!busy} />
    <Field label="Subject" value={subject} onChangeText={setSubject} placeholder="What can we help with?" maxLength={160} editable={!busy} />
    <Field label="Message" value={message} onChangeText={setMessage} placeholder="Write your message" multiline maxLength={4800} editable={!busy} />
    <Action label="Send message" onPress={() => void send()} busy={busy} />
    <View style={ui.row}><SiteLink path="/privacy" style={ui.link}>Privacy Policy</SiteLink><SiteLink path="/support" style={ui.link}>Account help</SiteLink></View>
    {about.data?.physical_address ? <Text selectable style={ui.muted}>{about.data.physical_address}</Text> : null}
    {about.data?.contacts.emails.map(emailAddress => <Text selectable key={emailAddress} style={ui.muted}>{emailAddress}</Text>)}
    {about.data?.contacts.phone ? <Text selectable style={ui.muted}>{about.data.contacts.phone}</Text> : null}
  </Screen>
}
