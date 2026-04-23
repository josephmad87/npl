import { Link } from '@tanstack/react-router'
import { SiteLogoPlaceholder } from './SiteLogoPlaceholder'
import { formatCategoryLabel } from '../lib/formatters'
import { resolveMediaUrl } from '../lib/publicApi'
import type { TeamLite } from '../lib/hooks'

export function TeamCard({ team }: { team: TeamLite }) {
  const image = resolveMediaUrl(team.cover_image_url) ?? resolveMediaUrl(team.logo_url)
  return (
    <Link to="/teams/$slug" params={{ slug: team.slug }} className="ui-team-card">
      {image ? (
        <img src={image} alt={team.name} />
      ) : (
        <SiteLogoPlaceholder className="ui-team-card-placeholder" />
      )}
      <div>
        <h3>{team.name}</h3>
        <p>{formatCategoryLabel(team.category)}</p>
        {(team.home_ground_name ?? team.home_ground) ? (
          <p>{team.home_ground_name ?? team.home_ground}</p>
        ) : null}
      </div>
    </Link>
  )
}
