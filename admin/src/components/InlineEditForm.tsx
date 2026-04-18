import { Save, X } from 'lucide-react'
import type { ReactNode } from 'react'

export type InlineEditField = {
  id: string
  label: string
  control: ReactNode
}

type InlineEditFormProps = {
  fields: InlineEditField[]
  onSave: () => void
  onCancel: () => void
  error?: string | null
}

export function InlineEditForm({
  fields,
  onSave,
  onCancel,
  error,
}: InlineEditFormProps) {
  return (
    <div
      className="detail-panel"
      style={{ paddingTop: '1rem' }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
    >
      {fields.map((f) => (
        <div
          key={f.id}
          className="detail-panel__row"
          style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.35rem' }}
        >
          <label className="detail-panel__label" htmlFor={f.id}>
            {f.label}
          </label>
          <div className="detail-panel__value">{f.control}</div>
        </div>
      ))}
      {error ? (
        <p className="login-error" style={{ marginTop: '0.5rem' }}>
          {error}
        </p>
      ) : null}
      <div
        style={{
          display: 'flex',
          gap: '0.65rem',
          marginTop: '1.15rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          className="btn-ghost btn--with-icon"
          onClick={onCancel}
        >
          <X size={18} strokeWidth={2} aria-hidden />
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary btn--with-icon"
          onClick={onSave}
        >
          <Save size={18} strokeWidth={2} aria-hidden />
          Save changes
        </button>
      </div>
    </div>
  )
}
