import { useState } from 'react'
import { router } from 'expo-router'
import { Action, Notice } from './native-ui'
import { supporterRequest, useSupporterAccount, useSupporterResource, type Follows } from '../lib/supporter-account'

export function FollowButton({ kind, id }: { kind: 'team' | 'player'; id: number }) {
  const session = useSupporterAccount()
  const follows = useSupporterResource<Follows>(session ? '/follows' : null)
  const group = kind === 'team' ? 'teams' : 'players'
  const following = follows.data?.[group].some(item => item.id === id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function toggle() {
    setError('')
    if (!session) { router.push('/account/supporter'); return }
    setBusy(true)
    try {
      await supporterRequest('/follows/' + group + '/' + id, { method: following ? 'DELETE' : 'PUT' })
      follows.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update your follows.')
    } finally {
      setBusy(false)
    }
  }
  return <>
    <Action
      label={following ? 'Unfollow ' + kind : 'Follow ' + kind}
      onPress={() => void toggle()}
      tone="secondary"
      disabled={session === undefined || follows.loading}
      busy={busy}
    />
    {error ? <Notice error>{error}</Notice> : null}
  </>
}
