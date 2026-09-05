import assert from 'node:assert/strict'
import test from 'node:test'

import { formatTossSummary, parseTossSummary } from './toss-summary.js'

test('shortens historical bat-first toss copy', () => {
  assert.equal(
    formatTossSummary(
      'Triangle Cricket Club won the toss and chose to bat first. Triangle Cricket Club batting first.',
    ),
    'Triangle Cricket Club opt to bat',
  )
})

test('shortens historical bowl-first toss copy', () => {
  assert.equal(
    formatTossSummary(
      'Takashinga Patriots 1 won the toss and chose to bowl first. Amakhosi 2 Cricket Club batting first.',
    ),
    'Takashinga Patriots 1 opt to bowl',
  )
})

test('normalises alternative field wording and parses the decision', () => {
  assert.deepEqual(
    parseTossSummary('Old Hararians elected to field first.'),
    null,
  )
  assert.deepEqual(
    parseTossSummary('Old Hararians won the toss and elected to field first.'),
    { teamName: 'Old Hararians', decision: 'bowl' },
  )
})

test('preserves unrecognised editorial toss text', () => {
  assert.equal(formatTossSummary('Toss delayed by rain'), 'Toss delayed by rain')
})
