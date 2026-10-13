import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { Schema } from '@tiptap/pm/model'
import { EditorState, NodeSelection, TextSelection } from '@tiptap/pm/state'
import { createServer } from 'vite'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'text*', group: 'block' },
    text: { group: 'inline' },
    table: { content: 'tableRow+', group: 'block' },
    tableRow: { content: 'tableCell+' },
    tableCell: { content: 'paragraph+' },
  },
})

function storyDoc(withFollowingParagraph) {
  const { doc, paragraph, table, tableRow, tableCell } = schema.nodes
  const cell = tableCell.create(null, paragraph.create(null, schema.text('Team')))
  const tableNode = table.create(null, tableRow.create(null, cell))
  const blocks = [tableNode]
  if (withFollowingParagraph) {
    blocks.push(paragraph.create(null, schema.text('Rest of the story')))
  }
  return doc.create(null, blocks)
}

function stateInsideTable(doc) {
  let cellParagraphPos = null
  doc.descendants((node, pos) => {
    if (cellParagraphPos === null && node.type.name === 'paragraph') {
      cellParagraphPos = pos + 1
    }
  })
  return EditorState.create({ doc, selection: TextSelection.create(doc, cellParagraphPos) })
}

test('continue below a saved table focuses existing story text without duplicating it', async () => {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    cacheDir: '/private/tmp/story-table-exit-vite-cache',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  try {
    const { createTableExitTransaction } = await server.ssrLoadModule('/src/components/storyTableExit.ts')

    const saved = storyDoc(true)
    const savedTransaction = createTableExitTransaction(stateInsideTable(saved))
    assert.ok(savedTransaction)
    assert.equal(savedTransaction.doc.childCount, 2)
    assert.equal(savedTransaction.doc.lastChild.textContent, 'Rest of the story')
    assert.equal(savedTransaction.selection.$from.parent.type.name, 'paragraph')
    assert.equal(savedTransaction.selection.from, saved.firstChild.nodeSize + 1)

    const tableOnly = storyDoc(false)
    const newTransaction = createTableExitTransaction(stateInsideTable(tableOnly))
    assert.ok(newTransaction)
    assert.equal(newTransaction.doc.childCount, 2)
    assert.equal(newTransaction.doc.lastChild.type.name, 'paragraph')
    assert.equal(newTransaction.doc.lastChild.textContent, '')
    assert.equal(newTransaction.selection.$from.parent.type.name, 'paragraph')

    const outside = EditorState.create({
      doc: saved,
      selection: TextSelection.create(saved, saved.firstChild.nodeSize + 1),
    })
    assert.equal(createTableExitTransaction(outside), null)

    const tableSelected = EditorState.create({
      doc: saved,
      selection: NodeSelection.create(saved, 0),
    })
    assert.equal(createTableExitTransaction(tableSelected).selection.from, saved.firstChild.nodeSize + 1)
  } finally {
    await server.close()
  }
})
