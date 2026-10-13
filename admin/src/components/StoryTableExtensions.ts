import { mergeAttributes } from '@tiptap/core'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'

export const storyTableVariants = ['standard', 'striped', 'compact', 'minimal'] as const
export type StoryTableVariant = (typeof storyTableVariants)[number]

function tableVariant(value: unknown): StoryTableVariant {
  return storyTableVariants.find((variant) => variant === value) ?? 'standard'
}

function cellAlign(value: unknown): 'left' | 'center' | 'right' | null {
  return value === 'left' || value === 'center' || value === 'right' ? value : null
}

function headerScope(value: unknown): 'col' | 'row' | null {
  return value === 'col' || value === 'row' ? value : null
}

// A small set of classes keeps table appearance editable while allowing the
// API to reject arbitrary styling from pasted HTML.
export const StoryTable = Table.extend({
  addAttributes() {
    return {
      variant: {
        default: 'standard',
        parseHTML: (element: HTMLElement) =>
          storyTableVariants.find((variant) =>
            element.classList.contains(`story-table--${variant}`),
          ) ?? 'standard',
        renderHTML: (attributes: { variant?: unknown }) => ({
          class: `story-table story-table--${tableVariant(attributes.variant)}`,
        }),
      },
    }
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'table',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      ['tbody', 0],
    ]
  },
})

// Tiptap's built-in cell alignment writes inline CSS, which the story HTML
// sanitizers remove. The semantic align attribute survives the full save path.
const alignAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) =>
    cellAlign(element.getAttribute('align') ?? element.style.textAlign),
  renderHTML: (attributes: { align?: unknown }) => {
    const align = cellAlign(attributes.align)
    return align ? { align } : {}
  },
}

const scopeAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => headerScope(element.getAttribute('scope')),
  renderHTML: (attributes: { scope?: unknown }) => {
    const scope = headerScope(attributes.scope)
    return scope ? { scope } : {}
  },
}

export const StoryTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), align: alignAttribute }
  },
})

export const StoryTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), align: alignAttribute, scope: scopeAttribute }
  },
})

export { TableRow as StoryTableRow }

export function standingsTableHtml(teamRows: number): string {
  const rows = Math.min(30, Math.max(1, Math.floor(teamRows)))
  const headings = ['Pos', 'Team', 'P', 'W', 'L', 'NRR', 'Pts']
  const header = `<tr>${headings.map((heading) => `<th scope="col">${heading}</th>`).join('')}</tr>`
  const body = Array.from({ length: rows }, (_, index) =>
    `<tr><td>${index + 1}</td>${headings.slice(1).map(() => '<td></td>').join('')}</tr>`,
  ).join('')
  return `<table class="story-table story-table--standard"><tbody>${header}${body}</tbody></table><p></p>`
}
