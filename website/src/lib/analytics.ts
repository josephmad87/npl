import { init } from '@plausible-analytics/tracker'

function doNotTrackEnabled() {
  return navigator.doNotTrack === '1'
}

/** Start cookie-free analytics only when a Plausible site domain is configured. */
export function initAnalytics() {
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN?.trim()
  if (!domain || doNotTrackEnabled()) return

  const endpoint = import.meta.env.VITE_PLAUSIBLE_ENDPOINT?.trim()
  init({
    domain,
    ...(endpoint ? { endpoint } : {}),
    autoCapturePageviews: true,
    outboundLinks: true,
    fileDownloads: true,
    logging: import.meta.env.DEV,
  })
}
