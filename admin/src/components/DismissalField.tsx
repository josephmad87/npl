import {
  dismissalKindFromValue,
  dismissalValueFromKind,
  type DismissalKind,
} from '@/lib/cricket'

type DismissalFieldProps = Readonly<{
  value: string
  onChange: (value: string) => void
}>

export function DismissalField({ value, onChange }: DismissalFieldProps) {
  const kind = dismissalKindFromValue(value)
  const detail =
    kind === 'out' && value.trim() ? value.trim() : ''

  const setKind = (next: DismissalKind) => {
    if (next === 'out') {
      onChange(detail || '')
      return
    }
    onChange(dismissalValueFromKind(next, ''))
  }

  return (
    <div className="match-stats-table__dismissal-field">
      <select
        className="inline-edit__control match-stats-table__select"
        value={kind}
        onChange={(e) => setKind(e.target.value as DismissalKind)}
      >
        <option value="empty">—</option>
        <option value="dnb">Did not bat</option>
        <option value="not_out">Not out</option>
        <option value="retired_hurt">Retired hurt</option>
        <option value="out">Out (detail)</option>
      </select>
      {kind === 'out' ? (
        <input
          className="inline-edit__control match-stats-table__dismissal"
          value={detail}
          onChange={(e) => onChange(e.target.value)}
          placeholder="c Smith b Jones"
        />
      ) : null}
    </div>
  )
}
