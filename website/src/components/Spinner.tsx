export function Spinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="ui-spinner-wrap" role="status" aria-live="polite">
      <span className="ui-spinner" />
      <p>{label}</p>
    </div>
  )
}
