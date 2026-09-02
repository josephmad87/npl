const SITE_NAME = 'National Premier League'
const DEFAULT_DESCRIPTION =
  'Latest fixtures, results, scorecards, news and standings from the National Premier League.'
const DEFAULT_IMAGE_PATH = '/apple-touch-icon.png'
const KNOWN_PUBLIC_PATHS = new Set([
  '/',
  '/mens',
  '/mens/fixtures',
  '/mens/results',
  '/mens/seasons',
  '/mens/teams',
  '/women',
  '/women/fixtures',
  '/women/results',
  '/women/seasons',
  '/women/teams',
  '/youth',
  '/youth/fixtures',
  '/youth/results',
  '/youth/seasons',
  '/youth/teams',
  '/fixtures',
  '/results',
  '/live',
  '/news',
  '/search',
  '/gallery',
  '/gallery/images',
  '/gallery/video',
  '/merchandise',
  '/compare-teams',
  '/about-us',
  '/contact-us',
  '/privacy',
  '/terms',
  '/support',
  '/account-deletion',
  '/competition',
  '/safeguarding',
  '/scorecard-corrections',
  '/supporters',
])

const MANAGED_PAGE_SLUGS = new Set([
  'privacy',
  'terms',
  'support',
  'account-deletion',
  'competition',
  'safeguarding',
  'scorecard-corrections',
  'supporters',
])

const STATIC_PAGE_PREVIEWS = {
  '/': {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
  },
  '/fixtures': {
    title: 'Cricket Fixtures',
    description: 'Upcoming NPL Zimbabwe cricket fixtures, dates, venues and match details.',
  },
  '/results': {
    title: 'Cricket Results',
    description: 'Latest official NPL Zimbabwe cricket results and completed scorecards.',
  },
  '/live': {
    title: 'Live Cricket Scores',
    description: 'Follow live NPL Zimbabwe cricket scores, ball-by-ball updates and scorecards.',
  },
  '/news': {
    title: 'Cricket News',
    description: 'Latest news, match reports and updates from NPL Zimbabwe club cricket.',
  },
  '/about-us': {
    title: 'About NPL Zimbabwe',
    description: 'Learn about National Premier League cricket in Zimbabwe.',
  },
  '/contact-us': {
    title: 'Contact NPL Zimbabwe',
    description: 'Contact NPL Zimbabwe about competitions, scores, media, support or merchandise.',
  },
  '/merchandise': {
    title: 'Official NPL Merchandise',
    description: 'Browse official National Premier League supporter merchandise.',
  },
  '/compare-teams': {
    title: 'Compare Teams',
    description: 'Compare NPL Zimbabwe cricket team records and performance.',
  },
  '/search': {
    title: 'Search NPL Zimbabwe',
    description: 'Search NPL Zimbabwe teams, players, fixtures, results and news.',
  },
}

function hasKnownRouteShape(pathname) {
  if (KNOWN_PUBLIC_PATHS.has(pathname)) return true
  return [
    /^\/news\/[^/]+$/,
    /^\/teams\/[^/]+$/,
    /^\/players\/[^/]+$/,
    /^\/merchandise\/[^/]+$/,
    /^\/merchandise\/teams\/[^/]+$/,
    /^\/leagues\/[^/]+$/,
    /^\/leagues\/[^/]+\/seasons\/[^/]+$/,
    /^\/leagues\/[^/]+\/seasons\/[^/]+\/matches\/\d+\/[^/]+$/,
  ].some((pattern) => pattern.test(pathname))
}

export { hasKnownRouteShape, matchSeoPath }

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

function seoSlug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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

async function fetchApiResource(path) {
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      headers: {
        accept: 'application/json',
      },
    })

    if (response.status === 404) {
      return { outcome: 'not-found', data: null }
    }
    if (!response.ok) {
      return { outcome: 'unavailable', data: null }
    }

    return { outcome: 'ok', data: await response.json() }
  } catch {
    return { outcome: 'unavailable', data: null }
  }
}

async function fetchAllApi(path) {
  const separator = path.includes('?') ? '&' : '?'
  const firstPage = await fetchApi(`${path}${separator}page=1&page_size=100`)
  const items = listItems(firstPage)
  const total = Number(firstPage?.total)
  const pageCount = Number.isFinite(total) ? Math.ceil(total / 100) : 1

  if (pageCount <= 1) {
    return items
  }

  const pages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      fetchApi(`${path}${separator}page=${index + 2}&page_size=100`),
    ),
  )

  return [...items, ...pages.flatMap((page) => listItems(page))]
}

