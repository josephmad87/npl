import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import nplLogoUrl from './assets/logo-optimized.png'
import nplT20BlastLogoUrl from './assets/npl-t20-blast-logo-no-ribbons.png'
import nplWomensSuper40LogoUrl from './assets/npl-womens-super40-logo-transparent.png'
import { Breadcrumbs } from './components/Breadcrumbs'
import { EmptyState } from './components/EmptyState'
import { ErrorNotice } from './components/ErrorNotice'
import { MatchCard } from './components/MatchCard'
import { PageHero } from './components/PageHero'
import { SeoHead } from './components/SeoHead'
import { Spinner } from './components/Spinner'
import { type LeagueLite, type MatchLite, useTeamsMap } from './lib/hooks'
import { fetchAllPaginatedList, fetchJson, resolveMediaUrl } from './lib/publicApi'

type CompetitionDefinition = {
  slug: 'npl-super40' | 'npl-t20-blast' | 'npl-womens-super40' | 'npl-age-groups'
  title: string
  eyebrow: string
  summary: string
  description: string
  leagueMatcher: (league: LeagueLite) => boolean
}

const competitions: CompetitionDefinition[] = [
  {
    slug: 'npl-super40',
    title: 'Men’s Super40',
    eyebrow: 'Senior club cricket',
    summary: 'The NPL’s flagship 40-over competition for leading clubs.',
    description: 'A premier limited-overs competition where clubs build their season-long record, compete for honours and qualify for the NPL T20 Blast.',
    leagueMatcher: (league) => /super\s*40/i.test(league.name) && !/women|ladies/i.test(league.name),
  },
  {
    slug: 'npl-t20-blast',
    title: 'T20 Blast',
    eyebrow: 'Men’s short-format cricket',
    summary: 'Fast, high-stakes T20 cricket featuring the leading Super40 clubs.',
    description: 'Eight senior men’s clubs play a single round-robin before the top four progress through Qualifier 1, the Eliminator, Qualifier 2 and the Final. Every match is streamed live.',
    leagueMatcher: (league) => /t20\s*blast/i.test(league.name) || /t20\s*blast/i.test(league.slug),
  },
  {
    slug: 'npl-womens-super40',
    title: "Women’s Super40",
    eyebrow: 'Women’s club cricket',
    summary: 'The NPL’s 40-over competition for women’s clubs.',
    description: 'A dedicated women’s competition that gives clubs, players and supporters a clear home for fixtures, results, standings and team stories.',
    leagueMatcher: (league) => league.category === 'women' || /women|ladies/i.test(league.name),
  },
  {
    slug: 'npl-age-groups',
    title: 'NPL Age Groups',
    eyebrow: 'Youth cricket',
    summary: 'NPL pathways and competition for the next generation of players.',
    description: 'Age-group competitions give young cricketers a structured route to develop, represent their clubs and follow official NPL fixtures and results.',
    leagueMatcher: (league) => league.category === 'youth' || /under\s*\d|u\d{2}|age\s*group/i.test(league.name),
  },
]

function useCompetitionLeagues() {
  return useQuery({
    queryKey: ['competition-directory-leagues'],
    queryFn: () =>
      fetchAllPaginatedList<LeagueLite>(
        (page) => `/public/leagues?page=${page}&page_size=100`,
      ),
    retry: 1,
  })
}

function linkedLeague(definition: CompetitionDefinition, leagues: LeagueLite[]): LeagueLite | null {
  return leagues.find(definition.leagueMatcher) ?? null
}

function competitionLogo(definition: CompetitionDefinition, league: LeagueLite | null): string {
  if (definition.slug === 'npl-t20-blast') return nplT20BlastLogoUrl
  if (definition.slug === 'npl-womens-super40') return nplWomensSuper40LogoUrl
  return resolveMediaUrl(league?.logo_url) ?? nplLogoUrl
}

