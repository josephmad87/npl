import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import nplLogoUrl from './assets/logo.png'
import { ErrorNotice } from './components/ErrorNotice'
import { publicDisplayMatchStatus } from './lib/matchStatus'
import { InningsScorecardPanels } from './components/InningsScorecardPanels'
import { SocialShareButtons } from './components/SocialShareButtons'
import { Spinner } from './components/Spinner'
import { getInningsSides, oversFieldToBalls, type InningsNumber } from './lib/cricket'
import { formatCategoryLabel, formatMatchDate } from './lib/formatters'
import { type MatchLite, useTeamsMap } from './lib/hooks'
import {
  matchResultSummaryLine,
  matchWinnerSide,
} from './lib/match-result'
import { formatExtrasBreakdown } from './lib/match-extras'
import { fetchAllPaginatedList, fetchJson, postJson, resolveMediaUrl } from './lib/publicApi'

type MatchResultDetail = {
  winning_team_id: number | null
  batting_first_team_id: number | null
  margin_text: string | null
  score_summary: string | null
  innings_breakdown: string | null
  top_performers: string | null
  player_of_match_player_id: number | null
  match_report: string | null
  home_extras_wides?: number
  home_extras_byes?: number
  home_extras_no_balls?: number
  home_extras_leg_byes?: number
  away_extras_wides?: number
  away_extras_byes?: number
  away_extras_no_balls?: number
  away_extras_leg_byes?: number
}

type MatchPlayerStat = {
  id: number
  lineup_order?: number
  batting_order?: number | null
  bowling_order?: number | null
  player_id: number
  team_id: number
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  dismissal: string | null
  overs: string | number | null
  maidens: number
  runs_conceded: number
  wickets: number
  catches: number
  stumpings: number
  run_outs: number
  notes: string | null
}

type MatchDetail = {
  id: number
  season_id: number | null
  category: string
  home_team_id: number
  away_team_id: number
  title: string | null
  venue: string | null
  match_date: string | null
  start_time: string | null
  toss_info: string | null
  umpires: string | null
  description: string | null
  status: string
  result: MatchResultDetail | null
  player_stats: MatchPlayerStat[]
  season: {
    id: number
    league_id: number
    name: string
    slug: string
    league: { id: number; name: string; slug: string }
  } | null
}

type PublicPlayerRow = { id: number; full_name: string; slug?: string | null }

type FanPlayerVoteChoice = {
  player_id: number
  player_name: string
  team_id: number
  votes: number
  percentage: number
}

type FanPlayerVoteSummary = {
  match_id: number
  eligible: boolean
  reason: string | null
  total_votes: number
  voter_player_id: number | null
  choices: FanPlayerVoteChoice[]
}

type TopPerformerCard = {
  id: string
  title: string
  playerId: number
  teamId: number
  focus: 'batting' | 'bowling'
  playerName: string
  teamName: string
  mainLine: string
  subLine: string
}

type PlayerMatchupOption = {
  stat: MatchPlayerStat
  playerName: string
  teamName: string
}

type PlayerMatchupRow = {
  label: string
  homeValue: string | number
  awayValue: string | number
}


const NO_PLAYER_STATS: MatchPlayerStat[] = []