function defaultPreview(request) {
  return {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    image: new URL(DEFAULT_IMAGE_PATH, request.url).toString(),
    type: 'website',
  }
}

function notFoundPreview(request) {
  return {
    ...defaultPreview(request),
    title: 'Page not found',
    description: 'The requested National Premier League page could not be found.',
    notFound: true,
  }
}

async function previewForNews(slug, request) {
  const resource = await fetchApiResource(`/public/news/${encodeURIComponent(slug)}`)
  const article = resource.data

  if (resource.outcome === 'not-found') {
    return notFoundPreview(request)
  }
  if (!article) return defaultPreview(request)

  return {
    title: cleanText(article.seo_title) || article.title || SITE_NAME,
    description:
      truncate(
        article.seo_description ||
          article.excerpt ||
          article.body ||
          DEFAULT_DESCRIPTION,
      ) ||
      DEFAULT_DESCRIPTION,
    image: absoluteUrl(
      article.featured_image_url || article.body_image_url,
      request.url,
    ),
    type: 'article',
    entityKind: 'article',
    entity: article,
    content: truncate(article.body || article.excerpt, 1800),
  }
}

async function fetchAllTeams() {
  if (teamNameCache) {
    return teamNameCache
  }

  const teams = await fetchAllApi('/public/teams')

  teamNameCache = teams
  return teams
}

async function fetchTeamById(teamId) {
  if (!teamId) {
    return null
  }

  const teams = await fetchAllTeams()

  return teams.find((team) => Number(team.id) === Number(teamId)) || null
}

async function fetchTeamNameById(teamId) {
  const team = await fetchTeamById(teamId)
  return cleanTeamName(team?.name) || null
}

async function merchandiseSeoRedirect(request) {
  const url = new URL(request.url)

  if (url.pathname !== '/merchandise' || !url.searchParams.has('team_id')) {
    return null
  }

  const rawTeamId = url.searchParams.get('team_id')
  url.searchParams.delete('team_id')

  if (!rawTeamId || rawTeamId === 'null') {
    return url
  }

  const team = await fetchTeamById(rawTeamId)
  const teamSlug = cleanText(team?.slug)

  if (teamSlug) {
    url.pathname = `/merchandise/teams/${encodeURIComponent(teamSlug)}`
  }

  return url
}

function matchSeoPath(match, homeName, awayName) {
  const leagueSlug =
    seoSlug(match.season?.league?.slug) ||
    seoSlug(match.league_slug) ||
    seoSlug(match.season?.league?.name) ||
    seoSlug(match.league_name)
  const seasonSlug =
    seoSlug(match.season?.slug) ||
    seoSlug(match.season_slug) ||
    seoSlug(match.season?.name) ||
    seoSlug(match.season_name)
  const homeSlug = seoSlug(homeName)
  const awaySlug = seoSlug(awayName)

  if (!leagueSlug || !seasonSlug || !homeSlug || !awaySlug || !match.id) {
    return null
  }

  return `/leagues/${leagueSlug}/seasons/${seasonSlug}/matches/${match.id}/${homeSlug}-vs-${awaySlug}`
}

