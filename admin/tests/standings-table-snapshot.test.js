import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { createServer } from 'vite'

test('standings snapshot keeps original ranks and escapes selected team names', async () => {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    cacheDir: '/private/tmp/story-standings-vite-cache',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    appType: 'custom',
  })
  try {
    const { buildStandingsSnapshotHtml } = await server.ssrLoadModule(
      '/src/components/standingsTableSnapshot.ts',
    )
    const makeRow = (teamId, rank) => ({
      teamId,
      rank,
      played: 3,
      won: 2,
      lost: 1,
      tied: 0,
      nr: 0,
      battingBonusPoints: 0,
      chaseBonusPoints: 0,
      points: 4,
      runsFor: 100,
      ballsFaced: 60,
      runsAgainst: 90,
      ballsBowled: 60,
      nrr: 1,
    })
    const html = buildStandingsSnapshotHtml(
      [makeRow(9, 3)],
      ['position', 'team', 'points'],
      new Map([
        [5, 'First team'],
        [9, 'A & <B> "Club"'],
      ]),
      'striped',
    )

    assert.match(html, /class="story-table story-table--striped"/)
    assert.match(html, /<td><p>3<\/p><\/td><td><p>A &amp; &lt;B&gt; &quot;Club&quot;<\/p><\/td><td><p>4<\/p><\/td>/)
    assert.doesNotMatch(html, /First team/)
    assert.doesNotMatch(html, /<th scope="col"><p>NRR<\/p><\/th>/)
    assert.equal((html.match(/<tr>/g) ?? []).length, 2)
  } finally {
    await server.close()
  }
})
