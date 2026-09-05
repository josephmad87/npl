import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export function SectionHeader({
  title,
  eyebrow,
  linkTo,
  linkSearch,
  linkLabel = 'View all',
  description,
}: {
  title: string
  eyebrow?: string
  linkTo?: string
  linkSearch?: Record<string, string>
  linkLabel?: string
  description?: ReactNode
}) {
  return (
    <header className="ui-section-header">
      <div>
        {eyebrow ? <p className="ui-section-header-eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <div className="ui-section-header-description">{description}</div> : null}
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
