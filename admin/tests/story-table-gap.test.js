import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { Schema } from '@tiptap/pm/model'
import { EditorState } from '@tiptap/pm/state'
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

function storyDoc({ heading = true, after = true } = {}) {
  const { doc, paragraph, table, tableRow, tableCell } = schema.nodes
  const cell = tableCell.create(null, paragraph.create(null, schema.text('Team')))
  return doc.create(null, [
    ...(heading ? [schema.nodes.heading.create(null, schema.text('Standings'))] : []),
    table.create(null, tableRow.create(null, cell)),
    ...(after ? [paragraph.create(null, schema.text('Rest of story'))] : []),
  ])
}

function rect(top, bottom) {
  return { left: 0, right: 800, top, bottom }
}

function mockView(doc) {
  const dom = { getBoundingClientRect: () => rect(0, 600) }
  let focusCount = 0
  let dispatchCount = 0
  const view = {
    dom,
    editable: true,
    state: EditorState.create({ doc }),
    nodeDOM(pos) {
      let start = 0
      for (let index = 0; index < this.state.doc.childCount; index += 1) {
        const node = this.state.doc.child(index)
        if (start === pos) {
          const bounds = node.type.name === 'heading'
            ? rect(60, 110)
            : node.type.name === 'table'
              ? rect(130, 300)
              : rect(320, 360)
          return { nodeType: 1, getBoundingClientRect: () => bounds }
        }
        start += node.nodeSize
      }
      return null
    },
    dispatch(transaction) {
      dispatchCount += 1
      this.state = this.state.apply(transaction)
    },
    focus() { focusCount += 1 },
    get focusCount() { return focusCount },
    get dispatchCount() { return dispatchCount },
  }
  return view
}

function click(view, y, overrides = {}) {
  return {
    target: view.dom,
    button: 0,
    detail: 1,
    clientX: 100,
    clientY: y,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...overrides,
  }
}

test('clicking the empty gaps beside a table places a writing cursor without losing text', async () => {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    cacheDir: '/private/tmp/story-table-gap-vite-cache',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  try {
    const { createTableGapTransaction, handleStoryTableGapClick } =
      await server.ssrLoadModule('/src/components/storyTableGap.ts')

    const above = mockView(storyDoc())
    assert.equal(handleStoryTableGapClick(above, click(above, 120)), true)
    assert.equal(above.state.doc.childCount, 4)
    assert.equal(above.state.doc.child(0).textContent, 'Standings')
    assert.equal(above.state.doc.child(1).type.name, 'paragraph')
    assert.equal(above.state.doc.child(3).textContent, 'Rest of story')
    assert.equal(above.state.selection.$from.parent.type.name, 'paragraph')
    assert.equal(above.state.selection.from, above.state.doc.child(0).nodeSize + 1)
    assert.equal(above.dispatchCount, 1)
    assert.equal(above.focusCount, 1)

    const below = mockView(storyDoc())
    assert.equal(handleStoryTableGapClick(below, click(below, 310)), true)
    assert.equal(below.state.doc.childCount, 4)
    assert.equal(below.state.doc.child(2).type.name, 'paragraph')
    assert.equal(below.state.doc.child(2).textContent, '')
    assert.equal(below.state.doc.lastChild.textContent, 'Rest of story')
    assert.equal(below.state.selection.from,
      below.state.doc.child(0).nodeSize + below.state.doc.child(1).nodeSize + 1)

    const tableLast = mockView(storyDoc({ after: false }))
    assert.equal(handleStoryTableGapClick(tableLast, click(tableLast, 310)), true)
    assert.equal(tableLast.state.doc.lastChild.type.name, 'paragraph')
    assert.equal(tableLast.state.selection.$from.parent.type.name, 'paragraph')

    const tableFirstDoc = storyDoc({ heading: false })
    const before = createTableGapTransaction(EditorState.create({ doc: tableFirstDoc }), 0, 'before')
    assert.ok(before)
    assert.equal(before.doc.firstChild.type.name, 'paragraph')
    assert.equal(before.selection.from, 1)

    const paragraphFirst = schema.nodes.paragraph.create(null, schema.text('Lead'))
    const withLead = schema.nodes.doc.create(null, [paragraphFirst, tableFirstDoc.firstChild])
    const insertBetween = createTableGapTransaction(EditorState.create({ doc: withLead }), paragraphFirst.nodeSize, 'before')
    assert.ok(insertBetween)
    assert.equal(insertBetween.doc.childCount, 3)
    assert.equal(insertBetween.doc.firstChild.textContent, 'Lead')
    assert.equal(insertBetween.doc.child(1).textContent, '')
    assert.equal(insertBetween.selection.from, paragraphFirst.nodeSize + 1)

    const emptyLead = schema.nodes.paragraph.create()
    const withEmptyLead = schema.nodes.doc.create(null, [emptyLead, tableFirstDoc.firstChild])
    const reuseBefore = createTableGapTransaction(EditorState.create({ doc: withEmptyLead }), emptyLead.nodeSize, 'before')
    assert.ok(reuseBefore)
    assert.equal(reuseBefore.doc.childCount, 2)
    assert.equal(reuseBefore.selection.from, 1)

    const withEmptyAfter = schema.nodes.doc.create(null, [tableFirstDoc.firstChild, schema.nodes.paragraph.create()])
    const reuseAfter = createTableGapTransaction(EditorState.create({ doc: withEmptyAfter }), 0, 'after')
    assert.ok(reuseAfter)
    assert.equal(reuseAfter.doc.childCount, 2)
    assert.equal(reuseAfter.selection.from, tableFirstDoc.firstChild.nodeSize + 1)

    assert.equal(createTableGapTransaction(EditorState.create({ doc: storyDoc() }), 0, 'after'), null)

    const ordinaryClick = mockView(storyDoc())
    assert.equal(handleStoryTableGapClick(ordinaryClick, click(ordinaryClick, 200)), false)
    assert.equal(handleStoryTableGapClick(ordinaryClick, click(ordinaryClick, 120, { shiftKey: true })), false)
    assert.equal(handleStoryTableGapClick(ordinaryClick, click(ordinaryClick, 120, { detail: 2 })), false)
    assert.equal(handleStoryTableGapClick(ordinaryClick, click(ordinaryClick, 120, { target: {} })), false)
    assert.equal(ordinaryClick.dispatchCount, 0)
  } finally {
    await server.close()
  }
})
