import { useEffect, useState } from 'react'
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
  const derivedKind = dismissalKindFromValue(value)
  const [outPending, setOutPending] = useState(false)

  useEffect(() => {
    if (derivedKind !== 'empty') {
      setOutPending(false)
    }
  }, [derivedKind])

  const kind: DismissalKind =
    derivedKind !== 'empty' ? derivedKind : outPending ? 'out' : 'empty'

  const setKind = (next: DismissalKind) => {
    if (next === 'out') {
      setOutPending(true)
      if (derivedKind === 'not_out' || derivedKind === 'dnb' || derivedKind === 'retired_hurt') {
        onChange('')
      }
      return
    }
    setOutPending(false)
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
          value={derivedKind === 'out' || outPending ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="c Smith b Jones"
          autoFocus={outPending && !value.trim()}
        />
      ) : null}
    </div>
  )
}
