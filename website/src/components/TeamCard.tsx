import { Link } from '@tanstack/react-router'
import { SiteLogoPlaceholder } from './SiteLogoPlaceholder'
import { formatCategoryLabel } from '../lib/formatters'
import { resolveMediaUrl } from '../lib/publicApi'
import type { TeamLite } from '../lib/hooks'
import { ResponsiveImage } from './ResponsiveImage'

export function TeamCard({ team }: { team: TeamLite }) {
  const image = resolveMediaUrl(team.cover_image_url) ?? resolveMediaUrl(team.logo_url)
  return (
    <Link to="/teams/$slug" params={{ slug: team.slug }} className="ui-team-card">
      <div className="ui-team-card__media">
        {image ? (
          <ResponsiveImage
            src={image}
            alt={team.name}
            widths={[320, 480, 640]}
            sizes="(max-width: 700px) 100vw, 33vw"
            fallbackWidth={480}
          />
        ) : (
          <SiteLogoPlaceholder className="ui-team-card-placeholder" />
        )}
      </div>
      <div className="ui-team-card__body">
        <h3>{team.name}</h3>
        <p>{formatCategoryLabel(team.category)}</p>
        {(team.home_ground_name ?? team.home_ground) ? (
          <p>{team.home_ground_name ?? team.home_ground}</p>
        ) : null}
      </div>
    </Link>
  )
}
