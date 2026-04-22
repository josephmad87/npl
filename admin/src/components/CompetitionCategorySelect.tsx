import { COMPETITION_CATEGORY_OPTIONS } from '../lib/competitionCategories'

export function CompetitionCategorySelect({
  id,
  className,
  value,
  onChange,
}: {
  id: string
  className?: string
  value: string
  onChange: (next: string) => void
}) {
  return (
    <select id={id} className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      {COMPETITION_CATEGORY_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
