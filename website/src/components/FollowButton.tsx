import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { supporterFetch, useSupporterSession } from '../lib/supporterApi'

type Follows = {
  teams: Array<{ id: number }>
  players: Array<{ id: number }>
}

export function FollowButton({
  kind,
  entityId,
  name,
}: Readonly<{
  kind: 'team' | 'player'
  entityId: number
  name: string
}>) {
  const session = useSupporterSession()
  const queryClient = useQueryClient()
  const followsQ = useQuery({
    queryKey: ['supporter', 'follows'],
    queryFn: () => supporterFetch<Follows>('/supporters/follows'),
    enabled: Boolean(session),
  })
  const rows = kind === 'team' ? followsQ.data?.teams : followsQ.data?.players
  const following = rows?.some((row) => row.id === entityId) ?? false
  const mutation = useMutation({
    mutationFn: () => supporterFetch<void>(`/supporters/follows/${kind}s/${entityId}`, { method: following ? 'DELETE' : 'PUT' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supporter', 'follows'] }),
  })

  if (!session) {
    return <Link to="/my-npl" className="supporter-follow-button">Sign in to follow {name}</Link>
  }
  return (
    <button
      type="button"
      className={`supporter-follow-button${following ? ' is-following' : ''}`}
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending || followsQ.isLoading}
      aria-pressed={following}
    >
      {mutation.isPending ? 'Saving…' : following ? `Following ${name}` : `Follow ${name}`}
    </button>
  )
}
