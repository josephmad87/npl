import { loadClubs } from './team-data'
import type { Article, Fixture } from './feed'
import { usePublic, type Page } from './public-resource'
import { useTeamResource } from './use-team-resource'

export function useHomeFeed({ includeNews = true, live = false } = {}) {
  const fixtures = usePublic<Page<Fixture>>('/fixtures?page_size=30', { maxAge: 20_000, poll: live ? 20_000 : 45_000 })
  const results = usePublic<Page<Fixture>>('/results?page_size=3', { maxAge: 30_000, poll: live ? 30_000 : undefined })
  const clubs = useTeamResource('clubs-v1', loadClubs, { maxAge: 300_000 })
  const news = usePublic<Article[]>(includeNews ? '/homepage-news' : null, { maxAge: 30_000 })
  const refresh = () => Promise.all([fixtures.refresh(), results.refresh(), clubs.refresh(), news.refresh()])
  return {
    results: results.data?.items || [],
    fixtures: fixtures.data?.items || [],
    teams: clubs.data || [],
    news: news.data || [],
    loading: fixtures.loading || results.loading || clubs.loading || news.loading,
    hasScores: Boolean(fixtures.data || results.data),
    fixturesCheckedAt: fixtures.checkedAt,
    fixturesError: fixtures.error,
    error: fixtures.error || results.error || clubs.error || news.error,
    refresh,
  }
}
