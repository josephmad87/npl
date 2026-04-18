import { useCallback, useState } from 'react'
import {
  getInitialListViewMode,
  persistListViewMode,
  type ListViewMode,
} from '@/lib/list-view-preference'

export function useListViewMode(
  routeKey: string,
  fallback: ListViewMode = 'cards',
): readonly [ListViewMode, (mode: ListViewMode) => void] {
  const [mode, setModeState] = useState<ListViewMode>(() =>
    getInitialListViewMode(routeKey, fallback),
  )
  const setMode = useCallback(
    (m: ListViewMode) => {
      setModeState(m)
      persistListViewMode(routeKey, m)
    },
    [routeKey],
  )
  return [mode, setMode]
}
