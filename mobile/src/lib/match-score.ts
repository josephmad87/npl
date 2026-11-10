export function teamScore(summary: string | undefined, teamName: string) {
  const line = (summary || '').split(/\s*[·\n]\s*/).find(part => part.toLowerCase().startsWith(teamName.toLowerCase() + ' '))
  const value = line?.slice(teamName.length).trim()
  const match = value?.match(/^(\d+(?:\/\d+)?)(?:\s*\(([^)]+)\))?$/)
  return match ? { runs: match[1], overs: match[2] || '' } : { runs: '—', overs: '' }
}
