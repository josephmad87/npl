import { useMemo, useState, type ReactNode } from 'react'

type CatalogFilterGridProps<T> = {
  items: T[]
  getKey: (item: T) => string | number
  getSearchText: (item: T) => string
  searchPlaceholder?: string
  emptyMessage?: string
  renderCard: (item: T) => ReactNode
}

export function CatalogFilterGrid<T>({
  items,
  getKey,
  getSearchText,
  searchPlaceholder = 'Search…',
  emptyMessage = 'Nothing matches that filter.',
  renderCard,
}: CatalogFilterGridProps<T>) {
  const [q, setQ] = useState('')
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
        <input
          type="search"
          className="catalog-toolbar__search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Filter results"
        />
        <span className="muted catalog-toolbar__count">
          {filtered.length} of {items.length}
        </span>
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
