import type { ReactNode } from 'react'

type SectionHintTipProps = Readonly<{
  /** Plain text for screen readers (no markup). */
  ariaHelp: string
  children: ReactNode
}>

export function SectionHintTip({ ariaHelp, children }: SectionHintTipProps) {
  return (
    <span className="section-hint-tip">
      <button
        type="button"
        className="section-hint-tip__trigger"
        aria-label={ariaHelp}
      >
        <svg
          className="section-hint-tip__icon"
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden
        >
          <circle
            cx="8"
            cy="8"
            r="6.25"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.15"
          />
          <path
            d="M8 11.35h.01M8 4.65v4.35"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <span className="section-hint-tip__bubble" role="tooltip">
        {children}
      </span>
    </span>
  )
}
