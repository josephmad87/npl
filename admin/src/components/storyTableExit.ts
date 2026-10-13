import type { Editor } from '@tiptap/core'
import { NodeSelection, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'

function selectedTableBounds(state: EditorState): { start: number; end: number } | null {
  const { selection } = state

  if (selection instanceof NodeSelection && selection.node.type.name === 'table') {
    return { start: selection.from, end: selection.to }
  }

  for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
    if (selection.$from.node(depth).type.name === 'table') {
      return { start: selection.$from.before(depth), end: selection.$from.after(depth) }
    }
  }

  return null
}

/** Move the cursor out of the current table, leaving a paragraph to write in. */
export function createTableExitTransaction(state: EditorState): Transaction | null {
  const bounds = selectedTableBounds(state)
  if (!bounds) return null

  const transaction = state.tr
  if (state.doc.nodeAt(bounds.end)?.type.name !== 'paragraph') {
    const paragraph = state.schema.nodes.paragraph?.create()
    if (!paragraph) return null
    transaction.insert(bounds.end, paragraph)
  }

  transaction.setSelection(TextSelection.create(transaction.doc, bounds.end + 1))
  return transaction.scrollIntoView()
}

/** Put the cursor in a paragraph immediately before the current table. */
export function createTableBeforeTransaction(state: EditorState): Transaction | null {
  const bounds = selectedTableBounds(state)
  if (!bounds) return null

  const preceding = state.doc.resolve(bounds.start).nodeBefore
  const transaction = state.tr
  if (preceding?.type.name === 'paragraph') {
    transaction.setSelection(TextSelection.create(transaction.doc, bounds.start - 1))
  } else {
    const paragraph = state.schema.nodes.paragraph?.create()
    if (!paragraph) return null
    transaction.insert(bounds.start, paragraph)
    transaction.setSelection(TextSelection.create(transaction.doc, bounds.start + 1))
  }
  return transaction.scrollIntoView()
}

export function continueWritingAfterTable(editor: Editor): boolean {
  const transaction = createTableExitTransaction(editor.state)
  if (!transaction) return false

  editor.view.dispatch(transaction)
  editor.commands.focus()
  return true
}

export function continueWritingBeforeTable(editor: Editor): boolean {
  const transaction = createTableBeforeTransaction(editor.state)
  if (!transaction) return false

  editor.view.dispatch(transaction)
  editor.commands.focus()
  return true
}
