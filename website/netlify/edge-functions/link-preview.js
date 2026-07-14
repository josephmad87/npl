const SITE_NAME = 'National Premier League'
const DEFAULT_DESCRIPTION =
  'Latest fixtures, results, scorecards, news and standings from the National Premier League.'
const DEFAULT_IMAGE_PATH = '/apple-touch-icon.png'

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

function truncate(value, max = 180) {
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

async function previewForMatch(matchId, request) {
  const match = await fetchApi(`/public/matches/${encodeURIComponent(matchId)}`)

  if (!match) {
    return defaultPreview(request)
  }

  const homeName =
    match.home_team?.name || match.home_team_name || `Team ${match.home_team_id}`
  const awayName =
    match.away_team?.name || match.away_team_name || `Team ${match.away_team_id}`

  const title = match.title || `${homeName} vs ${awayName}`

  const description =
    truncate(
      match.result?.score_summary ||
        match.result?.innings_breakdown ||
        match.result?.margin_text ||
        [match.venue, match.match_date, match.status].filter(Boolean).join(' · '),
    ) || DEFAULT_DESCRIPTION

  return {
    title,
    description,
    image: absoluteUrl(
      match.cover_image_url ||
        match.home_team?.logo_url ||
        match.away_team?.logo_url,
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
  const products = await fetchApi('/public/merchandise?page=1&page_size=12')

  const items = Array.isArray(products?.items) ? products.items : []
  const firstProductWithImage = items.find((item) => item?.image_url)

  return {
    title: 'Official NPL Merchandise',
    description:
      'Shop official National Premier League supporter gear, jerseys, caps and fan merchandise. Submit an order request and the NPL team will contact you to confirm payment and delivery.',
    image: absoluteUrl(firstProductWithImage?.image_url, request.url),
    type: 'website',
  }
}



async function buildPreview(request) {
  const url = new URL(request.url)
  const parts = url.pathname.split('/').filter(Boolean)

  if (parts[0] === 'news' && parts[1]) {
    return previewForNews(parts[1], request)
  }

  if (parts[0] === 'matches' && parts[1]) {
    return previewForMatch(parts[1], request)
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
  const image = preview.image || new URL(DEFAULT_IMAGE_PATH, request.url).toString()
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
