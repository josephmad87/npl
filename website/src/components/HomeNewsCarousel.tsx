import type { RefObject } from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { formatMatchDate, formatNewsHighlightsDate } from '../lib/formatters'
import type { ArticleLite } from '../lib/hooks'
import { resolveMediaUrl } from '../lib/publicApi'

type FilterOption = { id: string; label: string }

function sortByPublishedDesc(a: ArticleLite, b: ArticleLite): number {
  const ta = a.published_at ? new Date(a.published_at).valueOf() : 0
  const tb = b.published_at ? new Date(b.published_at).valueOf() : 0
  return tb - ta
}

function buildFilterOptions(articles: ArticleLite[]): FilterOption[] {
  const base: FilterOption[] = [{ id: 'all', label: 'Most recent' }]
  const maxOptions = 8

  const tagMap = new Map<string, string>()
  for (const article of articles) {
    for (const raw of article.tags ?? []) {
      const t = raw.trim()
      if (!t) continue
      const key = t.toLowerCase()
      if (!tagMap.has(key)) tagMap.set(key, t)
    }
  }

  const catMap = new Map<string, string>()
  for (const article of articles) {
    const c = article.category?.trim()
    if (!c) continue
    const key = c.toLowerCase()
    if (!catMap.has(key)) catMap.set(key, c)
  }

  const out: FilterOption[] = [...base]
  const tagSorted = [...tagMap.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  for (const [key, label] of tagSorted) {
    out.push({ id: `tag:${key}`, label })
    if (out.length >= maxOptions) return out
  }
  const catSorted = [...catMap.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  for (const [key, label] of catSorted) {
    if (tagMap.has(key)) continue
    out.push({ id: `cat:${key}`, label })
    if (out.length >= maxOptions) return out
  }
  return out
}

function articleMatchesFilter(article: ArticleLite, filterId: string): boolean {
  if (filterId === 'all') return true
  if (filterId.startsWith('tag:')) {
    const key = filterId.slice(4)
    return (article.tags ?? []).some((t) => t.trim().toLowerCase() === key)
  }
  if (filterId.startsWith('cat:')) {
    const key = filterId.slice(4)
    return (article.category ?? '').trim().toLowerCase() === key
  }
  return true
}

function HomeNewsCarouselTrack({
  articles,
  scrollRef,
}: {
  articles: ArticleLite[]
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  const [activePanelIndex, setActivePanelIndex] = useState(0)

  return (
    <div ref={scrollRef} className="home-news-carousel__track">
      {articles.map((article, idx) => {
        const img = resolveMediaUrl(article.featured_image_url)
        const metaBits = [article.category ?? 'News', formatMatchDate(article.published_at)].filter(Boolean)
        const excerpt = article.excerpt?.trim() ?? ''
        const clip = excerpt.length > 120 ? `${excerpt.slice(0, 117)}…` : excerpt

        return (
          <article
            key={article.id}
            className={`home-news-carousel__card${idx === activePanelIndex ? ' is-active' : ''}`}
            onMouseEnter={() => setActivePanelIndex(idx)}
          >
            <Link
              to="/news/$slug"
              params={{ slug: article.slug }}
              className="home-news-carousel__card-link"
              onFocus={() => setActivePanelIndex(idx)}
            >
              <div
                className="home-news-carousel__card-bg"
                style={
                  img
                    ? {
                        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.82) 100%), url(${img})`,
                      }
                    : undefined
                }
              >
                <div className="home-news-carousel__card-body">
                  <h3 className="home-news-carousel__card-title">{article.title}</h3>
                  <p className="home-news-carousel__card-meta">{metaBits.join(' · ')}</p>
                  {clip ? <p className="home-news-carousel__card-excerpt">{clip}</p> : null}
                  <span className="home-news-carousel__readmore">Read more</span>
                </div>
              </div>
            </Link>
          </article>
        )
      })}
    </div>
  )
}

export function HomeNewsCarousel({ articles }: { articles: ArticleLite[] }) {
  const [activeFilter, setActiveFilter] = useState('all')
  const scrollerRef = useRef<HTMLDivElement>(null)

  const filterOptions = useMemo(() => buildFilterOptions(articles), [articles])

  const effectiveFilter = useMemo(
    () => (filterOptions.some((o) => o.id === activeFilter) ? activeFilter : 'all'),
    [filterOptions, activeFilter],
  )

  const filteredArticles = useMemo(() => {
    const list = articles.filter((a) => articleMatchesFilter(a, effectiveFilter))
    return [...list].sort(sortByPublishedDesc)
  }, [articles, effectiveFilter])

  const scrollBy = useCallback((direction: -1 | 1) => {
    const el = scrollerRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('.home-news-carousel__card')
    const gap = 12
    const step = card ? card.getBoundingClientRect().width + gap : Math.min(el.clientWidth * 0.75, 360)
    el.scrollBy({ left: direction * step, behavior: 'smooth' })
  }, [])

  const subtitle = `${formatNewsHighlightsDate()} News Highlights`

  return (
    <section className="home-news-carousel-section" aria-labelledby="home-news-heading">
      <header className="home-news-carousel__header">
        <div className="home-news-carousel__title-row">
          <h2 id="home-news-heading" className="home-news-carousel__title">
            News
          </h2>
          <span className="home-news-carousel__title-rule" aria-hidden="true" />
        </div>
        <p className="home-news-carousel__subtitle">{subtitle}</p>
      </header>

      <div className="home-news-carousel__toolbar">
        <div className="home-news-carousel__chips" role="tablist" aria-label="Filter news">
          {filterOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={effectiveFilter === opt.id}
              className={`home-news-carousel__chip${effectiveFilter === opt.id ? ' is-active' : ''}`}
              onClick={() => setActiveFilter(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="home-news-carousel__nav">
          <button
            type="button"
            className="home-news-carousel__nav-btn"
            aria-label="Scroll news left"
            onClick={() => scrollBy(-1)}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            className="home-news-carousel__nav-btn"
            aria-label="Scroll news right"
            onClick={() => scrollBy(1)}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>

      {filteredArticles.length === 0 ? (
        <p className="home-news-carousel__empty">No articles match this filter.</p>
      ) : (
        <HomeNewsCarouselTrack key={effectiveFilter} articles={filteredArticles} scrollRef={scrollerRef} />
      )}

      <p className="home-news-carousel__footer-link">
        <Link to="/news" search={{ q: '' }} className="home-news-carousel__all-link">
          View all news
        </Link>
      </p>
    </section>
  )
}