async function legacySeoRedirect(request) {
  const merchandiseRedirect = await merchandiseSeoRedirect(request)
  if (merchandiseRedirect) {
    return merchandiseRedirect
  }

  const url = new URL(request.url)

  const staticAliases = new Map([
    ['/about', '/about-us'],
    ['/contact', '/contact-us'],
    ['/live-scores', '/live'],
    ['/scores', '/live'],
    ['/shop', '/merchandise'],
    ['/merch', '/merchandise'],
  ])
  const staticTarget = staticAliases.get(url.pathname)
  if (staticTarget) {
    url.pathname = staticTarget
    return url
  }

  const singularAliases = [
    [/^\/team\/([^/]+)$/, '/teams/'],
    [/^\/player\/([^/]+)$/, '/players/'],
    [/^\/article\/([^/]+)$/, '/news/'],
  ]
  for (const [pattern, prefix] of singularAliases) {
    const value = url.pathname.match(pattern)?.[1]
    if (value) {
      url.pathname = `${prefix}${value}`
      return url
    }
  }

  if (url.pathname === '/ladies' || url.pathname.startsWith('/ladies/')) {
    url.pathname = url.pathname.replace(/^\/ladies(?=\/|$)/, '/women')
    return url
  }

  const categorySeasonMatch = url.pathname.match(/^\/(mens|women|youth)\/seasons$/)
  const leagueSlug = cleanText(url.searchParams.get('leagueSlug'))
  if (categorySeasonMatch && leagueSlug) {
    url.pathname = `/leagues/${encodeURIComponent(leagueSlug)}`
    url.searchParams.delete('leagueSlug')
    return url
  }

  const matchId = url.pathname.match(/^\/(?:matches|match|scorecard)\/(\d+)$/)?.[1]
  if (matchId) {
    const match = await fetchApi(`/public/matches/${encodeURIComponent(matchId)}`)
    if (match) {
      const { homeName, awayName } = await resolvedMatchTeamNames(match)
      const path = matchSeoPath(match, homeName, awayName)
      if (path) {
        url.pathname = path
        return url
      }
    }
  }

  const canonicalMatchId = url.pathname.match(
    /^\/leagues\/[^/]+\/seasons\/[^/]+\/matches\/(\d+)(?:\/[^/]*)?$/,
  )?.[1]
  if (canonicalMatchId) {
    const match = await fetchApi(
      `/public/matches/${encodeURIComponent(canonicalMatchId)}`,
    )
    if (match) {
      const { homeName, awayName } = await resolvedMatchTeamNames(match)
      const canonicalPath = matchSeoPath(match, homeName, awayName)
      if (canonicalPath && canonicalPath !== url.pathname) {
        url.pathname = canonicalPath
        return url
      }
    }
  }

  const productSegment = url.pathname.match(/^\/merchandise\/([^/]+)$/)?.[1]
  const productId = merchandiseProductIdFromSegment(productSegment)
  if (productId) {
    const product = await fetchApi(
      `/public/merchandise/${encodeURIComponent(productId)}`,
    )
    const canonicalSegment = product
      ? `${seoSlug(product.name) || 'product'}-${productId}`
      : ''
    if (canonicalSegment && canonicalSegment !== productSegment) {
      url.pathname = `/merchandise/${canonicalSegment}`
      return url
    }
  }

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '')
    return url
  }

  if (/^\/(?:news|teams|players|leagues)\//.test(url.pathname)) {
    const registeredRedirect = await fetchApiResource(
      `/public/seo/redirect?path=${encodeURIComponent(url.pathname)}`,
    )
    const registeredTarget = cleanText(registeredRedirect.data?.target_path)
    if (
      registeredRedirect.outcome === 'ok' &&
      registeredTarget.startsWith('/') &&
      !registeredTarget.startsWith('//') &&
      registeredTarget !== url.pathname
    ) {
      url.pathname = registeredTarget
      return url
    }
  }

  return null
}

