type ArticleStatus = 'draft' | 'scheduled' | 'published' | 'archived'
type GenericStatus =
  | ArticleStatus
  | 'active'
  | 'inactive'
  | 'injured'
  | 'upcoming'
  | 'completed'
  | 'live'
  | 'postponed'
  | 'abandoned'
  | 'cancelled'

const STATUS_CLASS: Partial<Record<GenericStatus, string>> = {
  draft: 'badge--draft',
  scheduled: 'badge--scheduled',
  published: 'badge--published',
  archived: 'badge--archived',
}

export function StatusBadge({ status }: { status: GenericStatus }) {
  const cls = STATUS_CLASS[status] ?? 'badge--archived'
  return (
    <span className={`badge ${cls}`}>
      {status.replaceAll('_', ' ')}
    </span>
  )
}
