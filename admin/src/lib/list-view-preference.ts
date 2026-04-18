export type ListViewMode = 'cards' | 'table'

function storageKey(routeKey: string) {
  return `npl_admin_listview:${routeKey}`
}

export function getInitialListViewMode(
  routeKey: string,
  fallback: ListViewMode,
): ListViewMode {
  try {
    const v = sessionStorage.getItem(storageKey(routeKey))
    if (v === 'cards' || v === 'table') return v
  } catch {
    /* ignore */
  }
  return fallback
}

export function persistListViewMode(routeKey: string, mode: ListViewMode) {
  try {
    sessionStorage.setItem(storageKey(routeKey), mode)
  } catch {
    /* ignore */
  }
}
