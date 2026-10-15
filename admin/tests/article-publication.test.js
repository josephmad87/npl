import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

const source = await readFile(new URL('../src/lib/article-publication.ts', import.meta.url), 'utf8')
const { formatArticlePublicationTime, getArticleDisplayStatus } = await import(
  `data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`
)

test('a future published story reads as scheduled until its go-live instant', () => {
  const story = { status: 'published', published_at: '2026-10-13T09:45:00Z' }
  assert.equal(getArticleDisplayStatus(story, Date.parse('2026-10-13T09:44:59Z')), 'scheduled')
  assert.equal(getArticleDisplayStatus(story, Date.parse('2026-10-13T09:45:00Z')), 'published')
  assert.equal(getArticleDisplayStatus(story, Date.parse('2026-10-13T09:45:01Z')), 'published')
  assert.equal(getArticleDisplayStatus({ ...story, status: 'draft' }, 0), 'draft')
  assert.equal(getArticleDisplayStatus({ ...story, status: 'scheduled' }, Date.parse('2026-10-13T09:44:59Z')), 'scheduled')
  assert.equal(getArticleDisplayStatus({ ...story, status: 'scheduled' }, Date.parse('2026-10-13T09:45:00Z')), 'published')
})

test('the visible publication time uses the Zimbabwe clock', () => {
  assert.match(formatArticlePublicationTime('2026-10-13T09:45:00Z'), /11:45 CAT$/)
})
