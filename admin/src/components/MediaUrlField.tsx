import { FileVideo, ImagePlus, Link2, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import {
  adminUploadMedia,
  type MediaUploadKind,
} from '@/lib/admin-client'
import { API_BASE } from '@/lib/api'

export type MediaUrlFieldProps = Readonly<{
  id: string
  uploadKind: MediaUploadKind
  accept: string
  value: string | null | undefined
  onChange: (next: string | null) => void
  disabled?: boolean
}>

function acceptsVideo(accept: string): boolean {
  return accept.includes('video')
}

function acceptsOnlyImages(accept: string): boolean {
  return accept.includes('image') && !accept.includes('video')
}

function resolveDisplayUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  if (t.startsWith('//')) return `${globalThis.location.protocol}${t}`
  if (t.startsWith('/')) {
    try {
      return `${new URL(API_BASE).origin}${t}`
    } catch {
      return t
    }
  }
  return t
}

function acceptHint(accept: string): string {
  if (accept.includes('video')) {
    return 'Images or video — common JPG/PNG/WebP/AVIF/SVG and MP4/WebM/MOV/M4V/AVI/MKV formats'
  }
  return 'Common image formats (JPG, PNG, WebP, GIF, AVIF, SVG, TIFF, BMP, HEIC)'
}

function looksLikeImageUrl(text: string, imageOnly: boolean): boolean {
  if (!text.trim()) return false
  if (imageOnly) return true
  return /\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?|heic|heif)(\?|#|$)/i.test(
    text,
  )
}

/**
 * File upload to POST /admin/uploads plus a text field for paste / manual URLs.
 */
export function MediaUrlField({
  id,
  uploadKind,
  accept,
  value,
  onChange,
  disabled = false,
}: MediaUrlFieldProps) {
  const fileInputId = `${id}__file`
  const [busy, setBusy] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [localErr, setLocalErr] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [previewBroken, setPreviewBroken] = useState(false)

  const text = value?.trim() ?? ''
  const imageOnly = acceptsOnlyImages(accept)
  const videoOk = acceptsVideo(accept)
  const showImagePreview =
    text.length > 0 && looksLikeImageUrl(text, imageOnly) && !previewBroken

  const handleFile = useCallback(
    async (file: File) => {
      setLocalErr(null)
      setBusy(true)
      setUploadPercent(0)
      setPreviewBroken(false)
      try {
        const { url } = await adminUploadMedia(file, uploadKind, setUploadPercent)
        setUploadPercent(100)
        onChange(url)
      } catch (err: unknown) {
        setLocalErr(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setBusy(false)
        setUploadPercent(0)
      }
    },
    [onChange, uploadKind],
  )

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    void handleFile(f)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled || busy) return
    const f = e.dataTransfer.files?.[0]
    if (f) void handleFile(f)
  }

  const onDragOver = (e: React.DragEvent) => {
    if (disabled || busy) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const onDragEnter = (e: React.DragEvent) => {
    if (disabled || busy) return
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }

  const locked = disabled || busy
  const hint = acceptHint(accept)

  return (
    <div
      className={`media-url-field${locked ? ' media-url-field--locked' : ''}${isDragging ? ' media-url-field--drag' : ''}`}
    >
      <div className="media-url-field__top">
        <input
          id={fileInputId}
          type="file"
          accept={accept}
          aria-label="Upload file from device"
          disabled={locked}
          onChange={onPick}
          className="visually-hidden"
          tabIndex={-1}
        />
        <label
          htmlFor={fileInputId}
          tabIndex={locked ? -1 : 0}
          className="media-url-field__drop"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
        >
          {busy ? (
            <span className="media-url-field__drop-busy" aria-live="polite">
              <span className="media-url-field__drop-progress-label">
                Uploading… {uploadPercent}%
              </span>
              <span className="media-url-field__drop-progress-track" aria-hidden>
                <span
                  className="media-url-field__drop-progress-fill"
                  style={{ width: `${uploadPercent}%` }}
                />
              </span>
            </span>
          ) : (
            <>
              <span className="media-url-field__drop-icon" aria-hidden>
                {videoOk && !imageOnly ? (
                  <FileVideo size={30} strokeWidth={1.75} />
                ) : (
                  <ImagePlus size={30} strokeWidth={1.75} />
                )}
              </span>
              <span className="media-url-field__drop-title">
                Drop a file here or <em>browse</em>
              </span>
              <span className="media-url-field__drop-hint">{hint}</span>
            </>
          )}
        </label>

        {text ? (
          <button
            type="button"
            className="media-url-field__clear"
            disabled={locked}
            aria-label="Remove media URL"
            onClick={() => {
              setPreviewBroken(false)
              onChange(null)
              globalThis.requestAnimationFrame(() => {
                globalThis.document.getElementById(id)?.focus()
              })
            }}
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>

      {showImagePreview ? (
        <div className="media-url-field__preview">
          <img
            src={resolveDisplayUrl(text)}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => setPreviewBroken(false)}
            onError={() => setPreviewBroken(true)}
          />
        </div>
      ) : null}

      {text && videoOk && !imageOnly && !showImagePreview ? (
        <div className="media-url-field__video-note">
          <FileVideo size={16} strokeWidth={2} aria-hidden />
          <span>Media URL set — open link to preview</span>
        </div>
      ) : null}

      {localErr ? <p className="media-url-field__error">{localErr}</p> : null}

      <div className="media-url-field__url">
        <label className="media-url-field__url-label" htmlFor={id}>
          <Link2 size={14} strokeWidth={2} aria-hidden />
          Or paste a URL
        </label>
        <input
          id={id}
          className="inline-edit__control media-url-field__url-input"
          value={text}
          disabled={disabled}
          placeholder="https://… or upload above"
          onChange={(e) => {
            const t = e.target.value.trim()
            setPreviewBroken(false)
            onChange(t.length > 0 ? t : null)
          }}
        />
      </div>
    </div>
  )
}
