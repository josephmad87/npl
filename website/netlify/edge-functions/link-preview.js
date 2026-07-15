const SITE_NAME = 'National Premier League'
const DEFAULT_DESCRIPTION =
  'Latest fixtures, results, scorecards, news and standings from the National Premier League.'
const DEFAULT_IMAGE_PATH = '/apple-touch-icon.png'

let teamNameCache = null

function env(name) {
  return (
    globalThis.Netlify?.env?.get?.(name) ??
    globalThis.Deno?.env?.get?.(name) ??
    ''
  )
}

function apiBaseUrl() {
  return (
    env('VITE_API_BASE_URL') ||
    env('API_BASE_URL') ||
    'https://admin.npl.co.zw/api/v1'
  ).replace(/\/+$/, '')
}

function cleanText(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback
  }

  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanTeamName(value) {
  return cleanText(value)
}

function truncate(value, max = 220) {
  const text = cleanText(value)

  if (text.length <= max) {
    return text
  }

  return `${text.slice(0, max - 1).trim()}…`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function absoluteUrl(raw, requestUrl) {
  const value = typeof raw === 'string' ? raw.trim() : ''

  if (!value) {
    return new URL(DEFAULT_IMAGE_PATH, requestUrl).toString()
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }

  if (value.startsWith('//')) {
    return `https:${value}`
  }

  if (value.startsWith('/')) {
    try {
      return new URL(value, new URL(apiBaseUrl()).origin).toString()
    } catch {
      return new URL(value, requestUrl).toString()
    }
  }

  return new URL(DEFAULT_IMAGE_PATH, requestUrl).toString()
}

async function fetchApi(path) {
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      headers: {
        accept: 'application/json',
      },
    })

    if (!response.ok) {
      return null
    }

    return await response.json()
  } catch {
    return null
  }
}

function defaultPreview(request) {
  return {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    image: new URL(DEFAULT_IMAGE_PATH, request.url).toString(),
    type: 'website',
  }
}

async function previewForNews(slug, request) {
  const article = await fetchApi(`/public/news/${encodeURIComponent(slug)}`)

  if (!article) {
    return defaultPreview(request)
  }

  return {
    title: article.title || SITE_NAME,
    description:
      truncate(article.excerpt || article.body || DEFAULT_DESCRIPTION) ||
      DEFAULT_DESCRIPTION,
    image: absoluteUrl(
      article.featured_image_url || article.body_image_url,
      request.url,
    ),
    type: 'article',
  }
}

async function fetchAllTeams() {
  if (teamNameCache) {
    return teamNameCache
  }

  const data =
    (await fetchApi('/public/teams?page=1&page_size=1000')) ||
    (await fetchApi('/public/teams'))

  const teams = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
      ? data.items
      : []

  teamNameCache = teams
  return teams
}

async function fetchTeamById(teamId) {
  if (!teamId) {
    return null
  }

  const teams = await fetchAllTeams()

  return (
    teams.find((team) => Number(team.id) === Number(teamId)) ||
    null
  )
}

async function fetchTeamNameById(teamId) {
  const team = await fetchTeamById(teamId)
  return cleanTeamName(team?.name) || null
}

function namesFromInningsText(match) {
  const text =
    match.result?.innings_breakdown ||
    match.result?.score_summary ||
    ''

  if (!text) {
    return []
  }

  return text
    .split(';')
    .map((part) => {
      const cleaned = cleanTeamName(part)

      return cleaned
        .replace(/\s+\d+\/\d+.*$/i, '')
        .replace(/\s+\d+\s+runs?.*$/i, '')
        .replace(/\s+\d+\s+wickets?.*$/i, '')
        .replace(/\s+won\s+by\s+.*$/i, '')
        .trim()
    })
    .filter(Boolean)
}

async function resolvedMatchTeamNames(match) {
  const fromMatchHome =
    cleanTeamName(match.home_team?.name) ||
    cleanTeamName(match.home_team_name)

  const fromMatchAway =
    cleanTeamName(match.away_team?.name) ||
    cleanTeamName(match.away_team_name)

  if (fromMatchHome && fromMatchAway) {
    return {
      homeName: fromMatchHome,
      awayName: fromMatchAway,
    }
  }

  const fetchedHome = await fetchTeamNameById(match.home_team_id)
  const fetchedAway = await fetchTeamNameById(match.away_team_id)

  if (fetchedHome && fetchedAway) {
    return {
      homeName: fetchedHome,
      awayName: fetchedAway,
    }
  }

  const inningsNames = namesFromInningsText(match)

  if (inningsNames.length >= 2) {
    return {
      homeName: inningsNames[0],
      awayName: inningsNames[1],
    }
  }

  return {
    homeName:
      fromMatchHome ||
      fetchedHome ||
      inningsNames[0] ||
      `Team ${match.home_team_id}`,
    awayName:
      fromMatchAway ||
      fetchedAway ||
      inningsNames[1] ||
      `Team ${match.away_team_id}`,
  }
}

