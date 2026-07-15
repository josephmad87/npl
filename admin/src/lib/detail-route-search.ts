/** URL search for entity detail routes. */
export type DetailRouteSearch = {
  mode?: 'edit' | 'result'
  from?: string
  statusTab?: 'active' | 'completed' | 'other'
  leagueId?: number | null
  seasonId?: number | null
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value)
  }

  return null
}

export function parseDetailRouteSearch(
  raw: Record<string, unknown>,
): DetailRouteSearch {
  const m = raw.mode
  const statusTab = raw.statusTab

  return {
    mode: m === 'edit' ? 'edit' : m === 'result' ? 'result' : undefined,
    from: typeof raw.from === 'string' ? raw.from : undefined,
    statusTab:
      statusTab === 'completed'
        ? 'completed'
        : statusTab === 'other'
          ? 'other'
          : statusTab === 'active'
            ? 'active'
            : undefined,
    leagueId: readNumber(raw.leagueId),
    seasonId: readNumber(raw.seasonId),
  }
}
