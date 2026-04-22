import { useEffect, type ReactNode } from 'react'

type MediaLightboxProps = {
  open: boolean
  onClose: () => void
  /** Shown under the media (e.g. gallery title). */
  title?: string | null
  /** Accessible name when `title` is empty. */
  ariaLabel?: string
  children: ReactNode
}

/**
 * Full-viewport media viewer: near-opaque backdrop, full-width stage, × close (top-right).
 * Use for any image or video opened modally (gallery, hero, etc.).
 */
export function MediaLightbox({ open, onClose, title, ariaLabel, children }: MediaLightboxProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  const label = title?.trim() || ariaLabel?.trim() || 'Media'

  return (
    <div
      className="media-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div className="media-lightbox__inner" onClick={(e) => e.stopPropagation()}>
        <div className="media-lightbox__frame">
          <button
            type="button"
            className="media-lightbox__close"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            aria-label="Close"
          >
            <span aria-hidden="true" className="media-lightbox__close-icon">
              ×
            </span>
          </button>
          <div className="media-lightbox__stage">{children}</div>
        </div>
        {title?.trim() ? <p className="media-lightbox__title">{title.trim()}</p> : null}
      </div>
    </div>
  )
}
