import { useEffect, useRef, useState } from 'react'
import { publicRequest, usePublic, type Page } from './public-resource'

export function pageRequest(path: string, page: number, size: number) {
  return path + (path.includes('?') ? '&' : '?') + 'page=' + page + '&page_size=' + size
}

export function usePageExpansion<T extends { id: number }>(path: string, size: number, first?: Page<T>) {
  const [pages, setPages] = useState<{ path: string; items: T[]; page: number; last: number }>()
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState('')
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => { active.current?.abort(); active.current = null }, [path, size])
  const extra = pages?.path === path ? pages : undefined
  const items = [...new Map([...(first?.items || []), ...(extra?.items || [])].map(item => [item.id, item])).values()]
  const page = extra?.page || 1
  const hasMore = Boolean(first && page < (extra?.last ?? first.pages))

  async function more() {
    if (active.current || !hasMore) return
    const request = new AbortController()
    active.current = request
    const timeout = setTimeout(() => request.abort(), 18_000)
    setLoadingMore(true)
    setMoreError('')
    try {
      const next = await publicRequest<Page<T>>(pageRequest(path, page + 1, size), request.signal)
      if (active.current !== request) return
      setPages({ path, items: [...(extra?.items || []), ...next.items], page: next.page, last: next.pages })
    } catch {
      if (active.current === request) setMoreError('Could not load more. Try again.')
    } finally {
      clearTimeout(timeout)
      if (active.current === request) { active.current = null; setLoadingMore(false) }
    }
  }

  return { items, hasMore, more, loadingMore, moreError }
}

export function usePagedPublic<T extends { id: number }>(path: string, size: number) {
  const first = usePublic<Page<T>>(pageRequest(path, 1, size))
  return { ...first, ...usePageExpansion(path, size, first.data) }
}
