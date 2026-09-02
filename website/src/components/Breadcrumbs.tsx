import { Link } from '@tanstack/react-router'
import type { SeoBreadcrumb } from './SeoHead'

export function Breadcrumbs({ items }: { items: SeoBreadcrumb[] }) {
  return (
    <nav className="npl-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1
          return (
            <li key={`${item.name}-${item.path ?? index}`}>
              {item.path && !isCurrent ? (
                <Link to={item.path}>{item.name}</Link>
              ) : (
                <span aria-current={isCurrent ? 'page' : undefined}>{item.name}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