async function resolvedMatchTeamImages(match) {
  const homeTeam = await fetchTeamById(match.home_team_id)
  const awayTeam = await fetchTeamById(match.away_team_id)

  return {
    homeLogo:
      match.home_team?.logo_url ||
      homeTeam?.logo_url ||
      null,
    awayLogo:
      match.away_team?.logo_url ||
      awayTeam?.logo_url ||
      null,
  }
}

function matchLeagueName(match) {
  return (
    cleanText(match.season?.league?.name) ||
    cleanText(match.league_name) ||
    ''
  )
}

function matchSeasonName(match) {
  return (
    cleanText(match.season?.name) ||
    cleanText(match.season_name) ||
    ''
  )
}

function matchSeasonLine(match) {
  return [matchLeagueName(match), matchSeasonName(match)]
    .filter(Boolean)
    .join(' · ')
}

function formatShareDate(value) {
  if (!value) {
    return ''
  }

  const text = String(value)
  const date = new Date(`${text}T00:00:00Z`)

  if (Number.isNaN(date.getTime())) {
    return text
  }

  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function readableMarginText(match, homeName, awayName) {
  const result = match.result

  if (!result) {
    return ''
  }

  const margin = cleanText(result.margin_text)
  const winnerId = Number(result.winning_team_id)
  const homeId = Number(match.home_team_id)
  const awayId = Number(match.away_team_id)

  let winnerName = ''

  if (winnerId && winnerId === homeId) {
    winnerName = homeName
  } else if (winnerId && winnerId === awayId) {
    winnerName = awayName
  }

  if (!margin) {
    return winnerName ? `${winnerName} won` : ''
  }

  if (/won\s+by/i.test(margin)) {
    return margin
  }

  if (winnerName) {
    return `${winnerName} won by ${margin.toLowerCase()}`
  }

  return margin
}

function matchScoreText(match) {
  const result = match.result

  if (!result) {
    return ''
  }

  return cleanText(result.innings_breakdown || result.score_summary)
}

function matchShareDescription(match, homeName, awayName) {
  const seasonLine = matchSeasonLine(match)
  const dateLine = formatShareDate(match.match_date)
  const venueLine = cleanText(match.venue)
  const result = match.result

  if (match.status === 'completed' && result) {
    return truncate(
      [
        readableMarginText(match, homeName, awayName),
        matchScoreText(match),
        seasonLine,
        dateLine,
        venueLine,
      ]
        .filter(Boolean)
        .join(' · '),
      260,
    )
  }

  return truncate(
    [
      `${homeName} vs ${awayName}`,
      seasonLine,
      dateLine,
      venueLine,
    ]
      .filter(Boolean)
      .join(' · '),
    260,
  )
}

async function previewForMatch(matchId, request) {
  const match = await fetchApi(`/public/matches/${encodeURIComponent(matchId)}`)

  if (!match) {
    return defaultPreview(request)
  }

  const { homeName, awayName } = await resolvedMatchTeamNames(match)
  const { homeLogo, awayLogo } = await resolvedMatchTeamImages(match)

  const seasonName = matchSeasonName(match)
  const leagueName = matchLeagueName(match)

  const title = [
    `${homeName} vs ${awayName}`,
    seasonName || leagueName || SITE_NAME,
  ]
    .filter(Boolean)
    .join(' | ')

  const description =
    matchShareDescription(match, homeName, awayName) || DEFAULT_DESCRIPTION

  return {
    title,
    description,
    image: absoluteUrl(
      match.cover_image_url ||
        match.season?.banner_url ||
        match.season?.league?.banner_url ||
        match.season?.league?.logo_url ||
        homeLogo ||
        awayLogo,
      request.url,
    ),
    type: 'website',
  }
}

async function previewForTeam(slug, request) {
  const team = await fetchApi(`/public/teams/${encodeURIComponent(slug)}`)

  if (!team) {
    return defaultPreview(request)
  }

  return {
    title: team.name || SITE_NAME,
    description:
      truncate(
        team.description ||
          team.history ||
          `${team.name} team profile, fixtures, results and player information.`,
      ) || DEFAULT_DESCRIPTION,
    image: absoluteUrl(team.cover_image_url || team.logo_url, request.url),
    type: 'website',
  }
}

async function previewForPlayer(slug, request) {
  const player = await fetchApi(`/public/players/${encodeURIComponent(slug)}`)

  if (!player) {
    return defaultPreview(request)
  }

  return {
    title: player.full_name || SITE_NAME,
    description:
      truncate(
        [
          player.role,
          player.batting_style,
          player.bowling_style,
          player.team_name,
        ]
          .filter(Boolean)
          .join(' · '),
      ) || `${player.full_name} player profile on ${SITE_NAME}.`,
    image: absoluteUrl(player.profile_photo_url, request.url),
    type: 'profile',
  }
}

async function previewForLeague(slug, request) {
  const league = await fetchApi(`/public/leagues/${encodeURIComponent(slug)}`)

  if (!league) {
    return defaultPreview(request)
  }

  return {
    title: league.name || SITE_NAME,
    description:
      truncate(
        league.description ||
          `${league.name} fixtures, results, standings and statistics.`,
      ) || DEFAULT_DESCRIPTION,
    image: absoluteUrl(league.banner_url || league.logo_url, request.url),
    type: 'website',
  }
}

async function previewForSeason(leagueSlug, seasonSlug, request) {
  const season = await fetchApi(
    `/public/leagues/${encodeURIComponent(
      leagueSlug,
    )}/seasons/${encodeURIComponent(seasonSlug)}`,
  )

  if (!season) {
    return defaultPreview(request)
  }

  return {
    title: `${season.name || 'Season'} | ${SITE_NAME}`,
    description:
      truncate(
        `${season.name || 'Season'} standings, fixtures, results and player statistics.`,
      ) || DEFAULT_DESCRIPTION,
    image: new URL(DEFAULT_IMAGE_PATH, request.url).toString(),
    type: 'website',
  }
}

async function previewForMerchandise(request) {
  return {
    title: 'Official NPL Merchandise',
    description:
      'Shop official National Premier League supporter gear, jerseys, caps and fan merchandise. Submit an order request and the NPL team will contact you to confirm payment and delivery.',
    image: new URL(DEFAULT_IMAGE_PATH, request.url).toString(),
    type: 'website',
  }
}

async function buildPreview(request) {
  const url = new URL(request.url)
  const parts = url.pathname.split('/').filter(Boolean)

  if (parts[0] === 'news' && parts[1]) {
    return previewForNews(parts[1], request)
  }

  /*
    Match pages must be detected before season pages.

    Supports:
    /matches/168
    /leagues/npl-super-40/seasons/mens-super-40-2026/matches/168/team-a-vs-team-b
  */
  const matchIndex = parts.indexOf('matches')

  if (matchIndex >= 0 && parts[matchIndex + 1]) {
    return previewForMatch(parts[matchIndex + 1], request)
  }

  if (parts[0] === 'teams' && parts[1]) {
    return previewForTeam(parts[1], request)
  }

  if (parts[0] === 'players' && parts[1]) {
    return previewForPlayer(parts[1], request)
  }

  if (parts[0] === 'leagues' && parts[1] && parts[2] === 'seasons' && parts[3]) {
    return previewForSeason(parts[1], parts[3], request)
  }

  if (parts[0] === 'leagues' && parts[1]) {
    return previewForLeague(parts[1], request)
  }

  if (parts[0] === 'fixtures') {
    return {
      title: `Fixtures | ${SITE_NAME}`,
      description: 'Upcoming NPL fixtures, venues and match schedules.',
      image: new URL(DEFAULT_IMAGE_PATH, request.url).toString(),
      type: 'website',
    }
  }

  if (parts[0] === 'results') {
    return {
      title: `Results | ${SITE_NAME}`,
      description: 'Latest NPL match results, scorecards and match summaries.',
      image: new URL(DEFAULT_IMAGE_PATH, request.url).toString(),
      type: 'website',
    }
  }

  if (parts[0] === 'merchandise') {
    return previewForMerchandise(request)
  }

  if (parts[0] === 'gallery') {
    return {
      title: `Gallery | ${SITE_NAME}`,
      description: 'NPL photos and video highlights.',
      image: new URL(DEFAULT_IMAGE_PATH, request.url).toString(),
      type: 'website',
    }
  }

  return defaultPreview(request)
}

function metaTags(preview, request) {
  const url = new URL(request.url)
  const title = preview.title.includes(SITE_NAME)
    ? preview.title
    : `${preview.title} | ${SITE_NAME}`

  const description = preview.description || DEFAULT_DESCRIPTION
  const image =
    preview.image || new URL(DEFAULT_IMAGE_PATH, request.url).toString()
  const type = preview.type || 'website'

  return `
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />

<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
<meta property="og:type" content="${escapeHtml(type)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:url" content="${escapeHtml(url.href)}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
`.trim()
}

function injectMeta(html, preview, request) {
  const cleaned = html
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\s+name=["']description["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+(property|name)=["']og:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+(property|name)=["']twitter:[^"']+["'][^>]*>\s*/gi, '')

  if (!cleaned.includes('</head>')) {
    return cleaned
  }

  return cleaned.replace('</head>', `${metaTags(preview, request)}\n</head>`)
}

export default async function handler(request, context) {
  const response = await context.next()
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('text/html')) {
    return response
  }

  const html = await response.text()
  const preview = await buildPreview(request)
  const body = injectMeta(html, preview, request)

  const headers = new Headers(response.headers)
  headers.set('content-type', 'text/html; charset=utf-8')
  headers.delete('content-length')

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
