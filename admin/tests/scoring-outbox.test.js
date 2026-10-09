import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

const source = await readFile(new URL('../src/lib/scoring-outbox.ts', import.meta.url), 'utf8')
const { replaceQueuedScoringBall } = await import(
  `data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`
)

function queued(id, over, bowler, runs = 0) {
  return {
    id,
    matchId: 337,
    queuedAt: '2026-10-09T11:00:00Z',
    attempts: 1,
    lastError: 'A bowler cannot bowl consecutive overs.',
    payload: {
      body: {
        client_event_id: id,
        innings: 2,
        over_number: over,
        ball_number: 1,
        batting_team_id: 9,
        bowling_team_id: 8,
        striker_player_id: 501,
        bowler_player_id: bowler,
        runs_batter: runs,
      },
    },
  }
}

test('correcting a queued over keeps its deliveries and retry IDs', () => {
  const before = [
    queued('previous', 4, 527),
    queued('first', 5, 527),
    queued('second', 5, 527, 4),
    queued('replacement', 5, 540),
    queued('next', 6, 521),
  ]
  const after = replaceQueuedScoringBall(
    before,
    'first',
    { ...before[1].payload.body, client_event_id: null, bowler_player_id: 521 },
  )

  assert.deepEqual(after.map((entry) => entry.id), before.map((entry) => entry.id))
  assert.deepEqual(after.map((entry) => entry.payload.body.bowler_player_id), [527, 521, 521, 540, 521])
  assert.equal(after[1].payload.body.client_event_id, 'first')
  assert.equal(after[2].payload.body.client_event_id, 'second')
  assert.equal(after[2].payload.body.runs_batter, 4)
  assert.equal(after[1].attempts, 0)
  assert.equal(after[2].lastError, null)
  assert.equal(after[0], before[0])
  assert.equal(after[3], before[3])
  assert.equal(after[4], before[4])
})

test('editing another detail changes only the selected queued delivery', () => {
  const before = [queued('first', 5, 521), queued('second', 5, 521)]
  const after = replaceQueuedScoringBall(before, 'first', {
    ...before[0].payload.body,
    runs_batter: 2,
  })

  assert.equal(after[0].payload.body.runs_batter, 2)
  assert.equal(after[1], before[1])
  assert.equal(replaceQueuedScoringBall(before, 'missing', before[0].payload.body), before)
})
