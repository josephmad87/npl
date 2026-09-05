import assert from 'node:assert/strict'
import test from 'node:test'

import handler, {
  hasKnownRouteShape,
  matchSeoPath,
} from '../netlify/edge-functions/link-preview.js'

const match = {
  id: 42,
  home_team_id: 1,
  away_team_id: 2,
  home_team: { name: 'Old Hararians' },
  away_team: { name: 'Scorpions Cricket Club' },
  season: {
    slug: 'mens-super-40-2026',
    name: "Men's Super 40 2026",
    league: { slug: 'npl-super-40', name: 'NPL Super 40' },
  },
}

function htmlContext() {
  return {
    next: async () =>
      new Response('<!doctype html><html><head><title>NPL</title></head><body><div id="root"></div></body></html>', {
        headers: { 'content-type': 'text/html' },
      }),
  }
}

test('match paths require both real team names', () => {
  assert.equal(matchSeoPath(match, '', ''), null)
  assert.equal(
    matchSeoPath(match, 'Old Hararians', 'Scorpions Cricket Club'),
    '/leagues/npl-super-40/seasons/mens-super-40-2026/matches/42/old-hararians-vs-scorpions-cricket-club',
  )
})

test('only declared application route shapes are accepted', () => {
  assert.equal(hasKnownRouteShape('/fixtures'), true)
  assert.equal(hasKnownRouteShape('/teams/old-hararians'), true)
  assert.equal(hasKnownRouteShape('/news/story/extra'), false)
  assert.equal(hasKnownRouteShape('/definitely-missing'), false)
})

test('unknown client route returns genuine 404 HTML and noindex', async () => {
  const response = await handler(
    new Request('https://npl.co.zw/definitely-missing'),
    htmlContext(),
  )
  assert.equal(response.status, 404)
  assert.match(await response.text(), /name="robots" content="noindex,follow"/)
})

test('missing dynamic resource returns 404 but API outage does not', async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => {
    globalThis.fetch = originalFetch
  })

  globalThis.fetch = async () => new Response(null, { status: 404 })
  const missing = await handler(
    new Request('https://npl.co.zw/news/missing-story'),
    htmlContext(),
  )
  assert.equal(missing.status, 404)

  globalThis.fetch = async () => new Response(null, { status: 503 })
  const unavailable = await handler(
    new Request('https://npl.co.zw/news/real-story'),
    htmlContext(),
  )
  assert.equal(unavailable.status, 200)
})

test('malformed match slugs redirect to the canonical team URL', async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => {
    globalThis.fetch = originalFetch
  })
  globalThis.fetch = async (url) => {
    assert.match(String(url), /\/public\/matches\/42$/)
    return Response.json(match)
  }

  const response = await handler(
    new Request(
      'https://npl.co.zw/leagues/npl-super-40/seasons/mens-super-40-2026/matches/42/-vs-',
    ),
    htmlContext(),
  )
  assert.equal(response.status, 301)
  assert.equal(
    response.headers.get('location'),
    'https://npl.co.zw/leagues/npl-super-40/seasons/mens-super-40-2026/matches/42/old-hararians-vs-scorpions-cricket-club',
  )
})

test('sitemap resolves team IDs instead of emitting empty match slugs', async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => {
    globalThis.fetch = originalFetch
  })
  globalThis.fetch = async (rawUrl) => {
    const url = new URL(String(rawUrl))
    if (url.pathname.endsWith('/public/teams')) {
      return Response.json({
        items: [
          { id: 1, name: 'Old Hararians', slug: 'old-hararians' },
          { id: 2, name: 'Scorpions Cricket Club', slug: 'scorpions-cricket-club' },
        ],
        total: 2,
      })
    }
    if (url.pathname.endsWith('/public/fixtures')) {
      return Response.json({ items: [{ ...match, home_team: null, away_team: null }], total: 1 })
    }
    return Response.json({ items: [], total: 0 })
  }

  const response = await handler(
    new Request('https://npl.co.zw/sitemap.xml'),
    htmlContext(),
  )
  const sitemap = await response.text()
  assert.doesNotMatch(sitemap, /\/-vs-/)
  assert.match(sitemap, /old-hararians-vs-scorpions-cricket-club/)
})

test('legacy route aliases use permanent redirects', async () => {
  const response = await handler(
    new Request('https://npl.co.zw/shop'),
    htmlContext(),
  )

  assert.equal(response.status, 301)
  assert.equal(response.headers.get('location'), 'https://npl.co.zw/merchandise')
})

test('numeric merchandise URLs redirect to a descriptive canonical path', async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => {
    globalThis.fetch = originalFetch
  })
  globalThis.fetch = async (rawUrl) => {
    assert.match(String(rawUrl), /\/public\/merchandise\/34$/)
    return Response.json({ id: 34, name: 'Takashinga Flame Bucket Hat' })
  }

  const response = await handler(
    new Request('https://npl.co.zw/merchandise/34'),
    htmlContext(),
  )

  assert.equal(response.status, 301)
  assert.equal(
    response.headers.get('location'),
    'https://npl.co.zw/merchandise/takashinga-flame-bucket-hat-34',
  )
})

