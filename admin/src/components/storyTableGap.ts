import { TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

type TableSide = 'before' | 'after'

/** Put a text cursor in a paragraph immediately beside a top-level table. */
export function createTableGapTransaction(
  state: EditorState,
  tableStart: number,
  side: TableSide,
): Transaction | null {
  const $table = state.doc.resolve(tableStart)
  const table = $table.nodeAfter
  if ($table.depth !== 0 || table?.type.name !== 'table') return null

  const transaction = state.tr
  if (side === 'before') {
    if ($table.nodeBefore?.type.name === 'paragraph' && $table.nodeBefore.content.size === 0) {
      transaction.setSelection(TextSelection.create(transaction.doc, tableStart - 1))
    } else {
      const paragraph = state.schema.nodes.paragraph?.create()
      if (!paragraph) return null
      transaction.insert(tableStart, paragraph)
      transaction.setSelection(TextSelection.create(transaction.doc, tableStart + 1))
    }
  } else {
    const tableEnd = tableStart + table.nodeSize
    const following = state.doc.nodeAt(tableEnd)
    if (following?.type.name !== 'paragraph' || following.content.size > 0) {
      const paragraph = state.schema.nodes.paragraph?.create()
      if (!paragraph) return null
      transaction.insert(tableEnd, paragraph)
    }
    transaction.setSelection(TextSelection.create(transaction.doc, tableEnd + 1))
  }

  return transaction.scrollIntoView()
}

function nodeRect(node: Node | null): DOMRect | null {
  return node?.nodeType === 1 ? (node as Element).getBoundingClientRect() : null
}

/** Make the blank space around a table behave like a place to write. */
export function handleStoryTableGapClick(view: EditorView, event: MouseEvent): boolean {
  if (
    !view.editable ||
    event.target !== view.dom ||
    event.button !== 0 ||
    event.detail !== 1 ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) return false

  const rootRect = view.dom.getBoundingClientRect()
  const { clientX: x, clientY: y } = event
  if (x < rootRect.left || x > rootRect.right || y < rootRect.top || y > rootRect.bottom) {
    return false
  }

  const { doc } = view.state
  let tableStart = 0
  for (let index = 0; index < doc.childCount; index += 1) {
    const block = doc.child(index)
    if (block.type.name === 'table') {
      const tableRect = nodeRect(view.nodeDOM(tableStart))
      if (tableRect) {
        const before = index > 0
          ? nodeRect(view.nodeDOM(tableStart - doc.child(index - 1).nodeSize))
          : null
        const after = index < doc.childCount - 1
          ? nodeRect(view.nodeDOM(tableStart + block.nodeSize))
          : null
        const beforeBoundary = index === 0 ? rootRect.top : (before?.bottom ?? tableRect.top)
        const afterBoundary = index === doc.childCount - 1 ? rootRect.bottom : (after?.top ?? tableRect.bottom)
        const side = y >= beforeBoundary && y < tableRect.top
          ? 'before'
          : y > tableRect.bottom && y <= afterBoundary
            ? 'after'
            : null

        if (side) {
          const transaction = createTableGapTransaction(view.state, tableStart, side)
          if (!transaction) return false
          view.dispatch(transaction)
          view.focus()
          return true
        }
      }
    }
    tableStart += block.nodeSize
  }

  return false
}
