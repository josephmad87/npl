import {
  COMPETITION_CATEGORY_OPTIONS,
  type CompetitionCategoryValue,
} from '../lib/competitionCategories'

export function CompetitionCategorySelect({
  id,
  className,
  value,
  onChange,
}: {
  id: string
  className?: string
  value: CompetitionCategoryValue
  onChange: (next: CompetitionCategoryValue) => void
}) {
  return (
    <select
      id={id}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value as CompetitionCategoryValue)}
    >
      {COMPETITION_CATEGORY_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
