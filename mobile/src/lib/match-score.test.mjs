import assert from 'node:assert/strict'
import test from 'node:test'
import { teamScore } from './match-score.ts'
test('assigns scores to the named team rather than batting order', () => {
  const summary = 'Rangers 154/8 (20.0) · Gladiators 158/3 (18.2)'
  assert.deepEqual(teamScore(summary, 'Gladiators'), { runs: '158/3', overs: '18.2' })
  assert.deepEqual(teamScore(summary, 'Rangers'), { runs: '154/8', overs: '20.0' })
})
test('does not invent scores for missing or ambiguous summaries', () => {
  assert.deepEqual(teamScore(undefined, 'Rangers'), { runs: '—', overs: '' })
  assert.deepEqual(teamScore('Rangers B 100/2 (10.0)', 'Rangers'), { runs: '—', overs: '' })
  assert.deepEqual(teamScore('Rangers 0/0 (0.0)', 'Rangers'), { runs: '0/0', overs: '0.0' })
})
