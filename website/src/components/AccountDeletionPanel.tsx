import { useState } from 'react'
import { supporterFetch } from '../lib/supporterApi'

export function AccountDeletionPanel({ onDeleted }: { onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function remove() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await supporterFetch('/supporters/me', { method: 'DELETE' })
      onDeleted()
    } catch {
      setError('Your account could not be deleted. Please check your connection and try again.')
      setBusy(false)
    }
  }
  return <section className="supporter-danger-zone" aria-labelledby="delete-account-heading">
    <h2 id="delete-account-heading">Delete account</h2>
    <p>This permanently removes your supporter profile, follows, notification devices, inbox and optional activity data. Limited transaction and consent records may be retained for legal, security and order-handling purposes as explained in the Privacy Policy.</p>
    {confirming ? <div>
      <p>Are you sure? This cannot be undone.</p>
      {error ? <p role="alert" className="form-error">{error}</p> : null}
      <button type="button" className="supporter-link-button" disabled={busy} onClick={() => void remove()}>{busy ? 'Deleting account…' : 'Permanently delete account'}</button>
      <button type="button" className="supporter-link-button" disabled={busy} onClick={() => { setConfirming(false); setError(null) }}>Keep my account</button>
    </div> : <button type="button" className="supporter-link-button" onClick={() => setConfirming(true)}>Delete account</button>}
  </section>
}