function listItems(data) {
  if (Array.isArray(data)) return data
  return Array.isArray(data?.items) ? data.items : []
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function sitemapLastmod(value) {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
}

function sitemapUrl(origin, path, lastmod = '') {
  const resolvedLastmod = sitemapLastmod(lastmod)
  return `<url><loc>${xmlEscape(new URL(path, origin).toString())}</loc>${
    resolvedLastmod ? `<lastmod>${xmlEscape(resolvedLastmod)}</lastmod>` : ''
  }</url>`
}

async function sitemapResponse(request) {
  const origin = new URL(request.url).origin
  const managedPagesPromise = Promise.all(
    [...MANAGED_PAGE_SLUGS].map((slug) =>
      fetchApi(`/public/site-pages/${encodeURIComponent(slug)}`),
    ),
  )
  const [teams, players, articles, leagues, products, fixtures, results, managedPages] =
    await Promise.all([
      fetchAllApi('/public/teams'),
      fetchAllApi('/public/players'),
      fetchAllApi('/public/news'),
      fetchAllApi('/public/leagues'),
      fetchAllApi('/public/merchandise'),
      fetchAllApi('/public/fixtures'),
      fetchAllApi('/public/results'),
      managedPagesPromise,
    ])

  const paths = new Map(
    [...KNOWN_PUBLIC_PATHS]
      .filter((path) => path !== '/search')
      .map((path) => [path, '']),
  )
  const addPath = (path, lastmod = '') => {
    const existing = sitemapLastmod(paths.get(path))
    const candidate = sitemapLastmod(lastmod)
    paths.set(path, candidate > existing ? candidate : existing)
  }

  for (const page of managedPages) {
    if (MANAGED_PAGE_SLUGS.has(page?.slug)) {
      addPath(`/${page.slug}`, page.updated_at)
    }
  }

  for (const team of teams) {
    if (seoSlug(team.slug)) addPath(`/teams/${encodeURIComponent(team.slug)}`, team.updated_at)
  }
  for (const player of players) {
    if (seoSlug(player.slug)) addPath(`/players/${encodeURIComponent(player.slug)}`, player.updated_at)
  }
  for (const article of articles) {
    if (seoSlug(article.slug)) {
      const articleLastmod = article.updated_at || article.published_at || article.created_at
      addPath(
        `/news/${encodeURIComponent(article.slug)}`,
        articleLastmod,
      )
      addPath('/news', articleLastmod)
    }
  }
  for (const league of leagues) {
    if (seoSlug(league.slug)) addPath(`/leagues/${encodeURIComponent(league.slug)}`, league.updated_at)
  }
  for (const product of products) {
    if (product.id) {
      const segment = `${seoSlug(product.name) || 'product'}-${product.id}`
      addPath(`/merchandise/${encodeURIComponent(segment)}`, product.updated_at)
      addPath('/merchandise', product.updated_at)
    }
  }
  for (const match of fixtures) {
    addPath('/fixtures', match.updated_at || match.match_date)
  }
  for (const match of results) {
    addPath('/results', match.updated_at || match.match_date)
  }
  for (const match of [...fixtures, ...results]) {
    const { homeName, awayName } = await resolvedMatchTeamNames(match)
    const path = matchSeoPath(match, homeName, awayName)
    if (path) addPath(path, match.updated_at || match.match_date)
  }

  const leaguesWithSlugs = leagues.filter((league) => seoSlug(league.slug))
  const seasonLists = await Promise.all(
    leaguesWithSlugs.map((league) =>
      fetchAllApi(`/public/leagues/${encodeURIComponent(league.slug)}/seasons`),
    ),
  )
  for (let index = 0; index < leaguesWithSlugs.length; index += 1) {
    const league = leaguesWithSlugs[index]
    for (const season of seasonLists[index]) {
      if (seoSlug(season.slug)) {
        addPath(
          `/leagues/${encodeURIComponent(league.slug)}/seasons/${encodeURIComponent(season.slug)}`,
          season.updated_at || season.end_date || season.start_date,
        )
      }
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...paths.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, lastmod]) => sitemapUrl(origin, path, lastmod))
    .join('\n')}\n</urlset>`

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=UTF-8',
      'cache-control': 'public, max-age=3600',
    },
  })
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

function inningsScoreParts(match) {
  const text = cleanText(
    match.result?.innings_breakdown ||
      match.result?.score_summary ||
      '',
  )

  if (!text) {
    return []
  }

  return text
    .split(';')
    .map((part) => {
      const cleaned = cleanText(part)
      const found = cleaned.match(/^(.*?)\s+(\d+)\/\d+/)

      if (!found) {
        return null
      }

      return {
        teamName: cleanTeamName(found[1]),
        runs: Number(found[2]),
      }
    })
    .filter(Boolean)
}

function marginOnlyText(margin) {
  const text = cleanText(margin)

  if (!text) {
    return ''
  }

  return text.replace(/^.*?\bwon\s+by\s+/i, '').trim()
}

function winnerNameFromScoreText(match, margin) {
  const innings = inningsScoreParts(match)

  if (innings.length < 2) {
    return ''
  }

  if (/wickets?/i.test(margin)) {
    return innings[1]?.teamName || ''
  }

  if (/runs?/i.test(margin)) {
    const sorted = [...innings].sort((a, b) => b.runs - a.runs)

    if (sorted[0]?.runs !== sorted[1]?.runs) {
      return sorted[0]?.teamName || ''
    }
  }

  return ''
}

function readableMarginText(match, homeName, awayName) {
  const result = match.result

  if (!result) {
    return ''
  }

  const margin = cleanText(result.margin_text)

  if (!margin) {
    return ''
  }

  const marginOnly = marginOnlyText(margin)
  const winnerFromScores = winnerNameFromScoreText(match, margin)

  if (winnerFromScores && marginOnly) {
    return `${winnerFromScores} won by ${marginOnly.toLowerCase()}`
  }

  const winnerId = Number(result.winning_team_id)
  const homeId = Number(match.home_team_id)
  const awayId = Number(match.away_team_id)

  let winnerName = ''

  if (winnerId && winnerId === homeId) {
    winnerName = homeName
  } else if (winnerId && winnerId === awayId) {
    winnerName = awayName
  }

  if (/won\s+by/i.test(margin)) {
    return margin
  }

  if (winnerName && marginOnly) {
    return `${winnerName} won by ${marginOnly.toLowerCase()}`
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
  const resource = await fetchApiResource(`/public/matches/${encodeURIComponent(matchId)}`)
  const match = resource.data

  if (resource.outcome === 'not-found') {
    return notFoundPreview(request)
  }
  if (!match) return defaultPreview(request)

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
    entityKind: 'match',
    entity: { ...match, homeName, awayName },
  }
}

async function previewForTeam(slug, request) {
  const resource = await fetchApiResource(`/public/teams/${encodeURIComponent(slug)}`)
  const team = resource.data

  if (resource.outcome === 'not-found') {
    return notFoundPreview(request)
  }
  if (!team) return defaultPreview(request)

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
    entityKind: 'team',
    entity: team,
  }
}

async function previewForPlayer(slug, request) {
  const resource = await fetchApiResource(`/public/players/${encodeURIComponent(slug)}`)
  const player = resource.data

  if (resource.outcome === 'not-found') {
    return notFoundPreview(request)
  }
  if (!player) return defaultPreview(request)

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
    entityKind: 'player',
    entity: player,
  }
}

async function previewForLeague(slug, request) {
  const resource = await fetchApiResource(`/public/leagues/${encodeURIComponent(slug)}`)
  const league = resource.data

  if (resource.outcome === 'not-found') {
    return notFoundPreview(request)
  }
  if (!league) return defaultPreview(request)

  return {
    title: league.name || SITE_NAME,
    description:
      truncate(
        league.description ||
          `${league.name} fixtures, results, standings and statistics.`,
      ) || DEFAULT_DESCRIPTION,
    image: absoluteUrl(league.banner_url || league.logo_url, request.url),
    type: 'website',
    entityKind: 'league',
    entity: league,
  }
}

async function previewForSeason(leagueSlug, seasonSlug, request) {
  const resource = await fetchApiResource(
    `/public/leagues/${encodeURIComponent(
      leagueSlug,
    )}/seasons/${encodeURIComponent(seasonSlug)}`,
  )
  const season = resource.data

  if (resource.outcome === 'not-found') {
    return notFoundPreview(request)
  }
  if (!season) return defaultPreview(request)

  return {
    title: `${season.name || 'Season'} | ${SITE_NAME}`,
    description:
      truncate(
        `${season.name || 'Season'} standings, fixtures, results and player statistics.`,
      ) || DEFAULT_DESCRIPTION,
    image: new URL(DEFAULT_IMAGE_PATH, request.url).toString(),
    type: 'website',
    entityKind: 'season',
    entity: { ...season, leagueSlug },
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

function merchandiseProductIdFromSegment(segment) {
  const match = String(segment ?? '').match(/(?:^|-)(\d+)$/)
  const productId = Number(match?.[1])
  return Number.isSafeInteger(productId) && productId > 0 ? productId : null
}

async function previewForMerchandiseProduct(productId, request) {
  const resource = await fetchApiResource(
    `/public/merchandise/${encodeURIComponent(productId)}`,
  )
  const product = resource.data

  if (resource.outcome === 'not-found') {
    return notFoundPreview(request)
  }
  if (!product) return defaultPreview(request)

  const name = cleanText(product.name) || 'Official NPL Merchandise'
  const description =
    truncate(product.description) ||
    `Shop ${name} from the National Premier League official merchandise collection.`

  return {
    title: name,
    description,
    image: absoluteUrl(product.image_url, request.url),
    type: 'product',
    entityKind: 'product',
    entity: product,
  }
}

async function previewForTeamMerchandise(teamSlug, request) {
  const resource = await fetchApiResource(
    `/public/teams/${encodeURIComponent(teamSlug)}`,
  )
  const team = resource.data

  if (resource.outcome === 'not-found') {
    return notFoundPreview(request)
  }
  if (!team) return defaultPreview(request)

  const teamName = cleanText(team.name) || 'NPL Team'

  return {
    title: `${teamName} Merchandise`,
    description: `Shop official ${teamName} supporter merchandise from the National Premier League.`,
    image: absoluteUrl(team.logo_url, request.url),
    type: 'website',
  }
}

async function previewForManagedPage(slug, request) {
  const page = await fetchApi(`/public/site-pages/${encodeURIComponent(slug)}`)
  if (!page) {
    return {
      ...defaultPreview(request),
      title: slug
        .split('-')
        .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
        .join(' '),
    }
  }

  return {
    title: page.title || SITE_NAME,
    description: truncate(page.subtitle || page.intro_html) || DEFAULT_DESCRIPTION,
    image: new URL(DEFAULT_IMAGE_PATH, request.url).toString(),
    type: 'website',
    entityKind: 'managed-page',
    entity: page,
    content: truncate(
      [
        page.intro_html,
        ...(Array.isArray(page.sections)
          ? page.sections.flatMap((section) => [section.heading, section.body_html])
          : []),
      ]
        .filter(Boolean)
        .join(' '),
      2400,
    ),
  }
}

async function buildPreview(request) {
  const url = new URL(request.url)
  const parts = url.pathname.split('/').filter(Boolean)

  if (!hasKnownRouteShape(url.pathname)) {
    return notFoundPreview(request)
  }

  if (parts.length === 1 && MANAGED_PAGE_SLUGS.has(parts[0])) {
    return previewForManagedPage(parts[0], request)
  }

  if (parts[0] === 'news' && parts[1]) {
    return previewForNews(parts[1], request)
  }

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

  if (['mens', 'women', 'youth'].includes(parts[0])) {
    const categoryLabels = { mens: "Men's", women: "Women's", youth: 'Youth' }
    const sectionLabels = {
      fixtures: 'Fixtures',
      results: 'Results',
      seasons: 'Seasons',
      teams: 'Teams',
    }
    const category = categoryLabels[parts[0]]
    const section = sectionLabels[parts[1]] || 'Cricket'
    return {
      ...defaultPreview(request),
      title: `${category} ${section}`,
      description: `${category} NPL Zimbabwe ${section.toLowerCase()}, competition information and club cricket updates.`,
    }
  }

  if (parts[0] === 'merchandise' && parts[1] === 'teams' && parts[2]) {
    return previewForTeamMerchandise(parts[2], request)
  }

  if (parts[0] === 'merchandise' && parts[1]) {
    const productId = merchandiseProductIdFromSegment(parts[1])
    if (productId) {
      return previewForMerchandiseProduct(productId, request)
    }
    return notFoundPreview(request)
  }

  if (parts[0] === 'merchandise') {
    return previewForMerchandise(request)
  }

  if (parts[0] === 'gallery') {
    const galleryTitle = parts[1] === 'images'
      ? 'Photo Gallery'
      : parts[1] === 'video'
        ? 'Video Gallery'
        : 'Gallery'
    return {
      title: galleryTitle,
      description: `${galleryTitle} featuring NPL Zimbabwe cricket highlights.`,
      image: new URL(DEFAULT_IMAGE_PATH, request.url).toString(),
      type: 'website',
    }
  }

  const staticPreview = STATIC_PAGE_PREVIEWS[url.pathname]
  if (staticPreview) {
    return {
      ...defaultPreview(request),
      ...staticPreview,
    }
  }

  return defaultPreview(request)
}

function metaTags(preview, request) {
  const url = new URL(request.url)
  const isInternalSearch =
    url.pathname === '/search' ||
    (url.pathname === '/news' && url.searchParams.has('q'))
  const deploymentContext = cleanText(env('CONTEXT')).toLowerCase()
  const productionHost = ['npl.co.zw', 'www.npl.co.zw'].includes(url.hostname)
  const isNonProduction =
    (deploymentContext && deploymentContext !== 'production') || !productionHost
  const robots = preview.notFound || isInternalSearch || isNonProduction
    ? 'noindex,follow'
    : 'index,follow,max-image-preview:large'
  url.search = ''
  url.hash = ''
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
<meta name="robots" content="${robots}" />
<link rel="canonical" href="${escapeHtml(url.href)}" />

<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
<meta property="og:type" content="${escapeHtml(type)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:image:alt" content="${escapeHtml(title)}" />
<meta property="og:url" content="${escapeHtml(url.href)}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
<meta name="twitter:image:alt" content="${escapeHtml(title)}" />
`.trim()
}

