import type { Editor } from '@tiptap/core'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  StoryTable,
  StoryTableCell,
  StoryTableHeader,
  StoryTableRow,
  standingsTableHtml,
  storyTableVariants,
  type StoryTableVariant,
} from '@/components/StoryTableExtensions'
import { StandingsTablePicker } from '@/components/StandingsTablePicker'

type RichTextEditorProps = {
  initialHtml: string
  onHtmlChange: (html: string) => void
  disabled?: boolean
  placeholder?: string
  enableTables?: boolean
}

function isAlignActive(editor: Editor, align: 'left' | 'center' | 'right') {
  return editor.isActive({ textAlign: align })
}

function boundedCount(value: string, fallback: number, max: number): number {
  return Math.min(max, Math.max(1, Number.parseInt(value, 10) || fallback))
}

function Toolbar({
  editor,
  enableTables,
  onOpenStandingsPicker,
}: {
  editor: Editor
  enableTables: boolean
  onOpenStandingsPicker: () => void
}) {
  const [teamRows, setTeamRows] = useState('8')
  const [blankRows, setBlankRows] = useState('4')
  const [blankColumns, setBlankColumns] = useState('3')
  const tableState = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      inTable: enableTables && current.isActive('table'),
      variant: enableTables
        ? (current.getAttributes('table').variant as StoryTableVariant | undefined) ?? 'standard'
        : 'standard',
    }),
  })

  const insertStandingsTable = () => {
    const rows = boundedCount(teamRows, 8, 30)
    setTeamRows(String(rows))
    editor.chain().focus().insertContent(standingsTableHtml(rows)).run()
  }

  const insertBlankTable = () => {
    const rows = boundedCount(blankRows, 4, 30)
    const cols = boundedCount(blankColumns, 3, 12)
    setBlankRows(String(rows))
    setBlankColumns(String(cols))
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
  }

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const next = globalThis.prompt('Link URL', prev ?? 'https://')
    if (next === null) return
    const url = next.trim()
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const iconSize = 16

  return (
    <>
    <div className="rich-text-toolbar" role="toolbar" aria-label="Formatting">
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        data-active={editor.isActive('bold') ? 'true' : 'false'}
        aria-label="Bold"
        title="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
      >
        <Bold size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        data-active={editor.isActive('italic') ? 'true' : 'false'}
        aria-label="Italic"
        title="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
      >
        <Italic size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        data-active={editor.isActive('underline') ? 'true' : 'false'}
        aria-label="Underline"
        title="Underline"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        data-active={editor.isActive('strike') ? 'true' : 'false'}
        aria-label="Strikethrough"
        title="Strikethrough"
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <span className="rich-text-toolbar__sep" aria-hidden />
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        data-active={editor.isActive('heading', { level: 2 }) ? 'true' : 'false'}
        aria-label="Heading 2"
        title="Heading 2"
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
      >
        <Heading2 size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        data-active={editor.isActive('heading', { level: 3 }) ? 'true' : 'false'}
        aria-label="Heading 3"
        title="Heading 3"
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
      >
        <Heading3 size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        data-active={editor.isActive('paragraph') ? 'true' : 'false'}
        aria-label="Paragraph"
        title="Paragraph"
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <Pilcrow size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <span className="rich-text-toolbar__sep" aria-hidden />
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        data-active={editor.isActive('bulletList') ? 'true' : 'false'}
        aria-label="Bullet list"
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        data-active={editor.isActive('orderedList') ? 'true' : 'false'}
        aria-label="Numbered list"
        title="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        data-active={editor.isActive('blockquote') ? 'true' : 'false'}
        aria-label="Block quote"
        title="Block quote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        data-active={editor.isActive('codeBlock') ? 'true' : 'false'}
        aria-label="Code block"
        title="Code block"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <span className="rich-text-toolbar__sep" aria-hidden />
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        data-active={isAlignActive(editor, 'left') ? 'true' : 'false'}
        aria-label="Align left"
        title="Align left"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <AlignLeft size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        data-active={isAlignActive(editor, 'center') ? 'true' : 'false'}
        aria-label="Align centre"
        title="Align centre"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <AlignCenter size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        data-active={isAlignActive(editor, 'right') ? 'true' : 'false'}
        aria-label="Align right"
        title="Align right"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      >
        <AlignRight size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <span className="rich-text-toolbar__sep" aria-hidden />
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        aria-label="Insert link"
        title="Insert link"
        onClick={setLink}
      >
        <Link2 size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        aria-label="Remove link"
        title="Remove link"
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive('link')}
      >
        <Link2Off size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        aria-label="Horizontal rule"
        title="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        aria-label="Undo"
        title="Undo"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo2 size={iconSize} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="rich-text-toolbar__btn rich-text-toolbar__btn--icon"
        aria-label="Redo"
        title="Redo"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo2 size={iconSize} strokeWidth={2} aria-hidden />
      </button>
    </div>
    {enableTables ? (
      <div className="rich-text-table-toolbar" role="toolbar" aria-label="Story tables">
        <label className="rich-text-table-toolbar__rows">
          Rows
          <input
            type="number"
            min="1"
            max="30"
            value={blankRows}
            onChange={(event) => setBlankRows(event.target.value)}
            aria-label="Number of table rows"
          />
        </label>
        <label className="rich-text-table-toolbar__rows">
          Columns
          <input
            type="number"
            min="1"
            max="12"
            value={blankColumns}
            onChange={(event) => setBlankColumns(event.target.value)}
            aria-label="Number of table columns"
          />
        </label>
        <button type="button" className="rich-text-toolbar__btn" onClick={insertBlankTable}>
          Insert table
        </button>
        <span className="rich-text-toolbar__sep" aria-hidden />
        <label className="rich-text-table-toolbar__rows">
          Team rows
          <input
            type="number"
            min="1"
            max="30"
            value={teamRows}
            onChange={(event) => setTeamRows(event.target.value)}
            aria-label="Number of blank standings rows"
          />
        </label>
        <button type="button" className="rich-text-toolbar__btn" onClick={insertStandingsTable}>
          Insert blank standings table
        </button>
        <button type="button" className="rich-text-toolbar__btn" onClick={onOpenStandingsPicker}>
          Import current standings
        </button>
        {tableState.inTable ? (
          <>
            <span className="rich-text-toolbar__sep" aria-hidden />
            <button type="button" className="rich-text-toolbar__btn" onClick={() => editor.chain().focus().addRowBefore().run()}>
              Row above
            </button>
            <button type="button" className="rich-text-toolbar__btn" onClick={() => editor.chain().focus().addRowAfter().run()}>
              Row below
            </button>
            <button type="button" className="rich-text-toolbar__btn" onClick={() => editor.chain().focus().deleteRow().run()}>
              Remove row
            </button>
            <button type="button" className="rich-text-toolbar__btn" onClick={() => editor.chain().focus().addColumnBefore().run()}>
              Column left
            </button>
            <button type="button" className="rich-text-toolbar__btn" onClick={() => editor.chain().focus().addColumnAfter().run()}>
              Column right
            </button>
            <button type="button" className="rich-text-toolbar__btn" onClick={() => editor.chain().focus().deleteColumn().run()}>
              Remove column
            </button>
            <button type="button" className="rich-text-toolbar__btn" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
              Toggle header row
            </button>
            <button type="button" className="rich-text-toolbar__btn" onClick={() => editor.chain().focus().toggleHeaderColumn().run()}>
              Toggle header column
            </button>
            <button type="button" className="rich-text-toolbar__btn" onClick={() => editor.chain().focus().toggleHeaderCell().run()}>
              Toggle header cell
            </button>
            <button
              type="button"
              className="rich-text-toolbar__btn"
              onClick={() => editor.chain().focus().mergeCells().run()}
              disabled={!editor.can().mergeCells()}
            >
              Merge cells
            </button>
            <button
              type="button"
              className="rich-text-toolbar__btn"
              onClick={() => editor.chain().focus().splitCell().run()}
              disabled={!editor.can().splitCell()}
            >
              Split cell
            </button>
            <label className="rich-text-table-toolbar__style">
              Style
              <select
                value={tableState.variant}
                onChange={(event) => editor.chain().focus().updateAttributes('table', { variant: event.target.value }).run()}
                aria-label="Table style"
              >
                {storyTableVariants.map((variant) => (
                  <option key={variant} value={variant}>
                    {variant.charAt(0).toUpperCase() + variant.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <span className="rich-text-table-toolbar__align-label">Cell</span>
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                type="button"
                className="rich-text-toolbar__btn"
                onClick={() => editor.chain().focus().setCellAttribute('align', align).run()}
                aria-label={`Align cell ${align}`}
              >
                {align.charAt(0).toUpperCase() + align.slice(1)}
              </button>
            ))}
            <button type="button" className="rich-text-toolbar__btn" onClick={() => editor.chain().focus().deleteTable().run()}>
              Delete table
            </button>
            <span className="rich-text-table-toolbar__hint">Click a row, then remove it to leave that team out.</span>
          </>
        ) : null}
      </div>
    ) : null}
    </>
  )
}

