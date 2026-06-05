import type { QueryClient } from '@tanstack/react-query'

/** Refresh match and player caches after scorecards, results, or completed-status changes. */
export async function invalidateCompetitionDataQueries(
  queryClient: QueryClient,
  playerIds?: number[],
) {
  await queryClient.invalidateQueries({ queryKey: ['admin', 'matches'] })
  await queryClient.invalidateQueries({ queryKey: ['admin', 'players'] })
  if (playerIds != null) {
    for (const pid of playerIds) {
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'players', pid, 'match-appearances'],
      })
    }
  } else {
    await queryClient.invalidateQueries({
      queryKey: ['admin', 'players'],
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        q.queryKey[0] === 'admin' &&
        q.queryKey[1] === 'players' &&
        q.queryKey[3] === 'match-appearances',
    })
  }
}
