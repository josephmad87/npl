import { useCallback, useRef, type ReactNode } from 'react'
import { SectionHeader } from './SectionHeader'
import { MatchCard } from './MatchCard'
import type { MatchLite, TeamLite } from '../lib/hooks'

export function MatchCarousel({
  title,
  linkTo,
  matches,
  teamsMap,
  mode,
  showHeader = true,
  layout = 'default',
  filterSlot,
}: {
  title?: string
  linkTo?: string
  matches: MatchLite[]
  teamsMap: Record<number, TeamLite>
  mode: 'fixture' | 'result'
  showHeader?: boolean
  layout?: 'default' | 'fixtures-page'
  filterSlot?: ReactNode
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  const scrollBy = useCallback((direction: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    const cell = el.querySelector<HTMLElement>('.match-carousel__cell')
    const gap = 16
    const step = cell ? cell.offsetWidth + gap : Math.min(el.clientWidth * 0.88, 320)
    el.scrollBy({ left: direction * step, behavior: 'smooth' })
  }, [])

  if (matches.length === 0) return null

  const trackClass =
    layout === 'fixtures-page'
      ? 'match-carousel__track match-carousel__track--fixtures-page'
      : 'match-carousel__track'

  return (
    <>
      <div className="match-carousel__toolbar">
        {showHeader && title && linkTo ? (
          <div className="match-carousel__header-wrap">
            <SectionHeader title={title} linkTo={linkTo} />
          </div>
        ) : null}
        {filterSlot ? (
          <div className="match-carousel__filter-slot">{filterSlot}</div>
        ) : null}
        <div
          className="match-carousel__nav"
          aria-label={mode === 'result' ? 'Scroll results' : 'Scroll fixtures'}
        >
          <button
            type="button"
            className="match-carousel__nav-btn"
            aria-label="Scroll left"
            onClick={() => scrollBy(-1)}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            className="match-carousel__nav-btn"
            aria-label="Scroll right"
            onClick={() => scrollBy(1)}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>

      <div ref={trackRef} className={trackClass}>
        {matches.map((match) => (
          <div key={match.id} className="match-carousel__cell">
            <MatchCard
              match={match}
              teamsMap={teamsMap}
              mode={mode}
              compact={layout === 'fixtures-page' && mode === 'fixture'}
            />
          </div>
        ))}
      </div>
    </>
  )
}
