import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import './App.css'
import { GalleryLightbox, type GalleryLightboxItem } from './components/GalleryLightbox'
import { MatchCarousel } from './components/MatchCarousel'
import { HomeNewsCarousel } from './components/HomeNewsCarousel'
import { SectionHeader } from './components/SectionHeader'
import { NplTvSection } from './components/NplTvSection'
import { SponsorMarquee } from './components/SponsorMarquee'
import {
  useLatestResults,
  useRecentNews,
  useTeamsMap,
  useUpcomingFixtures,
} from './lib/hooks'
import { formatCategoryLabel } from './lib/formatters'
import { matchSeoPath } from './lib/matchUrls'
import {
  extractList,
  fetchAllPaginatedList,
  fetchJson,
  resolveMediaUrl,
} from './lib/publicApi'

type GalleryItem = GalleryLightboxItem

type PublicSponsor = {
  id: number
  name: string
  image_url: string
  link_url: string | null
  team_id: number | null
  team_name: string | null
}

type HomeFixtureTab = 'matchday' | 'upcoming' | 'results'
type HomeFixtureCategory = 'all' | 'mens' | 'women' | 'youth'

type HomeHubMatch = {
  id: number
  category?: string | null
  status?: string | null
  match_date?: string | null
  start_time?: string | null
  venue?: string | null
  home_team_id: number
  away_team_id: number
  live_score_summary?: string | null
  live_status_line?: string | null
  live_match_cta?: string | null
}

type HomeSpotlightTeam = {
  id: number
  name: string
  slug: string
  category: string | null
  logo_url: string | null
}

type HomeSpotlightPlayer = {
  id: number
  full_name: string
  slug: string
  team_id: number | null
  category: string | null
  role: string | null
  profile_photo_url: string | null
}

type HomePlayerAppearance = {
  match_id: number
  match_date: string | null
  venue: string | null
  home_team_name: string
  away_team_name: string
  runs: number | null
  balls_faced: number | null
  fours: number | null
  sixes: number | null
  overs: number | string | null
  maidens: number | null
  runs_conceded: number | null
  wickets: number | null
  player_of_match: boolean
}

type HomeSpotlightMatch = HomeHubMatch & {
  result?: {
    winning_team_id?: number | null
    outcome?: string | null
    margin_text?: string | null
    score_summary?: string | null
  } | null
}

type TeamFormCode = 'W' | 'L' | 'T' | 'NR'


type HomeLiveBallEvent = {
  id: number
  innings: number
  over_number: number
  ball_number: number
  batting_team_id: number
  bowling_team_id: number
  runs_batter: number
  runs_extras: number
  extras_type: string | null
  is_legal_delivery: boolean
  wicket_type: string | null
  penalty_runs_batting?: number
  is_dead_ball?: boolean
  sequence_number: number
}

type HomeLiveInningsSummary = {
  innings: number
  batting_team_id: number
  bowling_team_id: number
  runs: number
  wickets: number
  legal_balls: number
  overs_label: string
  last_six: string[]
  last_event: HomeLiveBallEvent | null
}

type HomeLiveScoreState = {
  match_id: number
  status: string
  current_innings: number | null
  summaries: HomeLiveInningsSummary[]
  events: HomeLiveBallEvent[]
}

type HomeLiveCardText = {
  score: string
  status: string
}

const SPOTLIGHT_ROTATION_MS = 15 * 60 * 1000

function localTodayKey(): string {
  const today = new Date()

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-')
}

function matchDateKey(match: {
  match_date?: string | null
  start_time?: string | null
}): string {
  return String(match.match_date ?? match.start_time ?? '').slice(0, 10)
}

function matchTimeValue(match: {
  match_date?: string | null
  start_time?: string | null
}): number {
  const raw = match.start_time || match.match_date

  if (!raw) return Number.MAX_SAFE_INTEGER

  const value = raw.length <= 10 ? `${raw}T12:00:00` : raw
  const parsed = new Date(value).getTime()

  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed
}

function isLiveMatch(match: { status?: string | null }): boolean {
  return String(match.status ?? '').toLowerCase() === 'live'
}

function isTodayMatch(match: {
  match_date?: string | null
  start_time?: string | null
}): boolean {
  return matchDateKey(match) === localTodayKey()
}

function categoryGroup(category: string | null | undefined): HomeFixtureCategory {
  const value = String(category ?? '').trim().toLowerCase()

  if (value === 'mens' || value === 'men' || value === 'man') return 'mens'

  if (
    value === 'women' ||
    value === 'womens' ||
    value === 'woman' ||
    value === 'ladies' ||
    value === 'lady'
  ) {
    return 'women'
  }

  if (
    value === 'youth' ||
    value === 'youths' ||
    value === 'junior' ||
    value === 'juniors' ||
    value === 'u19' ||
    value === 'under-19' ||
    value === 'under 19'
  ) {
    return 'youth'
  }

  return 'all'
}

function categoryMatches(
  category: string | null | undefined,
  selected: HomeFixtureCategory,
): boolean {
  if (selected === 'all') return true
  return categoryGroup(category) === selected
}

