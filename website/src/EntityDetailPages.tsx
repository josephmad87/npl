import { useNavigate, useParams } from '@tanstack/react-router'
import { LeagueSeasonHub } from './components/LeagueSeasonHub'

export { TeamDetailPage } from './TeamDetailPage'

export function LeagueDetailPage() {
  const { slug } = useParams({ from: '/leagues/$slug' })
  const navigate = useNavigate()
  return (
    <LeagueSeasonHub
      key={slug}
      leagueSlug={slug}
      onLeagueSlugChange={(next) => {
        void navigate({ to: '/leagues/$slug', params: { slug: next } })
      }}
      showDescription
    />
  )
}

export function SeasonDetailPage() {
  const { leagueSlug, seasonSlug } = useParams({
    from: '/leagues/$leagueSlug/seasons/$seasonSlug',
  })
  const navigate = useNavigate()
  return (
    <LeagueSeasonHub
      key={`${leagueSlug}-${seasonSlug}`}
      leagueSlug={leagueSlug}
      onLeagueSlugChange={(next) => {
        void navigate({ to: '/leagues/$slug', params: { slug: next } })
      }}
      seasonSlugFromRoute={seasonSlug}
      onSeasonSlugNavigate={(s) => {
        void navigate({
          to: '/leagues/$leagueSlug/seasons/$seasonSlug',
          params: { leagueSlug, seasonSlug: s },
        })
      }}
      showDescription
    />
  )
}
