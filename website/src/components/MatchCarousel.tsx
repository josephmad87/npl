import { useCallback, useRef } from 'react'
import { SectionHeader } from './SectionHeader'
import { MatchCard } from './MatchCard'
import type { MatchLite, TeamLite } from '../lib/hooks'

export function MatchCarousel({
  title,
  linkTo,
  matches,
  teamsMap,
  mode,
}: {
  title: string
  linkTo: string
  matches: MatchLite[]
  teamsMap: Record<number, TeamLite>
  mode: 'fixture' | 'result'
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

  return (
    <>
      <div className="match-carousel__toolbar">
        <div className="match-carousel__header-wrap">
          <SectionHeader title={title} linkTo={linkTo} />
        </div>
        <div className="match-carousel__nav" aria-label={mode === 'result' ? 'Scroll results' : 'Scroll fixtures'}>
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

      <div ref={trackRef} className="match-carousel__track">
        {matches.map((match) => (
          <div key={match.id} className="match-carousel__cell">
            <MatchCard match={match} teamsMap={teamsMap} mode={mode} />
          </div>
        ))}
      </div>
    </>
  )
}