function titleCase(value) {
  return cleanText(value)
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function previewBreadcrumbs(preview, request) {
  const url = new URL(request.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const current =
    cleanText(preview.entityKind === 'article' ? preview.entity?.title : preview.title) ||
    SITE_NAME
  const home = { name: 'Home', path: '/' }

  if (parts.length === 0) return [{ name: 'Home', path: '/' }]
  if (preview.entityKind === 'article') {
    return [home, { name: 'News', path: '/news' }, { name: current, path: url.pathname }]
  }
  if (preview.entityKind === 'product') {
    return [home, { name: 'Merchandise', path: '/merchandise' }, { name: current, path: url.pathname }]
  }
  if (preview.entityKind === 'team') {
    const category = ['mens', 'women', 'youth'].includes(preview.entity?.category)
      ? preview.entity.category
      : 'mens'
    return [
      home,
      { name: 'Teams', path: `/${category}/teams` },
      { name: current, path: url.pathname },
    ]
  }
  if (preview.entityKind === 'player') {
    return [home, { name: 'Players', path: '/mens/teams' }, { name: current, path: url.pathname }]
  }
  if (preview.entityKind === 'match') {
    return [home, { name: 'Fixtures and results', path: '/fixtures' }, { name: current, path: url.pathname }]
  }
  if (preview.entityKind === 'season') {
    return [
      home,
      { name: 'Competition information', path: '/competition' },
      { name: current, path: url.pathname },
    ]
  }
  if (preview.entityKind === 'league') {
    return [
      home,
      { name: 'Competition information', path: '/competition' },
      { name: current, path: url.pathname },
    ]
  }

  return [home, { name: current || titleCase(parts.at(-1)), path: url.pathname }]
}

function entityStructuredData(preview, request) {
  const entity = preview.entity || {}
  const url = new URL(request.url)
  url.search = ''
  url.hash = ''
  const common = {
    '@context': 'https://schema.org',
    url: url.toString(),
  }

  if (preview.entityKind === 'article') {
    return {
      ...common,
      '@type': 'NewsArticle',
      headline: cleanText(entity.title) || preview.title,
      description: preview.description,
      image: [preview.image].filter(Boolean),
      datePublished: entity.published_at || entity.created_at || undefined,
      dateModified: entity.updated_at || entity.published_at || entity.created_at || undefined,
      author: {
        '@type': entity.author_name ? 'Person' : 'Organization',
        name: cleanText(entity.author_name) || SITE_NAME,
      },
      publisher: { '@type': 'Organization', name: SITE_NAME },
      keywords: Array.isArray(entity.tags) ? entity.tags.join(', ') : undefined,
      mainEntityOfPage: url.toString(),
    }
  }
  if (preview.entityKind === 'match') {
    const statusMap = {
      scheduled: 'https://schema.org/EventScheduled',
      live: 'https://schema.org/EventInProgress',
      completed: 'https://schema.org/EventCompleted',
      abandoned: 'https://schema.org/EventCancelled',
      cancelled: 'https://schema.org/EventCancelled',
    }
    return {
      ...common,
      '@type': 'SportsEvent',
      name: `${cleanText(entity.homeName)} vs ${cleanText(entity.awayName)}`,
      sport: 'Cricket',
      startDate: entity.start_time || entity.match_date || undefined,
      eventStatus: statusMap[entity.status] || 'https://schema.org/EventScheduled',
      location: entity.venue
        ? { '@type': 'Place', name: cleanText(entity.venue) }
        : undefined,
      competitor: [entity.homeName, entity.awayName]
        .filter(Boolean)
        .map((name) => ({ '@type': 'SportsTeam', name: cleanText(name) })),
      description: preview.description,
      image: preview.image,
    }
  }
  if (preview.entityKind === 'team') {
    return {
      ...common,
      '@type': 'SportsTeam',
      name: cleanText(entity.name) || preview.title,
      sport: 'Cricket',
      description: preview.description,
      logo: preview.image,
      location: entity.home_ground
        ? { '@type': 'Place', name: cleanText(entity.home_ground) }
        : undefined,
    }
  }
  if (preview.entityKind === 'player') {
    return {
      ...common,
      '@type': 'Person',
      name: cleanText(entity.full_name) || preview.title,
      description: preview.description,
      image: preview.image,
      nationality: cleanText(entity.nationality) || undefined,
      affiliation: entity.team_name
        ? { '@type': 'SportsTeam', name: cleanText(entity.team_name) }
        : undefined,
    }
  }
  if (preview.entityKind === 'league') {
    return {
      ...common,
      '@type': 'SportsOrganization',
      name: cleanText(entity.name) || preview.title,
      sport: 'Cricket',
      description: preview.description,
      logo: preview.image,
    }
  }
  if (preview.entityKind === 'season') {
    return {
      ...common,
      '@type': 'CollectionPage',
      name: cleanText(entity.name) || preview.title,
      description: preview.description,
      dateCreated: entity.start_date || undefined,
      expires: entity.end_date || undefined,
    }
  }
  if (preview.entityKind === 'product') {
    return {
      ...common,
      '@type': 'Product',
      name: cleanText(entity.name) || preview.title,
      description: preview.description,
      image: [entity.image_url, entity.image_url_2, entity.image_url_3]
        .filter(Boolean)
        .map((image) => absoluteUrl(image, request.url)),
      category: cleanText(entity.category) || undefined,
    }
  }
  if (preview.entityKind === 'managed-page') {
    return {
      ...common,
      '@type': 'WebPage',
      name: cleanText(entity.title) || preview.title,
      description: preview.description,
      dateModified: entity.updated_at || undefined,
    }
  }

  return {
    ...common,
    '@type': 'WebPage',
    name: preview.title,
    description: preview.description || DEFAULT_DESCRIPTION,
  }
}

function safeJsonLd(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
}

function structuredDataTags(preview, request) {
  const url = new URL(request.url)
  url.search = ''
  url.hash = ''
  const breadcrumbs = previewBreadcrumbs(preview, request)
  const values = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: url.origin,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${url.origin}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: new URL(item.path, url.origin).toString(),
      })),
    },
    entityStructuredData(preview, request),
  ].filter(Boolean)

  return values
    .map(
      (value) =>
        `<script type="application/ld+json" data-npl-edge-jsonld>${safeJsonLd(value)}</script>`,
    )
    .join('\n')
}

