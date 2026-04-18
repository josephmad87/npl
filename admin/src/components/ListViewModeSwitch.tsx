import { LayoutGrid, Table2 } from 'lucide-react'
import type { ListViewMode } from '@/lib/list-view-preference'

type ListViewModeSwitchProps = {
  value: ListViewMode
  onChange: (mode: ListViewMode) => void
  className?: string
}

export function ListViewModeSwitch({
  value,
  onChange,
  className,
}: ListViewModeSwitchProps) {
  return (
    <div
      className={`list-view-mode${className ? ` ${className}` : ''}`}
      role="group"
      aria-label="Result layout"
    >
      <button
        type="button"
        className="list-view-mode__btn list-view-mode__btn--with-icon"
        data-active={value === 'cards'}
        aria-pressed={value === 'cards'}
        onClick={() => onChange('cards')}
      >
        <LayoutGrid size={16} strokeWidth={2} aria-hidden />
        Cards
      </button>
      <button
        type="button"
        className="list-view-mode__btn list-view-mode__btn--with-icon"
        data-active={value === 'table'}
        aria-pressed={value === 'table'}
        onClick={() => onChange('table')}
      >
        <Table2 size={16} strokeWidth={2} aria-hidden />
        Table
      </button>
    </div>
  )
}
