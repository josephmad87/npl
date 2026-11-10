import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Article, Fixture, Team, read } from './feed'
type Feed = { fixtures: Fixture[]; teams: Team[]; news: Article[]; results: Fixture[]; checkedAt: number }
export function useHomeFeed(resultLimit = 3, newsLimit = 5) {
  const CACHE = `npl-public-feed-v4-${resultLimit}-${newsLimit}`
  const [feed, setFeed] = useState<Feed | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    const timer = setTimeout(() => request.abort(), 15_000)
    setLoading(true)
    try {
      const [fixtures, teams, news, results] = await Promise.all([
        read<Fixture>('/public/fixtures?page_size=30', request.signal),
        read<Team>('/public/teams?page_size=100', request.signal),
        read<Article>(`/public/news?page_size=${newsLimit}`, request.signal),
        read<Fixture>(`/public/results?page_size=${resultLimit}`, request.signal),
      ])
      if (controller.current !== request) return
      const next = { fixtures, teams, news, results, checkedAt: Date.now() }
      setFeed(next); setError(false)
      await AsyncStorage.setItem(CACHE, JSON.stringify(next)).catch(() => undefined)
    } catch {
      if (controller.current === request) setError(true)
    } finally {
      clearTimeout(timer)
      if (controller.current === request) setLoading(false)
    }
  }, [resultLimit, newsLimit, CACHE])
  useEffect(() => {
    let active = true
    void AsyncStorage.getItem(CACHE).then(value => {
      if (active && value) {
        try { const saved = JSON.parse(value) as Feed
          if (Array.isArray(saved.fixtures) && Array.isArray(saved.teams) && Array.isArray(saved.news) && Array.isArray(saved.results) && typeof saved.checkedAt === 'number') setFeed(current => current ?? saved)
        } catch { /* Ignore a damaged cache and use the network. */ }
      }
    })
    // The initial network sync shares loading state with pull-to-refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh() })
    return () => { active = false; subscription.remove(); controller.current?.abort(); controller.current = null }
  }, [refresh, CACHE])
  return { feed, loading, error, refresh }
}
