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
    heading: { content: 'text*', group: 'block' },
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

test('moving above and below a saved table preserves story text and places the cursor', async () => {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    cacheDir: '/private/tmp/story-table-exit-vite-cache',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  try {
    const { createTableExitTransaction, createTableBeforeTransaction } = await server.ssrLoadModule('/src/components/storyTableExit.ts')

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

    const tableFirstTransaction = createTableBeforeTransaction(stateInsideTable(tableOnly))
    assert.ok(tableFirstTransaction)
    assert.equal(tableFirstTransaction.doc.childCount, 2)
    assert.equal(tableFirstTransaction.doc.firstChild.type.name, 'paragraph')
    assert.equal(tableFirstTransaction.selection.from, 1)

    const lead = schema.nodes.paragraph.create(null, schema.text('Earlier story text'))
    const withLead = schema.nodes.doc.create(null, [lead, saved.firstChild, saved.lastChild])
    const leadTransaction = createTableBeforeTransaction(EditorState.create({
      doc: withLead,
      selection: TextSelection.create(withLead, lead.nodeSize + 4),
    }))
    assert.ok(leadTransaction)
    assert.equal(leadTransaction.doc.childCount, 3)
    assert.equal(leadTransaction.doc.firstChild.textContent, 'Earlier story text')
    assert.equal(leadTransaction.doc.lastChild.textContent, 'Rest of the story')
    assert.equal(leadTransaction.selection.from, lead.nodeSize - 1)

    const heading = schema.nodes.heading.create(null, schema.text('Standings'))
    const afterHeading = schema.nodes.doc.create(null, [heading, saved.firstChild, saved.lastChild])
    const headingTransaction = createTableBeforeTransaction(EditorState.create({
      doc: afterHeading,
      selection: TextSelection.create(afterHeading, heading.nodeSize + 4),
    }))
    assert.ok(headingTransaction)
    assert.equal(headingTransaction.doc.childCount, 4)
    assert.equal(headingTransaction.doc.child(1).type.name, 'paragraph')
    assert.equal(headingTransaction.doc.child(1).textContent, '')
    assert.equal(headingTransaction.doc.lastChild.textContent, 'Rest of the story')
    assert.equal(headingTransaction.selection.from, heading.nodeSize + 1)

    assert.equal(createTableBeforeTransaction(outside), null)
    assert.equal(createTableBeforeTransaction(tableSelected).selection.from, 1)
  } finally {
    await server.close()
  }
})
