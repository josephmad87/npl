import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import './App.css'

type TeamStat = {
  team: string
  played: number
  points: number
  netRunRate: number
}

type ApiNewsArticle = {
  id: number
  title: string
  slug: string
  excerpt: string | null
  featured_image_url: string | null
  published_at: string | null
}

const fetchStandings = async (): Promise<TeamStat[]> => {
  return Promise.resolve([
    { team: 'Eagles', played: 8, points: 14, netRunRate: 1.24 },
    { team: 'Rhinos', played: 8, points: 12, netRunRate: 0.8 },
    { team: 'Lions', played: 8, points: 10, netRunRate: 0.31 },
    { team: 'Panthers', played: 8, points: 8, netRunRate: -0.15 },
  ])
}

const getApiBaseUrl = () => {
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
  if (!baseUrl) {
    throw new Error('Missing VITE_API_BASE_URL. Set it in website/.env')
  }
  return baseUrl.replace(/\/+$/, '')
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return (await response.json()) as T
}

function extractList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === 'object') {
    const bag = payload as Record<string, unknown>
    const list = bag.items ?? bag.data ?? bag.results
    if (Array.isArray(list)) return list as T[]
  }
  return []
}

const resolveMediaUrl = (raw: string | null | undefined): string | null => {
  const value = raw?.trim() ?? ''
  if (!value) return null
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (value.startsWith('//')) return `${globalThis.location.protocol}${value}`
  if (value.startsWith('/')) {
    try {
      return `${new URL(getApiBaseUrl()).origin}${value}`
    } catch {
      return value
    }
  }
  return value
}

const fetchNewsArticles = async (): Promise<ApiNewsArticle[]> => {
  const payload = await fetchJson<unknown>('/public/news?page=1&page_size=6')
  return extractList<ApiNewsArticle>(payload)
}

const columnHelper = createColumnHelper<TeamStat>()
const columns = [
  columnHelper.accessor('team', {
    header: 'Team',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('played', {
    header: 'Played',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('points', {
    header: 'Points',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('netRunRate', {
    header: 'NRR',
    cell: (info) => info.getValue().toFixed(2),
  }),
]

function App() {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['standings'],
    queryFn: fetchStandings,
  })
  const { data: newsArticles = [] } = useQuery({
    queryKey: ['public-news'],
    queryFn: fetchNewsArticles,
    retry: 1,
  })
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)

  const heroSlides = useMemo(
    () =>
      newsArticles.map((article) => ({
        ...article,
        heroImage: resolveMediaUrl(article.featured_image_url),
      })),
    [newsArticles],
  )

  useEffect(() => {
    setActiveSlideIndex(0)
  }, [heroSlides.length])

  useEffect(() => {
    if (heroSlides.length < 2) return

    const timer = globalThis.setInterval(() => {
      setActiveSlideIndex((current) => (current + 1) % heroSlides.length)
    }, 5000)

    return () => globalThis.clearInterval(timer)
  }, [heroSlides.length])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <main className="container">
      <section className="hero-carousel" aria-label="Latest news highlights">
        {heroSlides.length > 0 ? (
          <>
            {heroSlides.map((slide, index) => {
              const isActive = index === activeSlideIndex
              return (
                <article
                  key={slide.id}
                  className={`hero-slide${isActive ? ' is-active' : ''}`}
                  aria-hidden={!isActive}
                >
                  {slide.heroImage ? <img src={slide.heroImage} alt={slide.title} /> : null}
                  <div className="hero-slide-overlay">
                    <p className="hero-slide-eyebrow">Latest News</p>
                    <h2>{slide.title}</h2>
                    <p>{slide.excerpt ?? 'Catch up on the latest match analysis and updates.'}</p>
                    {slide.slug ? (
                      <Link to="/news/$slug" params={{ slug: slide.slug }} className="hero-readmore-btn">
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
                    className={`hero-carousel-dot${index === activeSlideIndex ? ' is-active' : ''}`}
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
              <p>Add and publish a news article with a featured image to populate this carousel.</p>
            </div>
          </article>
        )}
      </section>

      <section className="quick-stats" aria-label="League highlights">
        <article className="stat-card">
          <h2>Total Matches</h2>
          <p>32</p>
        </article>
        <article className="stat-card">
          <h2>Top Team</h2>
          <p>Eagles</p>
        </article>
        <article className="stat-card stat-card-danger">
          <h2>Upset Alert</h2>
          <p>Rhinos vs Lions</p>
        </article>
      </section>

      <div className="actions">
        <button type="button" className="btn btn-primary">
          View Full Table
        </button>
        <button type="button" className="btn btn-secondary">
          Download Fixtures
        </button>
      </div>

      {isLoading ? <p>Loading standings...</p> : null}
      {isError ? <p>Could not load standings.</p> : null}

      {!isLoading && !isError ? (
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  )
}

export default App
