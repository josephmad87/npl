import type { ReactNode } from 'react'

export type DetailField = { label: string; value: ReactNode }

export function DetailFields({ items }: { items: DetailField[] }) {
  return (
    <div className="detail-panel">
      {items.map((item) => (
        <div key={item.label} className="detail-panel__row">
          <div className="detail-panel__label">{item.label}</div>
          <div className="detail-panel__value">{item.value}</div>
        </div>
      ))}
    </div>
  )
}
