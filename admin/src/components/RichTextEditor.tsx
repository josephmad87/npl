import type { Editor } from '@tiptap/core'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
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
import { useEffect } from 'react'

type RichTextEditorProps = {
  initialHtml: string
  onHtmlChange: (html: string) => void
  disabled?: boolean
  placeholder?: string
}

function isAlignActive(editor: Editor, align: 'left' | 'center' | 'right') {
  return editor.isActive({ textAlign: align })
}

function Toolbar({ editor }: { editor: Editor }) {
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
  )
}

export function RichTextEditor({
  initialHtml,
  onHtmlChange,
  disabled = false,
  placeholder = 'Write your article…',
}: RichTextEditorProps) {
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
      {disabled ? null : <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="rich-text-editor__content" />
    </div>
  )
}
