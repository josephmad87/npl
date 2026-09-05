const LEGACY_TOSS_PATTERN =
  /^(.+?)\s+won\s+the\s+toss(?:\s+and)?\s+(?:chose|elected|decided|opted)\s+to\s+(bat|bowl|field)(?:\s+first)?(?:[.;].*)?$/i
const CONCISE_TOSS_PATTERN =
  /^(.+?)\s+opt(?:s|ed)?\s+to\s+(bat|bowl|field)(?:\s+first)?[.]?$/i

function conciseDecision(value) {
  return value.toLowerCase() === 'field' ? 'bowl' : value.toLowerCase()
}

/**
 * Convert legacy, repetitive toss copy into the concise NPL display format.
 * Unrecognised editorial text is preserved rather than guessed.
 */
export function formatTossSummary(value) {
  const clean = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (!clean) return ''

  const match = clean.match(LEGACY_TOSS_PATTERN) ?? clean.match(CONCISE_TOSS_PATTERN)
  if (!match) return clean

  return `${match[1].trim()} opt to ${conciseDecision(match[2])}`
}

/** Extract the toss winner and decision from either legacy or concise copy. */
export function parseTossSummary(value) {
  const summary = formatTossSummary(value)
  const match = summary.match(/^(.+?)\s+opt\s+to\s+(bat|bowl)$/i)
  if (!match) return null

  return {
    teamName: match[1].trim(),
    decision: match[2].toLowerCase(),
  }
}