export function RichTextEditor({
  initialHtml,
  onHtmlChange,
  disabled = false,
  placeholder = 'Write your article…',
  enableTables = false,
}: RichTextEditorProps) {
  const [standingsPickerOpen, setStandingsPickerOpen] = useState(false)
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3, 4] },
        }),
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
        }),
        Placeholder.configure({ placeholder }),
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        ...(enableTables ? [StoryTable.configure({ View: null }), StoryTableRow, StoryTableHeader, StoryTableCell] : []),
      ],
      content: initialHtml?.trim() ? initialHtml : '<p></p>',
      editable: !disabled,
      onUpdate: ({ editor: ed }) => {
        onHtmlChange(ed.getHTML())
      },
    },
    [],
  )

  useEffect(() => {
    if (!editor || disabled) return
    onHtmlChange(editor.getHTML())
  }, [editor, disabled, onHtmlChange])

  if (!editor) {
    return <div className="rich-text-editor rich-text-editor--loading muted" />
  }

  return (
    <div
      className={`rich-text-editor${disabled ? ' rich-text-editor--disabled' : ''}`}
    >
      {disabled ? null : (
        <Toolbar
          editor={editor}
          enableTables={enableTables}
          onOpenStandingsPicker={() => setStandingsPickerOpen(true)}
        />
      )}
      {enableTables && standingsPickerOpen && !disabled ? (
        <StandingsTablePicker
          onInsert={(html) => {
            editor.chain().focus().insertContent(html).run()
            setStandingsPickerOpen(false)
          }}
          onCancel={() => setStandingsPickerOpen(false)}
        />
      ) : null}
      <EditorContent editor={editor} className="rich-text-editor__content" />
    </div>
  )
}