test('WhatsApp receives an optimised main product image in Open Graph metadata', async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => {
    globalThis.fetch = originalFetch
  })
  const product = {
    id: 69,
    name: 'Takashinga Flame Jersey',
    description: 'Official Takashinga Flame Jersey.',
    image_url: 'https://images.example.com/flame-jersey.png',
    image_url_2: '',
    image_url_3: '',
  }
  globalThis.fetch = async (rawUrl) => {
    assert.match(String(rawUrl), /\/public\/merchandise\/69$/)
    return Response.json(product)
  }

  const response = await handler(
    new Request('https://npl.co.zw/merchandise/takashinga-flame-jersey-69', {
      headers: { 'user-agent': 'WhatsApp/2.26.1' },
    }),
    htmlContext(),
  )
  const html = await response.text()

  assert.equal(response.status, 200)
  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/npl\.co\.zw\/merchandise\/takashinga-flame-jersey-69"/,
  )
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/npl\.co\.zw\/\.netlify\/images\?url=https%3A%2F%2Fimages\.example\.com%2Fflame-jersey\.png&amp;w=1200&amp;fm=jpg&amp;q=82"/,
  )
  assert.match(
    html,
    /<meta property="og:image:secure_url" content="https:\/\/npl\.co\.zw\/\.netlify\/images\?url=https%3A%2F%2Fimages\.example\.com%2Fflame-jersey\.png&amp;w=1200&amp;fm=jpg&amp;q=82"/,
  )
  assert.match(
    html,
    /<meta property="og:image:type" content="image\/jpeg"/,
  )
})

test('registered historical slugs redirect directly to the current URL', async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => {
    globalThis.fetch = originalFetch
  })
  globalThis.fetch = async (rawUrl) => {
    const url = new URL(String(rawUrl))
    assert.equal(url.pathname.endsWith('/public/seo/redirect'), true)
    assert.equal(url.searchParams.get('path'), '/teams/old-name')
    return Response.json({
      source_path: '/teams/old-name',
      target_path: '/teams/current-name',
      status_code: 301,
    })
  }

  const response = await handler(
    new Request('https://npl.co.zw/teams/old-name'),
    htmlContext(),
  )

  assert.equal(response.status, 301)
  assert.equal(response.headers.get('location'), 'https://npl.co.zw/teams/current-name')
})

test('article HTML includes editorial metadata, schema, breadcrumbs and crawlable content', async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => {
    globalThis.fetch = originalFetch
  })
  globalThis.fetch = async (rawUrl) => {
    const url = new URL(String(rawUrl))
    if (url.pathname.endsWith('/public/seo/redirect')) {
      return Response.json({}, { status: 404 })
    }
    if (url.pathname.endsWith('/public/news/final-report')) {
      return Response.json({
        title: 'Final report',
        slug: 'final-report',
        excerpt: 'The deciding match report.',
        seo_title: 'NPL final report',
        seo_description: 'Official report from the NPL final.',
        featured_image_url: '/uploads/final.webp',
        author_name: 'NPL Media',
        tags: ['final', 'report'],
        published_at: '2026-08-31T12:00:00Z',
        updated_at: '2026-09-01T08:00:00Z',
      })
    }
    return Response.json({}, { status: 404 })
  }

  const response = await handler(
    new Request('https://npl.co.zw/news/final-report'),
    htmlContext(),
  )
  const html = await response.text()

  assert.equal(response.status, 200)
  assert.match(html, /<title>NPL final report \| National Premier League<\/title>/)
  assert.match(html, /"@type":"NewsArticle"/)
  assert.match(html, /"@type":"BreadcrumbList"/)
  assert.match(html, /data-npl-edge-prerender/)
  assert.match(html, /<h1>Final report<\/h1>/)
})

test('sitemap emits lastmod for dated editorial and managed content', async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => {
    globalThis.fetch = originalFetch
  })
  globalThis.fetch = async (rawUrl) => {
    const url = new URL(String(rawUrl))
    if (url.pathname.endsWith('/public/news')) {
      return Response.json({
        items: [
          {
            slug: 'dated-story',
            updated_at: '2026-09-01T10:30:00Z',
          },
        ],
        total: 1,
      })
    }
    if (url.pathname.endsWith('/public/site-pages/safeguarding')) {
      return Response.json({
        slug: 'safeguarding',
        updated_at: '2026-08-30T09:00:00Z',
      })
    }
    return Response.json({ items: [], total: 0 })
  }

  const response = await handler(
    new Request('https://npl.co.zw/sitemap.xml'),
    htmlContext(),
  )
  const sitemap = await response.text()

  assert.match(
    sitemap,
    /<loc>https:\/\/npl\.co\.zw\/news\/dated-story<\/loc><lastmod>2026-09-01T10:30:00\.000Z<\/lastmod>/,
  )
  assert.match(
    sitemap,
    /<loc>https:\/\/npl\.co\.zw\/safeguarding<\/loc><lastmod>2026-08-30T09:00:00\.000Z<\/lastmod>/,
  )
})

test('managed information pages are rendered with editable public content', async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => {
    globalThis.fetch = originalFetch
  })
  globalThis.fetch = async (rawUrl) => {
    assert.match(String(rawUrl), /\/public\/site-pages\/safeguarding$/)
    return Response.json({
      slug: 'safeguarding',
      title: 'Safeguarding',
      subtitle: 'How to report a cricket safeguarding concern.',
      intro_html: '<p>Cricket must be safe for everyone.</p>',
      sections: [
        {
          id: 'report',
          heading: 'Report a concern',
          body_html: '<p>Use the confidential reporting route.</p>',
        },
      ],
      updated_at: '2026-09-01T11:00:00Z',
    })
  }

  const response = await handler(
    new Request('https://npl.co.zw/safeguarding'),
    htmlContext(),
  )
  const html = await response.text()

  assert.equal(response.status, 200)
  assert.match(html, /<h1>Safeguarding<\/h1>/)
  assert.match(html, /Cricket must be safe for everyone/)
  assert.match(html, /Report a concern/)
  assert.match(html, /"dateModified":"2026-09-01T11:00:00Z"/)
})
