import { Link } from '@tanstack/react-router'

export function SectionHeader({
  title,
  eyebrow,
  linkTo,
  linkSearch,
  linkLabel = 'View all',
}: {
  title: string
  eyebrow?: string
  linkTo?: string
  linkSearch?: Record<string, string>
  linkLabel?: string
}) {
  return (
    <header className="ui-section-header">
      <div>
        {eyebrow ? <p className="ui-section-header-eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {linkTo ? (
        <Link
          to={linkTo}
          {...(linkSearch ? { search: linkSearch } : {})}
          className="ui-section-header-link"
        >
          {linkLabel}
        </Link>
      ) : null}
    </header>
  )
}