function formatMatchReportContent(report: string | null | undefined): {
  headline: string
  paragraphs: string[]
} | null {
  const clean = report?.trim()

  if (!clean) return null

  const blocks = clean
    .split(/\n+/)
    .map((block) => block.trim())
    .filter(Boolean)

  if (blocks.length >= 2) {
    return {
      headline: blocks[0].replace(/^#+\s*/, ''),
      paragraphs: blocks.slice(1),
    }
  }

  return {
    headline: 'Match Report',
    paragraphs: blocks,
  }
}

function getFanVoterKey(): string {
  if (typeof window === 'undefined') return ''

  const storageKey = 'npl_fan_player_vote_key'
  const existing = window.localStorage.getItem(storageKey)

  if (existing) return existing

  const next =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`

  window.localStorage.setItem(storageKey, next)

  return next
}

function formatTopPerformerStrikeRate(runs: number, balls: number): string {
  if (balls <= 0) return '—'
  return ((runs * 100) / balls).toFixed(2)
}

function formatTopPerformerEconomy(
  runsConceded: number,
  overs: string | number | null,
): string {
  const balls = oversFieldToBalls(overs)
  if (balls <= 0) return '—'
  return ((runsConceded * 6) / balls).toFixed(2)
}

function formatTopPerformerOvers(overs: string | number | null): string {
  if (overs == null || overs === '') return '—'
  return String(overs)
}

function topPerformerTeamName(
  teamId: number,
  homeTeamId: number,
  awayTeamId: number,
  homeName: string,
  awayName: string,
): string {
  if (teamId === homeTeamId) return homeName
  if (teamId === awayTeamId) return awayName
  return `Team #${teamId}`
}

function fieldingTotal(stat: MatchPlayerStat): number {
  return stat.catches + stat.stumpings + stat.run_outs
}

function impactScore(stat: MatchPlayerStat): number {
  return (
    stat.runs +
    stat.wickets * 25 +
    stat.catches * 8 +
    stat.stumpings * 10 +
    stat.run_outs * 10 +
    stat.sixes * 2 +
    stat.fours
  )
}

function playerStatHasBowling(stat: MatchPlayerStat): boolean {
  return (
    stat.wickets > 0 ||
    stat.maidens > 0 ||
    stat.runs_conceded > 0 ||
    oversFieldToBalls(stat.overs) > 0
  )
}

function playerStatHasBatting(stat: MatchPlayerStat): boolean {
  return stat.runs > 0 || stat.balls_faced > 0 || stat.fours > 0 || stat.sixes > 0
}

function preferredScorecardFocus(stat: MatchPlayerStat): 'batting' | 'bowling' {
  if (playerStatHasBowling(stat) && stat.wickets * 25 >= stat.runs) {
    return 'bowling'
  }

  return 'batting'
}

function playerMatchupSummary(stat: MatchPlayerStat): string {
  const parts: string[] = []

  if (playerStatHasBatting(stat)) {
    parts.push(`${stat.runs} off ${stat.balls_faced}`)
  }

  if (playerStatHasBowling(stat)) {
    parts.push(`${stat.wickets}/${stat.runs_conceded}`)
  }

  if (fieldingTotal(stat) > 0) {
    parts.push(`${fieldingTotal(stat)} fielding`)
  }

  return parts.length > 0 ? parts.join(' · ') : 'Scorecard row'
}

function buildTopPerformerCards({
  stats,
  playerName,
  homeTeamId,
  awayTeamId,
  homeName,
  awayName,
}: {
  stats: MatchPlayerStat[]
  playerName: (playerId: number) => string
  homeTeamId: number
  awayTeamId: number
  homeName: string
  awayName: string
}): TopPerformerCard[] {
  if (stats.length === 0) return []

  const bestBatter = [...stats]
    .filter((stat) => stat.runs > 0 || stat.balls_faced > 0)
    .sort(
      (a, b) =>
        b.runs - a.runs ||
        b.sixes - a.sixes ||
        b.fours - a.fours ||
        a.balls_faced - b.balls_faced,
    )[0]

  const bestBowler = [...stats]
    .filter(
      (stat) =>
        stat.wickets > 0 ||
        oversFieldToBalls(stat.overs) > 0 ||
        stat.runs_conceded > 0,
    )
    .sort((a, b) => {
      const aBalls = oversFieldToBalls(a.overs)
      const bBalls = oversFieldToBalls(b.overs)
      const aEconomy = aBalls > 0 ? (a.runs_conceded * 6) / aBalls : 999
      const bEconomy = bBalls > 0 ? (b.runs_conceded * 6) / bBalls : 999

      return (
        b.wickets - a.wickets ||
        aEconomy - bEconomy ||
        b.maidens - a.maidens ||
        a.runs_conceded - b.runs_conceded
      )
    })[0]

  const bestImpact = [...stats].sort(
    (a, b) => impactScore(b) - impactScore(a),
  )[0]

  const bestFielder = [...stats]
    .filter((stat) => fieldingTotal(stat) > 0)
    .sort(
      (a, b) =>
        fieldingTotal(b) - fieldingTotal(a) ||
        b.catches - a.catches ||
        b.stumpings - a.stumpings ||
        b.run_outs - a.run_outs,
    )[0]

  const cards: TopPerformerCard[] = []

  if (bestBatter) {
    cards.push({
      id: 'batter',
      title: 'Best Batter',
      playerId: bestBatter.player_id,
      teamId: bestBatter.team_id,
      focus: 'batting',
      playerName: playerName(bestBatter.player_id),
      teamName: topPerformerTeamName(
        bestBatter.team_id,
        homeTeamId,
        awayTeamId,
        homeName,
        awayName,
      ),
      mainLine: `${bestBatter.runs} runs from ${bestBatter.balls_faced} balls`,
      subLine: `SR ${formatTopPerformerStrikeRate(
        bestBatter.runs,
        bestBatter.balls_faced,
      )} · ${bestBatter.fours} fours · ${bestBatter.sixes} sixes`,
    })
  }

  if (bestBowler && bestBowler.wickets > 0) {
    cards.push({
      id: 'bowler',
      title: 'Best Bowler',
      playerId: bestBowler.player_id,
      teamId: bestBowler.team_id,
      focus: 'bowling',
      playerName: playerName(bestBowler.player_id),
      teamName: topPerformerTeamName(
        bestBowler.team_id,
        homeTeamId,
        awayTeamId,
        homeName,
        awayName,
      ),
      mainLine: `${bestBowler.wickets}/${bestBowler.runs_conceded} from ${formatTopPerformerOvers(
        bestBowler.overs,
      )} overs`,
      subLine: `Economy ${formatTopPerformerEconomy(
        bestBowler.runs_conceded,
        bestBowler.overs,
      )} · ${bestBowler.maidens} maidens`,
    })
  }

  if (bestImpact && impactScore(bestImpact) > 0) {
    const focus =
      bestImpact.wickets > 0 && bestImpact.wickets * 25 >= bestImpact.runs
        ? 'bowling'
        : 'batting'

    cards.push({
      id: 'impact',
      title: 'All-round Impact',
      playerId: bestImpact.player_id,
      teamId: bestImpact.team_id,
      focus,
      playerName: playerName(bestImpact.player_id),
      teamName: topPerformerTeamName(
        bestImpact.team_id,
        homeTeamId,
        awayTeamId,
        homeName,
        awayName,
      ),
      mainLine: `${bestImpact.runs} runs · ${bestImpact.wickets} wickets`,
      subLine: `${bestImpact.catches} catches · ${bestImpact.stumpings} stumpings · ${bestImpact.run_outs} run outs`,
    })
  }

  if (bestFielder) {
    cards.push({
      id: 'fielder',
      title: 'Best Fielder',
      playerId: bestFielder.player_id,
      teamId: bestFielder.team_id,
      focus: 'bowling',
      playerName: playerName(bestFielder.player_id),
      teamName: topPerformerTeamName(
        bestFielder.team_id,
        homeTeamId,
        awayTeamId,
        homeName,
        awayName,
      ),
      mainLine: `${bestFielder.catches} catches · ${bestFielder.stumpings} stumpings`,
      subLine: `${bestFielder.run_outs} run outs`,
    })
  }

  return cards
}

function buildPlayerMatchupOptions({
  stats,
  teamId,
  teamName,
  playerName,
}: {
  stats: MatchPlayerStat[]
  teamId: number
  teamName: string
  playerName: (playerId: number) => string
}): PlayerMatchupOption[] {
  const seen = new Set<number>()

  return [...stats]
    .filter((stat) => stat.team_id === teamId)
    .filter((stat) => {
      if (seen.has(stat.player_id)) return false
      seen.add(stat.player_id)
      return true
    })
    .sort((a, b) => impactScore(b) - impactScore(a))
    .map((stat) => ({
      stat,
      playerName: playerName(stat.player_id),
      teamName,
    }))
}

function buildPlayerMatchupRows(
  home: MatchPlayerStat,
  away: MatchPlayerStat,
): PlayerMatchupRow[] {
  return [
    { label: 'Runs', homeValue: home.runs, awayValue: away.runs },
    { label: 'Balls', homeValue: home.balls_faced, awayValue: away.balls_faced },
    {
      label: 'Strike rate',
      homeValue: formatTopPerformerStrikeRate(home.runs, home.balls_faced),
      awayValue: formatTopPerformerStrikeRate(away.runs, away.balls_faced),
    },
    { label: '4s', homeValue: home.fours, awayValue: away.fours },
    { label: '6s', homeValue: home.sixes, awayValue: away.sixes },
    { label: 'Wickets', homeValue: home.wickets, awayValue: away.wickets },
    {
      label: 'Overs',
      homeValue: formatTopPerformerOvers(home.overs),
      awayValue: formatTopPerformerOvers(away.overs),
    },
    {
      label: 'Runs conceded',
      homeValue: home.runs_conceded,
      awayValue: away.runs_conceded,
    },
    {
      label: 'Economy',
      homeValue: formatTopPerformerEconomy(home.runs_conceded, home.overs),
      awayValue: formatTopPerformerEconomy(away.runs_conceded, away.overs),
    },
    { label: 'Maidens', homeValue: home.maidens, awayValue: away.maidens },
    { label: 'Catches', homeValue: home.catches, awayValue: away.catches },
    { label: 'Stumpings', homeValue: home.stumpings, awayValue: away.stumpings },
    { label: 'Run outs', homeValue: home.run_outs, awayValue: away.run_outs },
  ]
}

function fixturesHrefForMatch(category: string | null | undefined): string {
  const c = (category ?? '').trim().toLowerCase()
  if (c === 'mens' || c === 'men' || c === 'man') return '/mens/fixtures'
  if (
    c === 'women' ||
    c === 'womens' ||
    c === 'ladies' ||
    c === 'lady' ||
    c === 'woman'
  ) {
    return '/women/fixtures'
  }
  if (c === 'youth') return '/youth/fixtures'
  return '/fixtures'
}

function matchStatusPillClass(status: string | undefined): string {
  const s = (status ?? 'scheduled').toLowerCase()
  if (s === 'completed') return 'match-centre__status-pill--completed'
  if (s === 'live') return 'match-centre__status-pill--live'
  if (s === 'postponed' || s === 'abandoned' || s === 'cancelled') {
    return 'match-centre__status-pill--inactive'
  }
  return 'match-centre__status-pill--scheduled'
}

function formatStatusLabel(status: string | undefined): string {
  return (status ?? 'scheduled').replaceAll('_', ' ').toUpperCase()
}

function TeamLogoWithFallback({
  logoUrl,
  className,
  alt,
}: {
  logoUrl: string | null
  className: string
  alt: string
}) {
  const initial = resolveMediaUrl(logoUrl) ?? nplLogoUrl
  const [src, setSrc] = useState(initial)

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setSrc(nplLogoUrl)}
    />
  )
}

