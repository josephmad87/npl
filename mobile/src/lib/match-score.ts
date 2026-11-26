export function teamScore(summary: string | undefined, teamName: string) {
  const line = (summary || '').split(/\s*[·\n]\s*/).find(part => part.toLowerCase().startsWith(teamName.toLowerCase() + ' '))
  const value = line?.slice(teamName.length).trim()
  const match = value?.match(/^(\d+(?:\/\d+)?)(?:\s*\(([^)]+)\))?$/)
  return match ? { runs: match[1], overs: match[2] || '' } : { runs: '—', overs: '' }
}

export function chaseEquation(target: number, runs: number, legalBalls: number, allottedOvers: string | number | null | undefined) {
  const overs = Number(allottedOvers)
  const remainingBalls = Math.round(overs * 6) - legalBalls
  const needed = target - runs
  if (!Number.isInteger(needed) || needed <= 0 || !Number.isInteger(legalBalls) || legalBalls < 0 || !Number.isInteger(overs) || remainingBalls <= 0) return
  return `${needed} ${needed === 1 ? 'run' : 'runs'} needed from ${remainingBalls} ${remainingBalls === 1 ? 'ball' : 'balls'}`
}
