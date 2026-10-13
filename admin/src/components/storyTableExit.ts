import type { Editor } from '@tiptap/core'
import { NodeSelection, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'

/** Move the cursor out of the current table, leaving a paragraph to write in. */
export function createTableExitTransaction(state: EditorState): Transaction | null {
  const { selection } = state
  let tableEnd: number | null = null

  if (selection instanceof NodeSelection && selection.node.type.name === 'table') {
    tableEnd = selection.to
  } else {
    for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
      if (selection.$from.node(depth).type.name === 'table') {
        tableEnd = selection.$from.after(depth)
        break
      }
    }
  }

  if (tableEnd === null) return null

  const transaction = state.tr
  if (state.doc.nodeAt(tableEnd)?.type.name !== 'paragraph') {
    const paragraph = state.schema.nodes.paragraph?.create()
    if (!paragraph) return null
    transaction.insert(tableEnd, paragraph)
  }

  transaction.setSelection(TextSelection.create(transaction.doc, tableEnd + 1))
  return transaction.scrollIntoView()
}

export function continueWritingAfterTable(editor: Editor): boolean {
  const transaction = createTableExitTransaction(editor.state)
  if (!transaction) return false

  editor.view.dispatch(transaction)
  editor.commands.focus()
  return true
}