function dateDifferenceFromToday(match: {
  match_date?: string | null
  start_time?: string | null
}): number | null {
  const key = matchDateKey(match)

  if (!key) return null

  const today = localTodayKey()
  const matchDate = new Date(`${key}T00:00:00`)
  const todayDate = new Date(`${today}T00:00:00`)
  const diff = matchDate.getTime() - todayDate.getTime()

  return Math.round(diff / 86_400_000)
}

function countdownLabel(
  tab: HomeFixtureTab,
  match: {
    status?: string | null
    match_date?: string | null
    start_time?: string | null
  },
): string {
  if (tab === 'results') return 'Latest result'
  if (isLiveMatch(match)) return 'Live now'

  const diff = dateDifferenceFromToday(match)

  if (diff == null) return 'Fixture scheduled'
  if (diff <= 0) return 'Starts today'
  if (diff === 1) return 'Starts tomorrow'

  return `Starts in ${diff} days`
}

function tabMatches(
  tab: HomeFixtureTab,
  match: {
    status?: string | null
    match_date?: string | null
    start_time?: string | null
  },
): boolean {
  if (tab === 'matchday') {
    return isLiveMatch(match) || isTodayMatch(match)
  }

  if (tab === 'upcoming') {
    if (isLiveMatch(match) || isTodayMatch(match)) return false

    const diff = dateDifferenceFromToday(match)

    return diff == null || diff > 0
  }

  return true
}

function fixtureHubEmptyTitle(tab: HomeFixtureTab): string {
  if (tab === 'matchday') return 'No matchday action right now'
  if (tab === 'results') return 'No results published yet'
  return 'No upcoming fixtures yet'
}

function fixtureHubEmptyBody(tab: HomeFixtureTab): string {
  if (tab === 'matchday') {
    return 'No live or today fixtures are listed. Check Next Up for upcoming matches.'
  }

  if (tab === 'results') {
    return 'Completed matches will appear here once results are published.'
  }

  return 'Fixtures will appear here once they are published.'
}