function MatchCentreHeroLogo({
  logoUrl,
  isWinner,
}: {
  logoUrl: string | null
  isWinner: boolean
}) {
  const initial = resolveMediaUrl(logoUrl) ?? nplLogoUrl
  const [src, setSrc] = useState(initial)

  return (
    <span
      className={`match-centre-hero__badge-wrap${
        isWinner ? ' match-centre-hero__badge-wrap--winner' : ''
      }`}
      aria-label={isWinner ? 'Winner' : undefined}
    >
      <img
        className="match-centre-hero__logo"
        src={src}
        alt=""
        loading="eager"
        decoding="async"
        onError={() => setSrc(nplLogoUrl)}
      />
      {isWinner ? (
        <span className="match-centre-hero__cup" aria-hidden title="Winner">
          🏆
        </span>
      ) : null}
    </span>
  )
}

export default function MatchDetailPage() {
  const { matchId } = useParams({ strict: false }) as { matchId?: string }
  const { map: teamsMap } = useTeamsMap()
  const [scorecardInnings, setScorecardInnings] = useState<InningsNumber>(1)
  const [highlightedPlayerId, setHighlightedPlayerId] = useState<number | null>(null)
  const [matchupHomePlayerId, setMatchupHomePlayerId] = useState('')
  const [matchupAwayPlayerId, setMatchupAwayPlayerId] = useState('')

  const [fanVoterKey] = useState(getFanVoterKey)
  const [selectedFanPlayerId, setSelectedFanPlayerId] = useState('')
  const [fanVoteSubmitting, setFanVoteSubmitting] = useState(false)
  const [fanVoteError, setFanVoteError] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['match-detail', matchId],
    queryFn: () => fetchJson<MatchDetail>(`/public/matches/${matchId}`),
    enabled: Boolean(matchId),
    retry: 1,
  })

  const home = data ? teamsMap[data.home_team_id] : null
  const away = data ? teamsMap[data.away_team_id] : null
  const homeName = home?.name ?? `Team ${data?.home_team_id ?? ''}`
  const awayName = away?.name ?? `Team ${data?.away_team_id ?? ''}`

  const homePlayersQ = useQuery({
    queryKey: ['match-players', 'home', data?.home_team_id],
    queryFn: async () =>
      fetchAllPaginatedList<PublicPlayerRow>((page) =>
        `/public/players?page=${page}&page_size=100&team_id=${
          data?.home_team_id ?? -1
        }&include_inactive=true`,
      ),
    enabled: Boolean(data?.home_team_id),
    retry: 1,
  })

  const awayPlayersQ = useQuery({
    queryKey: ['match-players', 'away', data?.away_team_id],
    queryFn: async () =>
      fetchAllPaginatedList<PublicPlayerRow>((page) =>
        `/public/players?page=${page}&page_size=100&team_id=${
          data?.away_team_id ?? -1
        }&include_inactive=true`,
      ),
    enabled: Boolean(data?.away_team_id),
    retry: 1,
  })

  const playerById = useMemo(() => {
    const m = new Map<number, string>()

    for (const p of homePlayersQ.data ?? []) {
      m.set(p.id, p.full_name)
    }

    for (const p of awayPlayersQ.data ?? []) {
      m.set(p.id, p.full_name)
    }

    return m
  }, [homePlayersQ.data, awayPlayersQ.data])

  const playerHrefById = useMemo(() => {
    const m = new Map<number, string>()

    for (const p of homePlayersQ.data ?? []) {
      if (p.slug) {
        m.set(p.id, '/players/' + p.slug)
      }
    }

    for (const p of awayPlayersQ.data ?? []) {
      if (p.slug) {
        m.set(p.id, '/players/' + p.slug)
      }
    }

    return m
  }, [homePlayersQ.data, awayPlayersQ.data])

  const playerStats = data?.player_stats ?? NO_PLAYER_STATS
  const battingFirstTeamId = data?.result?.batting_first_team_id ?? null

  const inningsExtrasLine = useMemo(() => {
    if (!data?.result) return null

    const sides = getInningsSides(
      scorecardInnings,
      battingFirstTeamId,
      data.home_team_id,
      data.away_team_id,
    )

    if (!sides) return null

    const side = sides.battingTeamId === data.home_team_id ? 'home' : 'away'

    return formatExtrasBreakdown(data.result, side)
  }, [data, scorecardInnings, battingFirstTeamId])

  const topPerformerCards = useMemo(() => {
    if (!data) return []

    return buildTopPerformerCards({
      stats: playerStats,
      playerName: (id) => playerById.get(id) ?? `#${id}`,
      homeTeamId: data.home_team_id,
      awayTeamId: data.away_team_id,
      homeName,
      awayName,
    })
  }, [awayName, data, homeName, playerById, playerStats])


  const playerMatchupOptions = useMemo(() => {
    if (!data) return { home: [], away: [] }

    return {
      home: buildPlayerMatchupOptions({
        stats: playerStats,
        teamId: data.home_team_id,
        teamName: homeName,
        playerName: (id) => playerById.get(id) ?? `#${id}`,
      }),
      away: buildPlayerMatchupOptions({
        stats: playerStats,
        teamId: data.away_team_id,
        teamName: awayName,
        playerName: (id) => playerById.get(id) ?? `#${id}`,
      }),
    }
  }, [awayName, data, homeName, playerById, playerStats])

  useEffect(() => {
    if (!matchupHomePlayerId) return

    const currentExists = playerMatchupOptions.home.some(
      (option) => String(option.stat.player_id) === matchupHomePlayerId,
    )

    if (!currentExists) {
      setMatchupHomePlayerId('')
    }
  }, [matchupHomePlayerId, playerMatchupOptions.home])

  useEffect(() => {
    if (!matchupAwayPlayerId) return

    const currentExists = playerMatchupOptions.away.some(
      (option) => String(option.stat.player_id) === matchupAwayPlayerId,
    )

    if (!currentExists) {
      setMatchupAwayPlayerId('')
    }
  }, [matchupAwayPlayerId, playerMatchupOptions.away])

  const selectedHomeMatchup = useMemo(
    () =>
      playerMatchupOptions.home.find(
        (option) => String(option.stat.player_id) === matchupHomePlayerId,
      ) ?? null,
    [matchupHomePlayerId, playerMatchupOptions.home],
  )

  const selectedAwayMatchup = useMemo(
    () =>
      playerMatchupOptions.away.find(
        (option) => String(option.stat.player_id) === matchupAwayPlayerId,
      ) ?? null,
    [matchupAwayPlayerId, playerMatchupOptions.away],
  )

  const playerMatchupRows = useMemo(() => {
    if (!selectedHomeMatchup || !selectedAwayMatchup) return []

    return buildPlayerMatchupRows(selectedHomeMatchup.stat, selectedAwayMatchup.stat)
  }, [selectedAwayMatchup, selectedHomeMatchup])

  const title = data ? `${homeName} vs ${awayName}` : 'Match'
  const matchLite = data as unknown as MatchLite
  const headerWinner = data ? matchWinnerSide(matchLite) : null
  const resultLine = data ? matchResultSummaryLine(matchLite) : null
  const matchReportContent = formatMatchReportContent(data?.result?.match_report)

  const descriptionLine = useMemo(() => {
    if (!data) return ''

    const parts: string[] = []

    if (data.season) {
      parts.push(`${data.season.league.name} · ${data.season.name}`)
    } else if (data.season_id != null) {
      parts.push(`Season id ${data.season_id}`)
    } else {
      parts.push('No season')
    }

    parts.push(formatCategoryLabel(data.category))
    parts.push(`Match ${data.id}`)

    if (resultLine) {
      parts.push(resultLine)
    }

    return parts.join(' · ')
  }, [data, resultLine])

  const shareText = useMemo(() => {
    if (!data) return ''

    const parts = [
      descriptionLine,
      data.result?.margin_text,
      data.result?.innings_breakdown || data.result?.score_summary,
      data.venue,
    ]

    return parts.filter(Boolean).join(' · ')
  }, [data, descriptionLine])

  const whenValue = useMemo(() => {
    if (!data) return '—'

    const dateToken =
      data.match_date?.trim() ??
      (data.start_time != null ? String(data.start_time).slice(0, 10) : null)

    if (!dateToken) return '—'

    return formatMatchDate(dateToken)
  }, [data])

  const displayStatus = publicDisplayMatchStatus(data?.status, data?.match_date)

  const showResultBlock =
    data != null && (data.result != null || playerStats.length > 0)
  const playersLoading = homePlayersQ.isLoading || awayPlayersQ.isLoading

  const canShowFanPlayerVote =
    data?.status === 'completed' && data.result != null && playerStats.length > 0

  const fanVoteQ = useQuery({
    queryKey: ['fan-player-vote', matchId, fanVoterKey],
    queryFn: () =>
      fetchJson<FanPlayerVoteSummary>(
        `/public/matches/${matchId}/fan-player-vote?voter_key=${encodeURIComponent(
          fanVoterKey,
        )}`,
      ),
    enabled: Boolean(matchId && fanVoterKey && canShowFanPlayerVote),
    retry: 1,
  })

  useEffect(() => {
    const picked = fanVoteQ.data?.voter_player_id

    if (picked != null) {
      setSelectedFanPlayerId(String(picked))
    }
  }, [fanVoteQ.data?.voter_player_id])

  const submitFanVote = async () => {
    if (!matchId || !selectedFanPlayerId || !fanVoterKey) return

    setFanVoteSubmitting(true)
    setFanVoteError(null)

    try {
      await postJson(`/public/matches/${matchId}/fan-player-vote`, {
        player_id: Number(selectedFanPlayerId),
        voter_key: fanVoterKey,
      })

      await fanVoteQ.refetch()
    } catch {
      setFanVoteError('Could not save your vote. Please try again.')
    } finally {
      setFanVoteSubmitting(false)
    }
  }

  const inningsForBattingTeam = (teamId: number): InningsNumber => {
    if (!data) return 1

    const firstBattingTeamId = battingFirstTeamId ?? data.home_team_id

    return teamId === firstBattingTeamId ? 1 : 2
  }

  const inningsForBowlingTeam = (teamId: number): InningsNumber => {
    return inningsForBattingTeam(teamId) === 1 ? 2 : 1
  }

  const showTopPerformers =
    data?.status === 'completed' && topPerformerCards.length > 0

  const showPlayerMatchup =
    data?.status === 'completed' &&
    playerMatchupOptions.home.length > 0 &&
    playerMatchupOptions.away.length > 0

  const highlightPlayerStat = (stat: MatchPlayerStat) => {
    const focus = preferredScorecardFocus(stat)

    setHighlightedPlayerId(stat.player_id)
    setScorecardInnings(
      focus === 'bowling'
        ? inningsForBowlingTeam(stat.team_id)
        : inningsForBattingTeam(stat.team_id),
    )

    window.setTimeout(() => {
      document
        .getElementById('match-scorecard-title')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const highlightTopPerformer = (card: TopPerformerCard) => {
    setHighlightedPlayerId(card.playerId)
    setScorecardInnings(
      card.focus === 'bowling'
        ? inningsForBowlingTeam(card.teamId)
        : inningsForBattingTeam(card.teamId),
    )

    window.setTimeout(() => {
      document
        .getElementById('match-scorecard-title')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  if (isLoading) {
    return (
      <main className="container">
        <div className="menu-page">
          <Spinner label="Loading match…" />
        </div>
      </main>
    )
  }

  if (isError || !data) {
    return (
      <main className="container">
        <div className="menu-page">
          <ErrorNotice message="Could not load match details." />
          <p className="match-centre-back">
            <Link to={fixturesHrefForMatch(undefined)}>Back to fixtures</Link>
          </p>
        </div>
      </main>
    )
  }

  return (
    <>
      <header className="match-centre-hero" aria-label="Match summary">
        <div className="match-centre-hero__badges">
          <MatchCentreHeroLogo
            logoUrl={home?.logo_url ?? null}
            isWinner={headerWinner === 'home'}
          />
          <span className="match-centre-hero__vs">vs</span>
          <MatchCentreHeroLogo
            logoUrl={away?.logo_url ?? null}
            isWinner={headerWinner === 'away'}
          />
        </div>

        <h1 className="match-centre-hero__title">{title}</h1>
        <p className="match-centre-hero__desc">{descriptionLine}</p>
      </header>

      <main className="container">
        <section className="menu-page match-centre">
          <div className="match-centre-share-row match-centre-share-row--top">
            <SocialShareButtons title={title} text={shareText} />
          </div>

          <div className="match-centre-panels">
            <div className="match-centre-panels__col">
              <div className="match-centre-panel">
                <dl className="match-centre-detail">
                  <div className="match-centre-detail__row">
                    <dt>League · season</dt>
                    <dd>
                      {data.season
                        ? `${data.season.league.name} — ${data.season.name}`
                        : '—'}
                    </dd>
                  </div>

                  <div className="match-centre-detail__row">
                    <dt>When</dt>
                    <dd>{whenValue}</dd>
                  </div>

                  <div className="match-centre-detail__row">
                    <dt>Venue</dt>
                    <dd>{data.venue?.trim() ? data.venue : '—'}</dd>
                  </div>

                  {data.title?.trim() ? (
                    <div className="match-centre-detail__row">
                      <dt>Title</dt>
                      <dd>{data.title}</dd>
                    </div>
                  ) : null}

                  {data.toss_info?.trim() ? (
                    <div className="match-centre-detail__row">
                      <dt>Toss</dt>
                      <dd>{data.toss_info}</dd>
                    </div>
                  ) : null}

                  {data.umpires?.trim() ? (
                    <div className="match-centre-detail__row">
                      <dt>Umpires</dt>
                      <dd>{data.umpires}</dd>
                    </div>
                  ) : null}

                  {data.description?.trim() ? (
                    <div className="match-centre-detail__row">
                      <dt>Notes</dt>
                      <dd>{data.description}</dd>
                    </div>
                  ) : null}

                  <div className="match-centre-detail__row">
                    <dt>Category</dt>
                    <dd>{formatCategoryLabel(data.category)}</dd>
                  </div>

                  <div className="match-centre-detail__row">
                    <dt>Home</dt>
                    <dd>
                      <span className="match-centre-team-cell">
                        <TeamLogoWithFallback
                          logoUrl={home?.logo_url ?? null}
                          className="match-centre-team-cell__logo"
                          alt=""
                        />
                        <span>{homeName}</span>
                      </span>
                    </dd>
                  </div>

                  <div className="match-centre-detail__row">
                    <dt>Away</dt>
                    <dd>
                      <span className="match-centre-team-cell">
                        <TeamLogoWithFallback
                          logoUrl={away?.logo_url ?? null}
                          className="match-centre-team-cell__logo"
                          alt=""
                        />
                        <span>{awayName}</span>
                      </span>
                    </dd>
                  </div>

                  <div className="match-centre-detail__row">
                    <dt>Status</dt>
                    <dd>
                      <span
                        className={`match-centre__status-pill ${matchStatusPillClass(
                          displayStatus,
                        )}`}
                      >
                        {formatStatusLabel(displayStatus)}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="match-centre-panels__col">
              {showResultBlock ? (
                <section className="match-centre-panel match-centre-panel--result">
                  <h2 className="match-centre-panel__h">
                    Result &amp; player stats
                  </h2>

                  {data.result ? (
                    <div className="match-centre-result">
                      {data.result.score_summary ? (
                        <p>
                          <strong>Score:</strong> {data.result.score_summary}
                        </p>
                      ) : null}

                      {data.result.margin_text ? (
                        <p>
                          <strong>Margin:</strong> {data.result.margin_text}
                        </p>
                      ) : null}

                      {data.result.winning_team_id != null ? (
                        <p>
                          <strong>Winner:</strong>{' '}
                          <span aria-hidden title="Winner">
                            🏆
                          </span>{' '}
                          {data.result.winning_team_id === data.home_team_id
                            ? homeName
                            : data.result.winning_team_id === data.away_team_id
                              ? awayName
                              : `Team #${data.result.winning_team_id}`}
                        </p>
                      ) : null}

                      {data.result.player_of_match_player_id != null ? (
                        <p>
                          <strong>Player of the match:</strong>{' '}
                          {playerById.get(
                            data.result.player_of_match_player_id,
                          ) ?? `#${data.result.player_of_match_player_id}`}
                        </p>
                      ) : null}

                      {data.result.innings_breakdown ? (
                        <p>
                          <strong>Innings:</strong>{' '}
                          {data.result.innings_breakdown}
                        </p>
                      ) : null}

                      {data.result.top_performers ? (
                        <p>
                          <strong>Top performers:</strong>{' '}
                          {data.result.top_performers}
                        </p>
                      ) : null}

                    </div>
                  ) : null}
                </section>
              ) : (
                <p className="match-centre-empty-hint">
                  No result or scorecard yet.
                </p>
              )}
            </div>
          </div>

          {showTopPerformers ? (
            <section
              className="match-centre-panel match-centre-top-performers"
              aria-labelledby="top-performers-title"
            >
              <div className="match-centre-top-performers__head">
                <div>
                  <p className="match-centre-top-performers__eyebrow">
                    Match impact
                  </p>
                  <h2 id="top-performers-title">Top Performers</h2>
                  <p>Tap a card to jump to that player’s scorecard row.</p>
                </div>
              </div>

              <div className="match-centre-top-performers__grid">
                {topPerformerCards.map((card) => (
                  <button
                    key={`${card.id}-${card.playerId}`}
                    type="button"
                    className={`match-centre-top-performer-card${
                      highlightedPlayerId === card.playerId ? ' is-active' : ''
                    }`}
                    onClick={() => highlightTopPerformer(card)}
                  >
                    <span className="match-centre-top-performer-card__label">
                      {card.title}
                    </span>
                    <strong>{card.playerName}</strong>
                    <small>{card.teamName}</small>
                    <span>{card.mainLine}</span>
                    <em>{card.subLine}</em>
                  </button>
                ))}
              </div>
            </section>
                    ) : null}


          {showPlayerMatchup ? (
            <section
              className="match-centre-panel match-centre-player-matchup"
              aria-labelledby="player-matchup-title"
            >
              <div className="match-centre-player-matchup__head">
                <div>
                  <p className="match-centre-player-matchup__eyebrow">
                    Player match-up
                  </p>
                  <h2 id="player-matchup-title">Compare Players</h2>
                  <p>Choose one player from each team and compare their match impact.</p>
                </div>
              </div>

              <div className="match-centre-player-matchup__selectors">
                <label>
                  <span>{homeName}</span>
                  <select
                    value={matchupHomePlayerId}
                    onChange={(event) => setMatchupHomePlayerId(event.target.value)}
                  >
                    <option value="">Select player</option>

                    {playerMatchupOptions.home.map((option) => (
                      <option key={option.stat.player_id} value={option.stat.player_id}>
                        {option.playerName}
                      </option>
                    ))}
                  </select>
                </label>

                <strong aria-hidden>vs</strong>

                <label>
                  <span>{awayName}</span>
                  <select
                    value={matchupAwayPlayerId}
                    onChange={(event) => setMatchupAwayPlayerId(event.target.value)}
                  >
                    <option value="">Select player</option>

                    {playerMatchupOptions.away.map((option) => (
                      <option key={option.stat.player_id} value={option.stat.player_id}>
                        {option.playerName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedHomeMatchup && selectedAwayMatchup ? (
                <>
                  <div className="match-centre-player-matchup__cards">
                    <button
                      type="button"
                      className={`match-centre-player-matchup__player${
                        highlightedPlayerId === selectedHomeMatchup.stat.player_id
                          ? ' is-active'
                          : ''
                      }`}
                      onClick={() => highlightPlayerStat(selectedHomeMatchup.stat)}
                    >
                      <small>{selectedHomeMatchup.teamName}</small>
                      <strong>{selectedHomeMatchup.playerName}</strong>
                      <span>{playerMatchupSummary(selectedHomeMatchup.stat)}</span>
                    </button>

                    <button
                      type="button"
                      className={`match-centre-player-matchup__player${
                        highlightedPlayerId === selectedAwayMatchup.stat.player_id
                          ? ' is-active'
                          : ''
                      }`}
                      onClick={() => highlightPlayerStat(selectedAwayMatchup.stat)}
                    >
                      <small>{selectedAwayMatchup.teamName}</small>
                      <strong>{selectedAwayMatchup.playerName}</strong>
                      <span>{playerMatchupSummary(selectedAwayMatchup.stat)}</span>
                    </button>
                  </div>

                  <div className="match-centre-player-matchup__table-wrap">
                    <table className="match-centre-player-matchup__table">
                      <thead>
                        <tr>
                          <th>{selectedHomeMatchup.playerName}</th>
                          <th>Stat</th>
                          <th>{selectedAwayMatchup.playerName}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {playerMatchupRows.map((row) => (
                          <tr key={row.label}>
                            <td>{row.homeValue}</td>
                            <td>{row.label}</td>
                            <td>{row.awayValue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          {canShowFanPlayerVote ? (
            <section
              className="match-centre-panel match-centre-fan-pom"
              aria-labelledby="fan-player-of-match-title"
            >
              <div className="match-centre-fan-pom__head">
                <div>
                  <p className="match-centre-fan-pom__eyebrow">Fan vote</p>
                  <h2 id="fan-player-of-match-title">Fan Player of the Match</h2>
                  <p>
                    Pick from the top 2 batters and top 2 bowlers from this match.
                  </p>
                </div>

                {fanVoteQ.data ? (
                  <strong>{fanVoteQ.data.total_votes} votes</strong>
                ) : null}
              </div>

              {fanVoteQ.isLoading ? (
                <p className="match-centre-muted">Loading fan vote…</p>
              ) : null}

              {fanVoteQ.isError ? (
                <p className="match-centre-muted">
                  Fan voting is not available right now.
                </p>
              ) : null}

              {fanVoteQ.data && !fanVoteQ.data.eligible ? (
                <p className="match-centre-muted">
                  {fanVoteQ.data.reason ?? 'Fan voting is not open yet.'}
                </p>
              ) : null}

              {fanVoteQ.data?.eligible ? (
                <>
                  <div className="match-centre-fan-pom__choices">
                    {fanVoteQ.data.choices.map((choice) => {
                      const teamName =
                        choice.team_id === data.home_team_id
                          ? homeName
                          : choice.team_id === data.away_team_id
                            ? awayName
                            : `Team #${choice.team_id}`

                      return (
                        <label
                          key={choice.player_id}
                          className={`match-centre-fan-pom__choice${
                            selectedFanPlayerId === String(choice.player_id)
                              ? ' is-selected'
                              : ''
                          }`}
                        >
                          <input
                            type="radio"
                            name="fan-player-of-match"
                            value={choice.player_id}
                            checked={selectedFanPlayerId === String(choice.player_id)}
                            onChange={(event) => setSelectedFanPlayerId(event.target.value)}
                          />

                          <span className="match-centre-fan-pom__choice-body">
                            <span>
                              <strong>{choice.player_name}</strong>
                              <small>{teamName}</small>
                            </span>

                            <span className="match-centre-fan-pom__vote-meta">
                              {choice.votes} vote{choice.votes === 1 ? '' : 's'} ·{' '}
                              {choice.percentage}%
                            </span>

                            <span className="match-centre-fan-pom__bar" aria-hidden>
                              <span style={{ width: `${choice.percentage}%` }} />
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </div>

                  <div className="match-centre-fan-pom__actions">
                    <button
                      type="button"
                      disabled={!selectedFanPlayerId || fanVoteSubmitting}
                      onClick={() => void submitFanVote()}
                    >
                      {fanVoteSubmitting
                        ? 'Saving…'
                        : fanVoteQ.data.voter_player_id
                          ? 'Update vote'
                          : 'Submit vote'}
                    </button>

                    {fanVoteQ.data.voter_player_id ? (
                      <p>Thanks — your fan vote has been counted.</p>
                    ) : null}

                    {fanVoteError ? (
                      <p className="match-centre-fan-pom__error">{fanVoteError}</p>
                    ) : null}
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          <section
            className="match-centre-scorecard"
            aria-labelledby="match-scorecard-title"
          >
            <div className="match-centre-scorecard__head">
              <h2 id="match-scorecard-title" className="match-centre-panel__h">
                Scorecard
              </h2>

              <div
                className="match-centre-tabs"
                role="tablist"
                aria-label="Scorecard innings"
              >
                <button
                  type="button"
                  className={scorecardInnings === 1 ? 'is-active' : ''}
                  onClick={() => setScorecardInnings(1)}
                  role="tab"
                  aria-selected={scorecardInnings === 1}
                >
                  1st innings
                </button>

                <button
                  type="button"
                  className={scorecardInnings === 2 ? 'is-active' : ''}
                  onClick={() => setScorecardInnings(2)}
                  role="tab"
                  aria-selected={scorecardInnings === 2}
                >
                  2nd innings
                </button>
              </div>
            </div>

            {playersLoading ? (
              <p className="match-centre-muted">Loading player names…</p>
            ) : null}

            {playerStats.length > 0 ? (
              <InningsScorecardPanels
                innings={scorecardInnings}
                battingFirstTeamId={battingFirstTeamId}
                homeTeamId={data.home_team_id}
                awayTeamId={data.away_team_id}
                homeLabel={homeName}
                awayLabel={awayName}
                stats={playerStats}
                playerName={(id) => playerById.get(id) ?? `#${id}`}
                playerHref={(id) => playerHrefById.get(id) ?? null}
                extrasLine={inningsExtrasLine}
                highlightedPlayerId={highlightedPlayerId}
              />
            ) : (
              <p className="match-centre-muted">No per-player rows yet.</p>
            )}
          </section>

          {matchReportContent ? (
            <section
              className="match-centre-match-report"
              aria-labelledby="match-report-title"
            >
              <p className="match-centre-match-report__eyebrow">Match report</p>
              <h2 id="match-report-title">{matchReportContent.headline}</h2>

              <div className="match-centre-match-report__body">
                {matchReportContent.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ) : null}
        </section>
      </main>
    </>
  )
}
