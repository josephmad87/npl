export function ErrorNotice({ message = 'Could not load content.' }: { message?: string }) {
  return <p className="ui-error-notice">{message}</p>
}
