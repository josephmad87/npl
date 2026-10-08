import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

test('no-result innings never enter NRR, while completed wins and ties do', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { computeSeasonStandings } = await server.ssrLoadModule('/src/lib/leagueSeasonAggregates.ts')
    const season = { name: "Men's T20 Blast 2026", league: { name: 'NPL T20 Blast' } }
    const abandoned = {
      id: 335,
      status: 'completed',
      home_team_id: 14,
      away_team_id: 5,
      season,
      result: { outcome: 'no_result', winning_team_id: null, nrr_excluded: false },
      player_stats: [
        { team_id: 14, batting_order: 1, runs: 13, balls_faced: 6 },
        { team_id: 5, batting_order: 1, runs: 0, balls_faced: 0 },
      ],
    }
    const noResultRows = computeSeasonStandings([abandoned], [14, 5])
    assert.deepEqual(noResultRows.map(({ played, nr, points, runsFor, ballsFaced, runsAgainst, ballsBowled, nrr }) => ({
      played, nr, points, runsFor, ballsFaced, runsAgainst, ballsBowled, nrr,
    })), [
      { played: 1, nr: 1, points: 1, runsFor: 0, ballsFaced: 0, runsAgainst: 0, ballsBowled: 0, nrr: 0 },
      { played: 1, nr: 1, points: 1, runsFor: 0, ballsFaced: 0, runsAgainst: 0, ballsBowled: 0, nrr: 0 },
    ])

    const win = {
      id: 336,
      status: 'completed',
      home_team_id: 14,
      away_team_id: 5,
      season,
      result: { outcome: 'win', winning_team_id: 14, nrr_excluded: false },
      player_stats: [
        { team_id: 14, batting_order: 1, runs: 100, balls_faced: 60 },
        { team_id: 5, batting_order: 1, runs: 80, balls_faced: 60 },
      ],
    }
    const withWin = computeSeasonStandings([abandoned, win], [14, 5])
    assert.equal(withWin[0].runsFor, 100)
    assert.equal(withWin[0].ballsFaced, 60)
    assert.equal(withWin[0].runsAgainst, 80)
    assert.equal(withWin[0].ballsBowled, 60)
    assert.equal(withWin[0].nrr, 2)

    const tie = {
      ...win,
      id: 337,
      result: { outcome: 'tie', winning_team_id: null, nrr_excluded: false },
      player_stats: [
        { team_id: 14, batting_order: 1, runs: 50, balls_faced: 60 },
        { team_id: 5, batting_order: 1, runs: 50, balls_faced: 60 },
      ],
    }
    const withTie = computeSeasonStandings([abandoned, win, tie], [14, 5])
    assert.equal(withTie[0].runsFor, 150)
    assert.equal(withTie[0].ballsFaced, 120)
    assert.equal(withTie[0].tied, 1)
  } finally {
    await server.close()
  }
})
