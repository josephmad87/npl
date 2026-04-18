import { useState } from 'react'
import {
  adminUploadMedia,
  type MediaUploadKind,
} from '@/lib/admin-client'

export type MediaUrlFieldProps = Readonly<{
  id: string
  uploadKind: MediaUploadKind
  accept: string
  value: string | null | undefined
  onChange: (next: string | null) => void
  disabled?: boolean
}>

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
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)
  const text = value?.trim() ?? ''

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setLocalErr(null)
    setBusy(true)
    try {
      const { url } = await adminUploadMedia(f, uploadKind)
      onChange(url)
    } catch (err: unknown) {
      setLocalErr(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="media-url-field" style={{ display: 'grid', gap: '0.4rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          alignItems: 'center',
        }}
      >
        <input
          id={`${id}__file`}
          type="file"
          accept={accept}
          aria-label="Upload file"
          disabled={disabled || busy}
          onChange={(e) => void onPick(e)}
          className="inline-edit__control"
          style={{ maxWidth: '100%' }}
        />
        {busy ? <span className="muted">Uploading…</span> : null}
      </div>
      {localErr ? <p className="login-error">{localErr}</p> : null}
      <input
        id={id}
        className="inline-edit__control"
        value={text}
        disabled={disabled}
        placeholder="https://… or upload a file above"
        onChange={(e) => {
          const t = e.target.value.trim()
          onChange(t.length > 0 ? t : null)
        }}
      />
    </div>
  )
}