function prerenderedContent(preview, request) {
  const url = new URL(request.url)
  const heading = preview.entityKind === 'article'
    ? cleanText(preview.entity?.title) || preview.title
    : preview.title
  const breadcrumbs = previewBreadcrumbs(preview, request)
  const breadcrumbHtml = breadcrumbs
    .map((item, index) => {
      const content = index === breadcrumbs.length - 1
        ? `<span aria-current="page">${escapeHtml(item.name)}</span>`
        : `<a href="${escapeHtml(item.path)}">${escapeHtml(item.name)}</a>`
      return `<li>${content}</li>`
    })
    .join('')
  const related = [
    ['/fixtures', 'Fixtures'],
    ['/results', 'Results'],
    ['/news', 'News'],
    ['/competition', 'Competition information'],
  ].filter(([path]) => path !== url.pathname)

  return `<main data-npl-edge-prerender>
  <nav aria-label="Breadcrumb"><ol>${breadcrumbHtml}</ol></nav>
  <article>
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(preview.description || DEFAULT_DESCRIPTION)}</p>
    ${preview.content && preview.content !== preview.description
      ? `<p>${escapeHtml(preview.content)}</p>`
      : ''}
  </article>
  <nav aria-label="Related NPL pages">${related
    .map(([path, label]) => `<a href="${path}">${escapeHtml(label)}</a>`)
    .join(' ')}</nav>
</main>`
}