function CompetitionLogo({ definition, league }: { definition: CompetitionDefinition; league: LeagueLite | null }) {
  return (
    <img
      className={`competition-card__logo competition-card__logo--${definition.slug}`}
      src={competitionLogo(definition, league)}
      alt={`${definition.title} logo`}
    />
  )
}

export function CompetitionDirectoryPage() {
  const leaguesQ = useCompetitionLeagues()
  const leagues = leaguesQ.data ?? []

  return (
    <>
      <SeoHead
        title="NPL Competitions"
        description="Explore NPL Super40, NPL T20 Blast, NPL Women’s Super40 and NPL age-group cricket."
        canonicalPath="/competition"
      />
      <PageHero
        variant="siteLogo"
        title="NPL Competitions"
        subtitle="Choose a competition to explore its format, fixtures, results and latest season."
        fallbackMode="none"
      />
      <main className="container competition-directory">
        <Breadcrumbs items={[{ name: 'Home', path: '/' }, { name: 'Competitions', path: '/competition' }]} />
        <section>
          <p className="competition-directory__lead">
            From senior club cricket to women’s and youth pathways, every NPL competition has its own home.
          </p>
          {leaguesQ.isLoading ? <Spinner label="Loading NPL competitions..." /> : null}
          <div className="competition-directory__grid">
            {competitions.map((definition) => {
              const league = linkedLeague(definition, leagues)
              return (
                <article className={`competition-card competition-card--${definition.slug}`} key={definition.slug}>
                  <Link
                    className="competition-card__logo-link"
                    to="/competition/$competitionSlug"
                    params={{ competitionSlug: definition.slug }}
                    aria-label={`Explore ${definition.title}`}
                  >
                    <CompetitionLogo definition={definition} league={league} />
                  </Link>
                  <div className="competition-card__body">
                    <p className="competition-card__eyebrow">{definition.eyebrow}</p>
                    <h2>{definition.title}</h2>
                    <p>{definition.summary}</p>
                    <Link to="/competition/$competitionSlug" params={{ competitionSlug: definition.slug }}>
                      Explore competition <span aria-hidden>→</span>
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </main>
    </>
  )
}

function T20BlastDetails() {
  return (
    <>
      <section className="competition-detail__section">
        <h2>Competition format</h2>
        <p>
          The NPL T20 Blast brings together the top eight senior men’s clubs from the NPL Super40 final standings.
          Each club plays every other club once in a 20-over round-robin phase.
        </p>
        <ol className="competition-detail__format">
          <li>Qualifier 1: first place v second place</li>
          <li>Eliminator: third place v fourth place</li>
          <li>Qualifier 2: Qualifier 1 loser v Eliminator winner</li>
          <li>Final: Qualifier 1 winner v Qualifier 2 winner</li>
        </ol>
      </section>
      <section className="competition-detail__section">
        <h2>Points and bonus points</h2>
        <div className="competition-detail__rules" aria-label="NPL T20 Blast points system">
          <div><strong>2</strong><span>Win</span></div>
          <div><strong>1</strong><span>Tie</span></div>
          <div><strong>1</strong><span>No result</span></div>
          <div><strong>0</strong><span>Loss</span></div>
        </div>
        <ul>
          <li><strong>Batting bonus:</strong> +1 for any team that reaches 200 or more in its innings, regardless of the result or batting order.</li>
          <li><strong>Chase bonus:</strong> +1 more when the team batting second wins after chasing a target of 200 or more.</li>
          <li>Teams level on points are separated by net run rate, then head-to-head result. Super Over runs and overs are excluded from net run rate.</li>
        </ul>
      </section>
      <section className="competition-detail__section">
        <h2>Match standards</h2>
        <div className="competition-detail__facts">
          <p><strong>Playing format</strong><span>20 overs per side; maximum four overs per bowler.</span></p>
          <p><strong>Powerplay</strong><span>Overs 1–4 allow no more than two fielders outside the 30-yard circle, followed by one captain-activated two-over Power Surge before over 18.</span></p>
          <p><strong>Weather</strong><span>A minimum of five overs per side is required for a result; DLS applies when conditions reduce play.</span></p>
          <p><strong>Broadcast</strong><span>All matches are streamed live for verified NPL fans.</span></p>
        </div>
      </section>
    </>
  )
}

function Super40Details({ competition }: { competition: 'men' | 'women' }) {
  const isMens = competition === 'men'

  return (
    <>
      <section className="competition-detail__section">
        <h2>Competition format</h2>
        {isMens ? (
          <p>
            Men’s Super40 is a 14-club round-robin league. The table leader is champion, with the top eight
            clubs qualifying for the T20 Blast and the top ten progressing to the NPL Age Group League.
          </p>
        ) : (
          <p>
            Women’s Super40 is played across two groups. Clubs play a round-robin within their group, then the
            two group winners meet in the Final to decide the champion.
          </p>
        )}
        <div className="competition-detail__facts">
          <p><strong>Playing format</strong><span>40 overs per side; one innings each; maximum eight overs per bowler.</span></p>
          <p><strong>Squads</strong><span>Each club registers a minimum squad of 15 players.</span></p>
          <p><strong>Weather</strong><span>A minimum of 20 overs per side is required for a result; DLS applies when play is reduced.</span></p>
          <p><strong>Tiebreaker</strong><span>Teams level on points are separated by net run rate, then head-to-head.</span></p>
        </div>
      </section>
      <section className="competition-detail__section">
        <h2>Points system</h2>
        <div className="competition-detail__rules" aria-label="NPL Super40 points system">
          <div><strong>4</strong><span>Win</span></div>
          <div><strong>3</strong><span>Tie</span></div>
          <div><strong>2</strong><span>No result</span></div>
          <div><strong>0</strong><span>Loss</span></div>
        </div>
        <p>League standings use the Super40 playing conditions: points first, then net run rate, then head-to-head where necessary.</p>
      </section>
      <section className="competition-detail__section">
        <h2>Match standards</h2>
        <div className="competition-detail__facts">
          <p><strong>Powerplay</strong><span>Overs 1–10 allow two fielders outside the circle; overs 11–20 allow three; overs 21–40 allow five.</span></p>
          <p><strong>New ball</strong><span>Two new balls are used through 30 overs. The fielding captain selects one ball for both ends over the final 10 overs.</span></p>
          <p><strong>Player safety</strong><span>The ICC concussion-substitute protocol applies, with a like-for-like replacement approved by the Match Referee.</span></p>
          <p><strong>Scoring and care</strong><span>Each match uses dual scorers, a qualified first aider and an emergency action plan at the venue.</span></p>
        </div>
      </section>
    </>
  )
}

type CompetitionLeagueDetail = {
  seasons: Array<{
    id: number
    name: string
    slug: string
    status: string | null
  }>
}

type CompetitionMatchTab = 'fixtures' | 'results'

function matchTimeValue(match: MatchLite): number {
  const date = String(match.match_date ?? '').trim()
  const time = String(match.start_time ?? '').trim()
  const value = date ? `${date}${time ? `T${time}` : ''}` : time
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? match.id : parsed
}

function currentSeason(detail: CompetitionLeagueDetail | undefined) {
  const seasons = detail?.seasons ?? []
  return seasons.find((season) => ['active', 'current', 'live', 'in_progress'].includes((season.status ?? '').toLowerCase()))
    ?? seasons[0]
    ?? null
}

function CompetitionMatchTabs({ league, competitionTitle }: { league: LeagueLite | null; competitionTitle: string }) {
  const [activeTab, setActiveTab] = useState<CompetitionMatchTab>('fixtures')
  const { map: teamsMap } = useTeamsMap()
  const leagueDetailQ = useQuery({
    queryKey: ['competition-current-season', league?.slug],
    queryFn: () => fetchJson<CompetitionLeagueDetail>(`/public/leagues/${league?.slug}`),
    enabled: Boolean(league?.slug),
    retry: 1,
  })
  const season = currentSeason(leagueDetailQ.data)
  const seasonId = season?.id
  const fixturesQ = useQuery({
    queryKey: ['competition-current-fixtures', seasonId],
    queryFn: () => fetchAllPaginatedList<MatchLite>(
      (page) => `/public/fixtures?page=${page}&page_size=100&season_id=${seasonId}`,
    ),
    enabled: seasonId != null,
    retry: 1,
  })
  const resultsQ = useQuery({
    queryKey: ['competition-current-results', seasonId],
    queryFn: () => fetchAllPaginatedList<MatchLite>(
      (page) => `/public/results?page=${page}&page_size=100&season_id=${seasonId}`,
    ),
    enabled: seasonId != null,
    retry: 1,
  })

  const matches = useMemo(() => {
    const list = activeTab === 'fixtures' ? fixturesQ.data ?? [] : resultsQ.data ?? []
    return [...list]
      .sort((a, b) => activeTab === 'fixtures' ? matchTimeValue(a) - matchTimeValue(b) : matchTimeValue(b) - matchTimeValue(a))
      .slice(0, 8)
  }, [activeTab, fixturesQ.data, resultsQ.data])

  const activeQuery = activeTab === 'fixtures' ? fixturesQ : resultsQ
  const label = activeTab === 'fixtures' ? 'current fixtures' : 'current results'
  const seasonLink = league && season ? `/leagues/${league.slug}/seasons/${season.slug}` : null

  return (
    <section className="competition-detail__section competition-match-tabs" aria-labelledby="competition-match-tabs-title">
      <div className="competition-match-tabs__heading">
        <div>
          <h2 id="competition-match-tabs-title">Current fixtures and results</h2>
          <p>{season ? `${season.name} is the current ${competitionTitle} season.` : `The latest ${competitionTitle} schedule appears here once it is published.`}</p>
        </div>
        {seasonLink ? <a className="competition-detail__season-link" href={seasonLink}>View full season <span aria-hidden>→</span></a> : null}
      </div>
      <div className="competition-match-tabs__tablist" role="tablist" aria-label={`${competitionTitle} matches`}>
        <button type="button" role="tab" aria-selected={activeTab === 'fixtures'} className={activeTab === 'fixtures' ? 'is-active' : ''} onClick={() => setActiveTab('fixtures')}>Fixtures</button>
        <button type="button" role="tab" aria-selected={activeTab === 'results'} className={activeTab === 'results' ? 'is-active' : ''} onClick={() => setActiveTab('results')}>Results</button>
      </div>
      {leagueDetailQ.isLoading || activeQuery.isLoading ? <Spinner label={`Loading ${label}...`} /> : null}
      {leagueDetailQ.isError || activeQuery.isError ? <ErrorNotice message={`Could not load ${label}.`} /> : null}
      {!leagueDetailQ.isLoading && !leagueDetailQ.isError && !activeQuery.isLoading && !activeQuery.isError && matches.length === 0 ? (
        <EmptyState title={`No ${label} yet`} description={activeTab === 'fixtures' ? 'Check back once the next matches are published.' : 'Completed matches will appear here once results are published.'} />
      ) : null}
      {matches.length > 0 ? (
        <div className={`competition-match-tabs__grid competition-match-tabs__grid--${activeTab}`} role="tabpanel">
          {matches.map((match) => <MatchCard key={match.id} match={match} teamsMap={teamsMap} mode={activeTab === 'fixtures' ? 'fixture' : 'result'} compact />)}
        </div>
      ) : null}
    </section>
  )
}

function GeneralCompetitionDetails({ definition }: { definition: CompetitionDefinition }) {
  return (
    <section className="competition-detail__section">
      <h2>About this competition</h2>
      <p>{definition.description}</p>
      <p>
        Fixtures, results and standings appear here when the relevant season is published by NPL.
      </p>
    </section>
  )
}

function AgeGroupLeagues({ leagues }: { leagues: LeagueLite[] }) {
  const youthLeagues = leagues.filter((league) => league.category === 'youth')
  if (youthLeagues.length === 0) return null

  return (
    <section className="competition-detail__section">
      <h2>Age-group competitions</h2>
      <div className="competition-directory__grid competition-directory__grid--age-groups">
        {youthLeagues.map((league) => (
          <Link className="competition-card competition-card--compact" key={league.id} to="/leagues/$slug" params={{ slug: league.slug }}>
            <img className="competition-card__logo" src={resolveMediaUrl(league.logo_url) ?? nplLogoUrl} alt={`${league.name} logo`} />
            <span>{league.name}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function CompetitionDetailPage() {
  const { competitionSlug } = useParams({ from: '/competition/$competitionSlug' })
  const definition = competitions.find((competition) => competition.slug === competitionSlug)
  const leaguesQ = useCompetitionLeagues()
  const league = definition ? linkedLeague(definition, leaguesQ.data ?? []) : null

  if (!definition) {
    return <main className="container competition-detail"><h1>Competition not found</h1></main>
  }

  const seasonLink = league ? `/leagues/${league.slug}` : null
  const usesLogoOnlyHero = ['npl-t20-blast', 'npl-super40', 'npl-womens-super40'].includes(definition.slug)

  return (
    <>
      <SeoHead
        title={definition.title}
        description={definition.summary}
        canonicalPath={`/competition/${definition.slug}`}
        image={competitionLogo(definition, league)}
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Competitions', path: '/competition' },
          { name: definition.title, path: `/competition/${definition.slug}` },
        ]}
      />
      <PageHero
        title={usesLogoOnlyHero ? '' : definition.title}
        subtitle={usesLogoOnlyHero ? undefined : definition.summary}
        imageUrl={competitionLogo(definition, league)}
        titleAlign="center"
        className={usesLogoOnlyHero ? 'competition-detail__hero' : undefined}
        fallbackMode="none"
      />
      <main className="container competition-detail">
        <Breadcrumbs
          items={[
            { name: 'Home', path: '/' },
            { name: 'Competitions', path: '/competition' },
            { name: definition.title, path: `/competition/${definition.slug}` },
          ]}
        />
        <section className="competition-detail__intro">
          <img className={`competition-detail__logo competition-detail__logo--${definition.slug}`} src={competitionLogo(definition, league)} alt={`${definition.title} logo`} />
          <div>
            <p className="competition-card__eyebrow">{definition.eyebrow}</p>
            <h1>{definition.title}</h1>
            <p>{definition.description}</p>
            {seasonLink ? (
              <a className="competition-detail__season-link" href={seasonLink}>
                View fixtures, results and standings <span aria-hidden>→</span>
              </a>
            ) : null}
          </div>
        </section>
        {definition.slug === 'npl-t20-blast' ? <T20BlastDetails /> : null}
        {definition.slug === 'npl-super40' ? <Super40Details competition="men" /> : null}
        {definition.slug === 'npl-womens-super40' ? <Super40Details competition="women" /> : null}
        {definition.slug === 'npl-age-groups' ? <GeneralCompetitionDetails definition={definition} /> : null}
        {definition.slug === 'npl-t20-blast' || definition.slug === 'npl-super40' || definition.slug === 'npl-womens-super40' ? (
          <CompetitionMatchTabs league={league} competitionTitle={definition.title} />
        ) : null}
        {definition.slug === 'npl-age-groups' ? <AgeGroupLeagues leagues={leaguesQ.data ?? []} /> : null}
      </main>
    </>
  )
}
