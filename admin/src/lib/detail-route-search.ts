/** URL search for entity detail routes (`?mode=edit` or match `?mode=result`). */
export type DetailRouteSearch = {
  mode?: 'edit' | 'result'
}

export function parseDetailRouteSearch(
  raw: Record<string, unknown>,
): DetailRouteSearch {
  const m = raw.mode
  return {
    mode:
      m === 'edit'
        ? 'edit'
        : m === 'result'
          ? 'result'
          : undefined,
  }
}