function injectMeta(html, preview, request) {
  const cleaned = html
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\s+name=["']description["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+name=["']robots["'][^>]*>\s*/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+(property|name)=["']og:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+(property|name)=["']twitter:[^"']+["'][^>]*>\s*/gi, '')
    .replace(/<script\s+type=["']application\/ld\+json["'][^>]*data-npl-edge-jsonld[^>]*>[\s\S]*?<\/script>\s*/gi, '')

  if (!cleaned.includes('</head>')) {
    return cleaned
  }

  const withHead = cleaned.replace(
    '</head>',
    `${metaTags(preview, request)}\n${structuredDataTags(preview, request)}\n</head>`,
  )
  const prerendered = prerenderedContent(preview, request)
  if (!prerendered) return withHead

  return withHead.replace(
    /<div\s+id=["']root["']\s*>[\s\S]*?<\/div>/i,
    `<div id="root">${prerendered}</div>`,
  )
}

export default async function handler(request, context) {
  const url = new URL(request.url)

  if (url.pathname === '/sitemap.xml') {
    return sitemapResponse(request)
  }

  const redirectUrl = await legacySeoRedirect(request)
  if (redirectUrl) {
    return Response.redirect(redirectUrl.toString(), 301)
  }

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
    status: preview.notFound ? 404 : response.status,
    statusText: preview.notFound ? 'Not Found' : response.statusText,
    headers,
  })
}
