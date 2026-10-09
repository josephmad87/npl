import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

const source = await readFile(new URL('../src/lib/cricket.ts', import.meta.url), 'utf8')
const { formatDismissalDisplay } = await import(
  `data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`
)

test('saved dismissals omit the bowling captain mark and retain keeper notation', () => {
  assert.equal(
    formatDismissalDisplay('c † Keeper b © Captain Bowler'),
    'c † Keeper b Captain Bowler',
  )
  assert.equal(formatDismissalDisplay('bowled'), 'bowled')
})
