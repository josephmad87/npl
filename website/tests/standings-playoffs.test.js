import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

test('qualifiers, eliminator and final never change the league table', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { computeSeasonStandings, isRegularSeasonMatch } = await server.ssrLoadModule('/src/lib/leagueSeasonAggregates.ts')
    const season = { name: 'Test League', league: { name: 'Test League' } }
    const regular = {
      id: 1,
      fixture_stage: null,
      status: 'completed',
      home_team_id: 10,
      away_team_id: 20,
      season,
      result: { outcome: 'win', winning_team_id: 10, nrr_excluded: false },
      player_stats: [
        { team_id: 10, batting_order: 1, runs: 100, balls_faced: 60 },
        { team_id: 20, batting_order: 1, runs: 80, balls_faced: 60 },
      ],
    }

    const baseline = computeSeasonStandings([regular], [10, 20])
    assert.equal(baseline[0].played, 1)
    assert.equal(baseline[0].won, 1)
    assert.equal(baseline[0].points, 2)
    assert.equal(baseline[0].nrr, 2)

    const playoffStages = ['qualifier_1', 'eliminator', 'qualifier_2', 'final']
    const playoffs = playoffStages.map((stage, index) => ({
      ...regular,
      id: index + 2,
      fixture_stage: stage,
      result: { outcome: 'win', winning_team_id: 20, nrr_excluded: false },
      player_stats: [
        { team_id: 10, batting_order: 1, runs: 50, balls_faced: 60 },
        { team_id: 20, batting_order: 1, runs: 150, balls_faced: 60 },
      ],
    }))

    assert.deepEqual(
      [regular, ...playoffs].filter(isRegularSeasonMatch).map((match) => match.id),
      [regular.id],
      'the standings form must use only regular-season results',
    )

    for (const playoff of playoffs) {
      assert.deepEqual(
        computeSeasonStandings([regular, playoff], [10, 20]),
        baseline,
        `${playoff.fixture_stage} changed the league table`,
      )
    }

    assert.deepEqual(computeSeasonStandings([regular, ...playoffs], [10, 20]), baseline)

    const noResultPlayoff = {
      ...playoffs[0],
      id: 99,
      status: 'abandoned',
      result: { outcome: 'no_result', winning_team_id: null },
    }
    assert.deepEqual(computeSeasonStandings([regular, noResultPlayoff], [10, 20]), baseline)
  } finally {
    await server.close()
  }
})
