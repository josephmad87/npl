import { useMemo, useState, type ReactNode } from 'react'

type CatalogFilterGridProps<T> = {
  items: T[]
  getKey: (item: T) => string | number
  getSearchText: (item: T) => string
  searchPlaceholder?: string
  emptyMessage?: string
  toolbarLeading?: ReactNode
  toolbarExtras?: ReactNode
  query?: string
  onQueryChange?: (next: string) => void
  renderCard: (item: T) => ReactNode
}

export function CatalogFilterGrid<T>({
  items,
  getKey,
  getSearchText,
  searchPlaceholder = 'Search…',
  emptyMessage = 'Nothing matches that filter.',
  toolbarLeading,
  toolbarExtras,
  query,
  onQueryChange,
  renderCard,
}: CatalogFilterGridProps<T>) {
  const [internalQ, setInternalQ] = useState('')
  const q = query ?? internalQ
  const setQ = onQueryChange ?? setInternalQ
  const needle = q.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!needle) return items
    return items.filter((it) =>
      getSearchText(it).toLowerCase().includes(needle),
    )
  }, [items, needle, getSearchText])

  return (
    <div className="catalog-browse">
      <div className="catalog-toolbar">
        {toolbarLeading ? (
          <div className="catalog-toolbar__leading">{toolbarLeading}</div>
        ) : null}
        <input
          type="search"
          className="catalog-toolbar__search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Filter results"
        />
        {toolbarExtras ? (
          <div className="catalog-toolbar__extras">{toolbarExtras}</div>
        ) : null}
      </div>
      <div className="catalog-grid">
        {filtered.length === 0 ? (
          <p className="muted catalog-grid__empty">{emptyMessage}</p>
        ) : (
          filtered.map((item) => (
            <div key={String(getKey(item))} className="catalog-grid__cell">
              {renderCard(item)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
