type Section = 'results' | 'stats' | 'standings'

type SeasonOpt = { id: number; name: string; slug: string }
type LeagueOpt = { id: number; name: string; slug: string }

export function LeagueHeroBar({
  seasons,
  leagues,
  selectedSeasonSlug,
  selectedLeagueSlug,
  onSeasonSlugChange,
  onLeagueSlugChange,
  section,
  onSectionChange,
  disabled,
  accessibleTitle,
  sectionLabels,
}: {
  seasons: SeasonOpt[]
  leagues: LeagueOpt[]
  selectedSeasonSlug: string
  selectedLeagueSlug: string
  onSeasonSlugChange: (slug: string) => void
  onLeagueSlugChange: (slug: string) => void
  section: Section
  onSectionChange: (s: Section) => void
  disabled?: boolean
  accessibleTitle?: string
  sectionLabels?: Partial<Record<Section, string>>
}) {
  const isDisabled = disabled ?? false

  return (
    <section className="league-hero" aria-label="League season and view">
      <div className="league-hero__inner">
        {accessibleTitle ? <h1 className="npl-sr-only">{accessibleTitle}</h1> : null}
        <div className="league-hero__pickers">
          <label className="league-hero__select-wrap">
            <span className="league-hero__select-label sr-only">Season</span>
            <select
              className="league-hero__select"
              value={selectedSeasonSlug}
              onChange={(e) => onSeasonSlugChange(e.target.value)}
              disabled={isDisabled || seasons.length === 0}
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
            <span className="league-hero__chev" aria-hidden>
              ▼
            </span>
          </label>
          <label className="league-hero__select-wrap league-hero__select-wrap--league">
            <span className="league-hero__select-label sr-only">League</span>
            <select
              className="league-hero__select"
              value={selectedLeagueSlug}
              onChange={(e) => onLeagueSlugChange(e.target.value)}
              disabled={isDisabled || leagues.length === 0}
            >
              {leagues.map((l) => (
                <option key={l.id} value={l.slug}>
                  {l.name}
                </option>
              ))}
            </select>
            <span className="league-hero__chev" aria-hidden>
              ▼
            </span>
          </label>
        </div>
        <div className="league-hero__tabs" role="tablist" aria-label="League view">
          {(
            [
              ['results', sectionLabels?.results || 'Results'],
              ['stats', sectionLabels?.stats || 'Stats'],
              ['standings', sectionLabels?.standings || 'Standings'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              id={`league-tab-${key}`}
              role="tab"
              className={section === key ? 'is-active' : ''}
              onClick={() => onSectionChange(key)}
              disabled={isDisabled}
              aria-selected={section === key}
              aria-controls={`league-panel-${key}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