function formatHubDate(match: {
  match_date?: string | null
  start_time?: string | null
}): string {
  const key = matchDateKey(match)

  if (!key) return 'Date TBC'

  return new Intl.DateTimeFormat('en-ZW', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${key}T12:00:00`))
}

function teamInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}


function teamShortName(
  teamId: number | null | undefined,
  teamsMap: Record<number, { name?: string | null; short_name?: string | null } | undefined>,
): string {
  if (teamId == null) return 'Team'
  const team = teamsMap[teamId]
  const short = team?.short_name?.trim()
  if (short) return short
  const name = team?.name?.trim() || `Team ${teamId}`
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length <= 2) return name
  return words.map((word) => word[0]).join('').toUpperCase()
}

function teamFullName(
  teamId: number | null | undefined,
  teamsMap: Record<number, { name?: string | null } | undefined>,
): string {
  if (teamId == null) return 'Team'
  return teamsMap[teamId]?.name ?? `Team ${teamId}`
}

function ballsFromOversValue(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null
  const [oversPart, ballsPart = '0'] = raw.split('.')
  const overs = Number(oversPart)
  const balls = Number(ballsPart)
  if (!Number.isFinite(overs) || !Number.isFinite(balls)) return null
  return overs * 6 + Math.min(Math.max(0, Math.trunc(balls)), 5)
}

function homeMatchCentreHref(
  match: HomeHubMatch,
  homeName: string,
  awayName: string,
): string {
  return matchSeoPath({
    ...match,
    home_name: homeName,
    away_name: awayName,
  })
}

function liveCardText(
  match: HomeHubMatch,
  liveState: HomeLiveScoreState | undefined,
  teamsMap: Record<number, { name?: string | null; short_name?: string | null } | undefined>,
): HomeLiveCardText | null {
  if (!liveState || liveState.summaries.length === 0) return null

  const summaries = [...liveState.summaries].sort((a, b) => a.innings - b.innings)
  const score = summaries
    .map((summary) => {
      const name = teamShortName(summary.batting_team_id, teamsMap)
      return `${name} ${summary.runs}/${summary.wickets} (${summary.overs_label} ov)`
    })
    .join(' · ')

  const current =
    summaries.find((summary) => summary.innings === liveState.current_innings) ??
    summaries[summaries.length - 1]!

  let status = current
    ? `${teamFullName(current.batting_team_id, teamsMap)} batting`
    : 'Live scoring in progress'

  if (summaries.length >= 2) {
    const first = summaries[0]!
    const second = summaries[1]!
    const target = first.runs + 1
    const required = Math.max(0, target - second.runs)
    const allottedBalls = ballsFromOversValue((match as { match_overs?: string | number | null }).match_overs) ?? 240
    const remainingBalls = Math.max(0, allottedBalls - second.legal_balls)

    status = required > 0
      ? `${teamFullName(second.batting_team_id, teamsMap)} require ${required} runs in ${remainingBalls} balls`
      : `${teamFullName(second.batting_team_id, teamsMap)} have reached the target`
  }

  return { score, status }
}

function teamHasMatch(teamId: number, match: HomeHubMatch): boolean {
  return match.home_team_id === teamId || match.away_team_id === teamId
}

function opponentName(
  teamId: number,
  match: HomeHubMatch,
  teamsMap: Record<number, { name?: string | null }>,
): string {
  const opponentId =
    match.home_team_id === teamId ? match.away_team_id : match.home_team_id

  return teamsMap[opponentId]?.name ?? `Team ${opponentId}`
}

function teamOutcome(match: HomeSpotlightMatch, teamId: number): TeamFormCode {
  const outcome = String(match.result?.outcome ?? '').trim().toLowerCase()

  if (outcome === 'tie') return 'T'
  if (outcome === 'no_result') return 'NR'

  const winnerId = match.result?.winning_team_id ?? null

  if (winnerId === teamId) return 'W'
  if (winnerId != null) return 'L'

  return 'NR'
}

function teamResultLine(
  match: HomeSpotlightMatch | undefined,
  teamId: number,
  teamsMap: Record<number, { name?: string | null }>,
): string {
  if (!match) return 'No recent result yet'

  const outcome = teamOutcome(match, teamId)
  const opponent = opponentName(teamId, match, teamsMap)
  const margin = match.result?.margin_text?.trim()

  if (outcome === 'W') {
    return `Beat ${opponent}${margin ? ` · ${margin}` : ''}`
  }

  if (outcome === 'L') {
    return `Lost to ${opponent}${margin ? ` · ${margin}` : ''}`
  }

  if (outcome === 'T') {
    return `Tied with ${opponent}${margin ? ` · ${margin}` : ''}`
  }

  return `No result vs ${opponent}`
}

function categoryFixturesHref(category: string | null | undefined): string {
  const group = categoryGroup(category)

  if (group === 'mens') return '/mens/fixtures'
  if (group === 'women') return '/women/fixtures'
  if (group === 'youth') return '/youth/fixtures'

  return '/fixtures'
}

function categoryResultsHref(category: string | null | undefined): string {
  const group = categoryGroup(category)

  if (group === 'mens') return '/mens/results'
  if (group === 'women') return '/women/results'
  if (group === 'youth') return '/youth/results'

  return '/results'
}

function statNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function appearanceDateValue(appearance: HomePlayerAppearance): number {
  const raw = appearance.match_date

  if (!raw) return Number.MIN_SAFE_INTEGER

  const parsed = new Date(raw.length <= 10 ? `${raw}T12:00:00` : raw).getTime()

  return Number.isNaN(parsed) ? Number.MIN_SAFE_INTEGER : parsed
}

function playerRoleLabel(player: HomeSpotlightPlayer): string {
  const role = player.role?.trim()

  return role || 'Cricketer'
}

function playerAppearanceTitle(appearance: HomePlayerAppearance | undefined): string {
  if (!appearance) return 'No scorecard appearance yet'

  return `${appearance.home_team_name} vs ${appearance.away_team_name}`
}

function recentPlayerImpactLine(
  appearance: HomePlayerAppearance | undefined,
): string {
  if (!appearance) return 'Waiting for scorecard data'

  const runs = statNumber(appearance.runs)
  const balls = statNumber(appearance.balls_faced)
  const wickets = statNumber(appearance.wickets)
  const runsConceded = statNumber(appearance.runs_conceded)
  const overs = appearance.overs
  const pieces: string[] = []

  if (appearance.player_of_match) pieces.push('Player of the match')
  if (runs > 0 || balls > 0) pieces.push(`${runs} off ${balls}`)
  if (wickets > 0 || overs != null) {
    pieces.push(`${wickets}/${runsConceded}${overs != null ? ` in ${overs} ov` : ''}`)
  }

  return pieces.length > 0 ? pieces.join(' · ') : 'Played'
}

function battingAppearanceLine(
  appearance: HomePlayerAppearance | undefined,
): string {
  if (!appearance) return 'No batting line yet'

  const runs = statNumber(appearance.runs)
  const balls = statNumber(appearance.balls_faced)

  if (runs === 0 && balls === 0) return 'No batting line yet'

  const fours = statNumber(appearance.fours)
  const sixes = statNumber(appearance.sixes)
  const boundaryBits: string[] = []

  if (fours > 0) boundaryBits.push(`${fours}x4`)
  if (sixes > 0) boundaryBits.push(`${sixes}x6`)

  return `${runs} off ${balls}${boundaryBits.length > 0 ? ` · ${boundaryBits.join(' · ')}` : ''}`
}

function bowlingAppearanceLine(
  appearance: HomePlayerAppearance | undefined,
): string {
  if (!appearance) return 'No bowling line yet'

  const wickets = statNumber(appearance.wickets)
  const runsConceded = statNumber(appearance.runs_conceded)
  const overs = appearance.overs

  if (wickets === 0 && runsConceded === 0 && overs == null) {
    return 'No bowling line yet'
  }

  return `${wickets}/${runsConceded}${overs != null ? ` in ${overs} ov` : ''}`
}

function App() {
  const { data: newsArticles = [] } = useRecentNews(36)
  const { data: upcomingFixtures = [] } = useUpcomingFixtures(undefined, 80)
  const { data: latestResults = [] } = useLatestResults(undefined, 80)
  const { map: teamsMap } = useTeamsMap()

  const liveFixtureIds = useMemo(
    () =>
      upcomingFixtures
        .filter((match) => isLiveMatch(match))
        .map((match) => match.id)
        .filter((id): id is number => Number.isFinite(id)),
    [upcomingFixtures],
  )

  const { data: liveScoresByMatchId = {} } = useQuery({
    queryKey: ['home-live-fixture-scores', liveFixtureIds.join(',')],
    queryFn: async () => {
      const pairs = await Promise.all(
        liveFixtureIds.map(async (id) => {
          try {
            const state = await fetchJson<HomeLiveScoreState>(`/public/matches/${id}/live`)
            return [id, state] as const
          } catch {
            return [id, undefined] as const
          }
        }),
      )

      return Object.fromEntries(
        pairs.filter((pair): pair is readonly [number, HomeLiveScoreState] => Boolean(pair[1])),
      ) as Record<number, HomeLiveScoreState>
    },
    enabled: liveFixtureIds.length > 0,
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    retry: 1,
  })

  const { data: spotlightTeams = [] } = useQuery({
    queryKey: ['home-team-spotlight-teams'],
    queryFn: async () =>
      fetchAllPaginatedList<HomeSpotlightTeam>(
        (page) => `/public/teams?page=${page}&page_size=100`,
      ),
    retry: 1,
  })

  const { data: spotlightPlayers = [] } = useQuery({
    queryKey: ['home-player-spotlight-players'],
    queryFn: async () =>
      fetchAllPaginatedList<HomeSpotlightPlayer>(
        (page) => `/public/players?page=${page}&page_size=100`,
      ),
    retry: 1,
  })

  const { data: gallery = [] } = useQuery({
    queryKey: ['home-gallery'],
    queryFn: async () =>
      extractList<GalleryItem>(
        await fetchJson<unknown>('/public/gallery?page=1&page_size=6'),
      ),
    retry: 1,
  })

  const { data: sponsors = [] } = useQuery({
    queryKey: ['home-sponsors'],
    queryFn: async () =>
      fetchAllPaginatedList<PublicSponsor>(
        (page) => `/public/sponsors?page=${page}&page_size=24`,
      ),
    retry: 1,
  })

  const homepageSponsors = sponsors.filter((sponsor) => sponsor.team_id == null)

  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [galleryActive, setGalleryActive] = useState<GalleryItem | null>(null)
  const [galleryWindowIndex, setGalleryWindowIndex] = useState(0)
  const [spotlightNow, setSpotlightNow] = useState(() => Date.now())
  const [skippedSpotlightPlayerIds, setSkippedSpotlightPlayerIds] = useState<
  Set<number>
>(() => new Set())
  const [fixtureTab, setFixtureTab] = useState<HomeFixtureTab>('matchday')
  const [fixtureCategory, setFixtureCategory] =
    useState<HomeFixtureCategory>('all')

  const heroSlides = useMemo(
    () =>
      newsArticles.map((article) => ({
        ...article,
        heroImage: resolveMediaUrl(article.featured_image_url),
      })),
    [newsArticles],
  )

  const fixtureTabs: { id: HomeFixtureTab; label: string }[] = [
    { id: 'matchday', label: 'Matchday' },
    { id: 'upcoming', label: 'Next Up' },
    { id: 'results', label: 'Results' },
  ]

  const fixtureCategories: { id: HomeFixtureCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'mens', label: 'Mens' },
    { id: 'women', label: 'Women' },
    { id: 'youth', label: 'Youth' },
  ]

  const spotlightSlot = Math.floor(spotlightNow / SPOTLIGHT_ROTATION_MS)

  const sortedSpotlightTeams = useMemo(
    () => [...spotlightTeams].sort((a, b) => a.name.localeCompare(b.name)),
    [spotlightTeams],
  )

  const spotlightEligibleTeamIds = useMemo(() => {
  const publicActiveTeamIds = new Set(sortedSpotlightTeams.map((team) => team.id))
  const playedTeamIds = new Set<number>()

  for (const match of latestResults) {
    if (publicActiveTeamIds.has(match.home_team_id)) {
      playedTeamIds.add(match.home_team_id)
    }

    if (publicActiveTeamIds.has(match.away_team_id)) {
      playedTeamIds.add(match.away_team_id)
    }
  }

  return playedTeamIds
}, [latestResults, sortedSpotlightTeams])

const activeSpotlightPlayers = useMemo(
  () =>
    spotlightPlayers
      .filter(
        (player) =>
          player.team_id != null && spotlightEligibleTeamIds.has(player.team_id),
      )
      .sort((a, b) => a.full_name.localeCompare(b.full_name)),
  [spotlightEligibleTeamIds, spotlightPlayers],
)


  const spotlightTeamCandidates = useMemo(() => {
  const playedTeams = sortedSpotlightTeams.filter((team) =>
    spotlightEligibleTeamIds.has(team.id),
  )

  return playedTeams.length > 0 ? playedTeams : sortedSpotlightTeams
}, [sortedSpotlightTeams, spotlightEligibleTeamIds])

const selectedSpotlightTeam = useMemo(() => {
  if (spotlightTeamCandidates.length === 0) return null

  return spotlightTeamCandidates[spotlightSlot % spotlightTeamCandidates.length]
}, [spotlightSlot, spotlightTeamCandidates])
  
  const fixtureHubMatches = useMemo(() => {
    const source = fixtureTab === 'results' ? latestResults : upcomingFixtures

    return source
      .filter((match) => tabMatches(fixtureTab, match))
      .filter((match) => categoryMatches(match.category, fixtureCategory))
      .slice(0, 12)
      .map((match) => {
        if (!isLiveMatch(match)) return match

        const liveText = liveCardText(
          match as HomeHubMatch,
          liveScoresByMatchId[match.id],
          teamsMap,
        )

        if (!liveText) return match

        return {
          ...match,
          live_score_summary: liveText.score,
          live_status_line: liveText.status,
          live_match_cta: 'Live scorecard',
        }
      })
  }, [
    fixtureCategory,
    fixtureTab,
    latestResults,
    liveScoresByMatchId,
    teamsMap,
    upcomingFixtures,
  ])

  const featuredHubMatch = fixtureHubMatches[0] as HomeHubMatch | undefined
  const fixtureHubMode = fixtureTab === 'results' ? 'result' : 'fixture'
  const fixtureHubTitle =
    fixtureTabs.find((tab) => tab.id === fixtureTab)?.label ?? 'Fixtures'

  const featuredHomeName =
    featuredHubMatch != null
      ? teamsMap[featuredHubMatch.home_team_id]?.name ??
        `Team ${featuredHubMatch.home_team_id}`
      : ''

  const featuredAwayName =
    featuredHubMatch != null
      ? teamsMap[featuredHubMatch.away_team_id]?.name ??
        `Team ${featuredHubMatch.away_team_id}`
      : ''

  const featuredLiveText =
    featuredHubMatch != null && isLiveMatch(featuredHubMatch)
      ? liveCardText(featuredHubMatch, liveScoresByMatchId[featuredHubMatch.id], teamsMap)
      : null

  const featuredMatchCentreHref = featuredHubMatch
    ? homeMatchCentreHref(featuredHubMatch, featuredHomeName, featuredAwayName)
    : '/fixtures'

  const spotlightNextFixture = useMemo(() => {
    if (!selectedSpotlightTeam) return undefined

    return [...upcomingFixtures]
      .filter((match) => teamHasMatch(selectedSpotlightTeam.id, match))
      .sort((a, b) => matchTimeValue(a) - matchTimeValue(b))[0] as
      | HomeSpotlightMatch
      | undefined
  }, [selectedSpotlightTeam, upcomingFixtures])

  const spotlightLatestResult = useMemo(() => {
    if (!selectedSpotlightTeam) return undefined

    return latestResults.find((match) =>
      teamHasMatch(selectedSpotlightTeam.id, match),
    ) as HomeSpotlightMatch | undefined
  }, [latestResults, selectedSpotlightTeam])

  const spotlightForm = useMemo(() => {
    if (!selectedSpotlightTeam) return []

    return latestResults
      .filter((match) => teamHasMatch(selectedSpotlightTeam.id, match))
      .slice(0, 5)
      .map((match) => teamOutcome(match as HomeSpotlightMatch, selectedSpotlightTeam.id))
  }, [latestResults, selectedSpotlightTeam])

  const spotlightLogo = selectedSpotlightTeam
    ? resolveMediaUrl(selectedSpotlightTeam.logo_url)
    : null

  const playerSpotlightSlot = spotlightSlot

  const selectedSpotlightPlayer = useMemo(() => {
  const candidates = activeSpotlightPlayers.filter(
    (player) => !skippedSpotlightPlayerIds.has(player.id),
  )

  if (candidates.length === 0) return null

  return candidates[playerSpotlightSlot % candidates.length]
}, [activeSpotlightPlayers, playerSpotlightSlot, skippedSpotlightPlayerIds])

  const spotlightPlayerTeam = selectedSpotlightPlayer
    ? sortedSpotlightTeams.find((team) => team.id === selectedSpotlightPlayer.team_id) ??
      null
    : null

  const spotlightPlayerTeamName =
    selectedSpotlightPlayer != null
      ? spotlightPlayerTeam?.name ??
        teamsMap[selectedSpotlightPlayer.team_id ?? -1]?.name ??
        'Active team'
      : ''

  const spotlightPlayerPhoto = selectedSpotlightPlayer
    ? resolveMediaUrl(selectedSpotlightPlayer.profile_photo_url)
    : null

  const spotlightPlayerAppearancesQ = useQuery({
    queryKey: [
      'home-player-spotlight-appearances',
      selectedSpotlightPlayer?.slug ?? 'none',
    ],
    queryFn: () =>
      fetchJson<HomePlayerAppearance[]>(
        `/public/players/${selectedSpotlightPlayer?.slug}/match-appearances`,
      ),
    enabled: Boolean(selectedSpotlightPlayer?.slug),
    retry: 1,
  })

  const spotlightPlayerAppearances = useMemo(
    () =>
      [...(spotlightPlayerAppearancesQ.data ?? [])].sort(
        (a, b) => appearanceDateValue(b) - appearanceDateValue(a),
      ),
    [spotlightPlayerAppearancesQ.data],
  )

  const spotlightRecentAppearance = spotlightPlayerAppearances[0]
  const spotlightBestBatting = useMemo(
    () =>
      spotlightPlayerAppearances
        .filter(
          (appearance) =>
            statNumber(appearance.runs) > 0 || statNumber(appearance.balls_faced) > 0,
        )
        .sort(
          (a, b) =>
            statNumber(b.runs) - statNumber(a.runs) ||
            statNumber(b.sixes) - statNumber(a.sixes) ||
            statNumber(b.fours) - statNumber(a.fours) ||
            statNumber(a.balls_faced) - statNumber(b.balls_faced),
        )[0],
    [spotlightPlayerAppearances],
  )

  const spotlightBestBowling = useMemo(
    () =>
      spotlightPlayerAppearances
        .filter(
          (appearance) =>
            statNumber(appearance.wickets) > 0 ||
            appearance.overs != null ||
            statNumber(appearance.runs_conceded) > 0,
        )
        .sort(
          (a, b) =>
            statNumber(b.wickets) - statNumber(a.wickets) ||
            statNumber(a.runs_conceded) - statNumber(b.runs_conceded) ||
            statNumber(b.maidens) - statNumber(a.maidens),
        )[0],
    [spotlightPlayerAppearances],
  )

  useEffect(() => {
    const timer = globalThis.setInterval(() => {
      setSpotlightNow(Date.now())
    }, 60_000)

    return () => globalThis.clearInterval(timer)
  }, [])

  useEffect(() => {
  setSkippedSpotlightPlayerIds(new Set())
}, [playerSpotlightSlot, activeSpotlightPlayers.length])

useEffect(() => {
  if (!selectedSpotlightPlayer) return
  if (spotlightPlayerAppearancesQ.isLoading || spotlightPlayerAppearancesQ.isFetching) {
    return
  }

  const appearances = spotlightPlayerAppearancesQ.data ?? []

  if (appearances.length > 0) return
  if (activeSpotlightPlayers.length <= skippedSpotlightPlayerIds.size + 1) return

  setSkippedSpotlightPlayerIds((current) => {
    if (current.has(selectedSpotlightPlayer.id)) return current

    const next = new Set(current)
    next.add(selectedSpotlightPlayer.id)
    return next
  })
}, [
  activeSpotlightPlayers.length,
  selectedSpotlightPlayer,
  skippedSpotlightPlayerIds.size,
  spotlightPlayerAppearancesQ.data,
  spotlightPlayerAppearancesQ.isFetching,
  spotlightPlayerAppearancesQ.isLoading,
])

  useEffect(() => {
    if (heroSlides.length < 2) return

    const timer = globalThis.setInterval(() => {
      setActiveSlideIndex((current) => (current + 1) % heroSlides.length)
    }, 5000)

    return () => globalThis.clearInterval(timer)
  }, [heroSlides.length])

const galleryShowcaseItems = useMemo(() => {
  if (gallery.length <= 4) return gallery

  return Array.from({ length: 4 }, (_, index) => {
    return gallery[(galleryWindowIndex + index) % gallery.length]
  })
}, [gallery, galleryWindowIndex])

useEffect(() => {
  if (gallery.length <= 4) return

  const timer = globalThis.setInterval(() => {
    setGalleryWindowIndex((current) => (current + 1) % gallery.length)
  }, 5 * 60 * 1000)

  return () => globalThis.clearInterval(timer)
}, [gallery.length])
  
  const currentSlideIndex =
    heroSlides.length > 0 ? activeSlideIndex % heroSlides.length : 0
  
  return (
    <main className="container">
      <section className="hero-carousel" aria-label="Latest news highlights">
        {heroSlides.length > 0 ? (
          <>
            {heroSlides.map((slide, index) => {
              const isActive = index === currentSlideIndex

  

              return (
                <article
                  key={slide.id}
                  className={`hero-slide${isActive ? ' is-active' : ''}`}
                  aria-hidden={!isActive}
                >
                  {slide.heroImage ? (
                    <img src={slide.heroImage} alt={slide.title} />
                  ) : null}

                  <div className="hero-slide-overlay">
                    <p className="hero-slide-eyebrow">Latest News</p>
                    <h2>{slide.title}</h2>
                    <p>
                      {slide.excerpt ??
                        'Catch up on the latest match analysis and updates.'}
                    </p>

                    {slide.slug ? (
                      <Link
                        to="/news/$slug"
                        params={{ slug: slide.slug }}
                        className="hero-readmore-btn"
                      >
                        Read More
                      </Link>
                    ) : null}
                  </div>
                </article>
              )
            })}

            {heroSlides.length > 1 ? (
              <div className="hero-carousel-dots" aria-hidden="true">
                {heroSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    className={`hero-carousel-dot${
                      index === currentSlideIndex ? ' is-active' : ''
                    }`}
                    onClick={() => setActiveSlideIndex(index)}
                  >
                    <span className="sr-only">Show slide {index + 1}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <article className="hero-slide is-active">
            <div className="hero-slide-overlay">
              <p className="hero-slide-eyebrow">Latest News</p>
              <h2>No published news yet</h2>
              <p>
                Add and publish a news article with a featured image to populate
                this carousel.
              </p>
            </div>
          </article>
        )}
      </section>

      <section className="home-section home-fixture-hub home-fixture-hub--premium">
        <div className="home-fixture-hub__topline">
          <div>
            <p className="home-fixture-hub__eyebrow">Match centre</p>
            <h2>Fixture Hub</h2>
          </div>

          <Link
            to={fixtureTab === 'results' ? '/results' : '/fixtures'}
            className="home-fixture-hub__main-link"
          >
            {fixtureTab === 'results' ? 'All results' : 'All fixtures'}
          </Link>
        </div>

        <div className="home-fixture-hub__layout">
          <div className="home-fixture-hub__feature">
            {featuredHubMatch ? (
              <>
                <div className="home-fixture-hub__countdown">
                  {countdownLabel(fixtureTab, featuredHubMatch)}
                </div>

                <div className="home-fixture-hub__teams">
                  <strong>{featuredHomeName}</strong>
                  <span>vs</span>
                  <strong>{featuredAwayName}</strong>
                </div>

                <div className="home-fixture-hub__meta">
                  <span>{formatHubDate(featuredHubMatch)}</span>
                  <span>{featuredHubMatch.venue || 'Venue TBC'}</span>
                </div>

                {featuredLiveText ? (
                  <div className="home-fixture-hub__live-score">
                    <span>Live score</span>
                    <strong>{featuredLiveText.score}</strong>
                    <p>{featuredLiveText.status}</p>
                  </div>
                ) : null}

                <a
                  href={
                    featuredLiveText
                      ? featuredMatchCentreHref
                      : fixtureTab === 'results'
                        ? '/results'
                        : '/fixtures'
                  }
                  className="home-fixture-hub__feature-link"
                >
                  {featuredLiveText
                    ? 'Open live scorecard'
                    : fixtureTab === 'results'
                      ? 'View results'
                      : 'View fixtures'}
                </a>
              </>
            ) : (
              <>
                <div className="home-fixture-hub__countdown">
                  {fixtureHubTitle}
                </div>

                <div className="home-fixture-hub__teams">
                  <strong>{fixtureHubEmptyTitle(fixtureTab)}</strong>
                </div>

                <p className="home-fixture-hub__empty-copy">
                  {fixtureHubEmptyBody(fixtureTab)}
                </p>

                <Link
                  to={fixtureTab === 'results' ? '/results' : '/fixtures'}
                  className="home-fixture-hub__feature-link"
                >
                  {fixtureTab === 'results' ? 'View results' : 'View fixtures'}
                </Link>
              </>
            )}
          </div>

          <div className="home-fixture-hub__side">
            <div className="home-fixture-hub__tabs" aria-label="Fixture hub tabs">
              {fixtureTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={fixtureTab === tab.id ? 'is-active' : ''}
                  onClick={() => setFixtureTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div
              className="home-fixture-hub__categories"
              aria-label="Fixture category filter"
            >
              {fixtureCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={fixtureCategory === category.id ? 'is-active' : ''}
                  onClick={() => setFixtureCategory(category.id)}
                >
                  {category.label}
                </button>
              ))}
            </div>

            <p className="home-fixture-hub__hint">
              Switch tabs and categories to quickly find the games that matter.
            </p>
          </div>
        </div>

        {fixtureHubMatches.length > 0 ? (
          <div className="home-fixture-hub__carousel">
            <MatchCarousel
              title={fixtureHubTitle}
              linkTo={fixtureTab === 'results' ? '/results' : '/fixtures'}
              matches={fixtureHubMatches}
              teamsMap={teamsMap}
              mode={fixtureHubMode}
              showHeader={false}
            />
          </div>
        ) : null}
      </section>

      <HomeNewsCarousel articles={newsArticles} />

      {selectedSpotlightTeam ? (
        <section className="home-section home-team-spotlight">
          <div className="home-team-spotlight__head">
            <div>
              <p className="home-team-spotlight__eyebrow">Team spotlight</p>
              <h2>Follow a Club</h2>
              <p>See your favourite team's form, next fixture and latest result.</p>
            </div>

            
          </div>

          <div className="home-team-spotlight__card">
            <div className="home-team-spotlight__identity">
              <div className="home-team-spotlight__badge">
                {spotlightLogo ? (
                  <img src={spotlightLogo} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span>{teamInitials(selectedSpotlightTeam.name)}</span>
                )}
              </div>

              <div>
                <p>{formatCategoryLabel(selectedSpotlightTeam.category ?? '')}</p>
                <h3>{selectedSpotlightTeam.name}</h3>
              </div>
            </div>

            <div className="home-team-spotlight__form">
              <span>Recent form</span>

              <div>
                {spotlightForm.length > 0 ? (
                  spotlightForm.map((code, index) => (
                    <strong
                      key={`${code}-${index}`}
                      className={`home-team-spotlight__form-pill home-team-spotlight__form-pill--${code.toLowerCase()}`}
                    >
                      {code}
                    </strong>
                  ))
                ) : (
                  <em>No recent form</em>
                )}
              </div>
            </div>

            <div className="home-team-spotlight__facts">
              <article>
                <span>Next fixture</span>
                <strong>
                  {spotlightNextFixture
                    ? `${selectedSpotlightTeam.name} vs ${opponentName(
                        selectedSpotlightTeam.id,
                        spotlightNextFixture,
                        teamsMap,
                      )}`
                    : 'No upcoming fixture'}
                </strong>
                <p>
                  {spotlightNextFixture
                    ? `${formatHubDate(spotlightNextFixture)} · ${
                        spotlightNextFixture.venue || 'Venue TBC'
                      }`
                    : 'Check the fixtures page for future updates.'}
                </p>
              </article>

              <article>
                <span>Latest result</span>
                <strong>
                  {teamResultLine(
                    spotlightLatestResult,
                    selectedSpotlightTeam.id,
                    teamsMap,
                  )}
                </strong>
                <p>
                  {spotlightLatestResult?.result?.score_summary ??
                    'Results will appear once published.'}
                </p>
              </article>
            </div>

            <div className="home-team-spotlight__links">
              <Link
                to="/teams/$slug"
                params={{ slug: selectedSpotlightTeam.slug }}
              >
                Team page
              </Link>
              <a href={categoryFixturesHref(selectedSpotlightTeam.category)}>
                Fixtures
              </a>
              <a href={categoryResultsHref(selectedSpotlightTeam.category)}>
                Results
              </a>
            </div>
          </div>
        </section>
      ) : null}

      {selectedSpotlightPlayer ? (
        <section className="home-section home-player-spotlight">
          <div className="home-player-spotlight__media">
            {spotlightPlayerPhoto ? (
              <img
                src={spotlightPlayerPhoto}
                alt=""
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span>{teamInitials(selectedSpotlightPlayer.full_name)}</span>
            )}
          </div>

          <div className="home-player-spotlight__body">
            <div className="home-player-spotlight__head">
              <div>
                <p className="home-player-spotlight__eyebrow">Player spotlight</p>
                <h2>{selectedSpotlightPlayer.full_name}</h2>
                <p>
                  {spotlightPlayerTeamName} ·{' '}
                  {formatCategoryLabel(
                    selectedSpotlightPlayer.category ??
                      spotlightPlayerTeam?.category ??
                      '',
                  )}{' '}
                  · {playerRoleLabel(selectedSpotlightPlayer)}
                </p>
              </div>

              
            </div>

            <div className="home-player-spotlight__stats">
              <article>
                <span>Recent impact</span>
                <strong>{recentPlayerImpactLine(spotlightRecentAppearance)}</strong>
                <p>{playerAppearanceTitle(spotlightRecentAppearance)}</p>
              </article>

              <article>
                <span>Best batting</span>
                <strong>{battingAppearanceLine(spotlightBestBatting)}</strong>
                <p>{playerAppearanceTitle(spotlightBestBatting)}</p>
              </article>

              <article>
                <span>Best bowling</span>
                <strong>{bowlingAppearanceLine(spotlightBestBowling)}</strong>
                <p>{playerAppearanceTitle(spotlightBestBowling)}</p>
              </article>
            </div>

            <div className="home-player-spotlight__links">
              <Link
                to="/players/$slug"
                params={{ slug: selectedSpotlightPlayer.slug }}
              >
                View player profile
              </Link>
              {spotlightPlayerTeam ? (
                <Link to="/teams/$slug" params={{ slug: spotlightPlayerTeam.slug }}>
                  View team
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <NplTvSection />

  <section className="home-section home-gallery-wall">
  <SectionHeader title="Gallery Preview" linkTo="/gallery" />

  <div className="home-gallery-wall__grid">
    {galleryShowcaseItems.map((item, index) => {
      const imageUrl = resolveMediaUrl(item.thumbnail_url ?? item.file_url)

      if (!imageUrl) return null

      return (
        <button
          key={`${item.id}-${galleryWindowIndex}`}
          type="button"
          className={`home-gallery-wall__item home-gallery-wall__item--${index + 1}`}
          onClick={() => setGalleryActive(item)}
          aria-label={`Open gallery image: ${item.title}`}
        >
          <img src={imageUrl} alt="" loading="lazy" decoding="async" />
        </button>
      )
    })}
  </div>
</section>

      <SponsorMarquee sponsors={homepageSponsors} />

      <GalleryLightbox
        active={galleryActive}
        onClose={() => setGalleryActive(null)}
      />
    </main>
  )
}

export default App
