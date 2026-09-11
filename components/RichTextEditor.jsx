/**
 * RichTextEditor
 *
 * Reusable TipTap-based rich text editor with:
 * - Basic formatting: bold, italic, underline, strike
 * - Bullet and ordered lists
 * - Tables (insert + modify)
 *
 * Value/onChange work with HTML strings so the admin doesn't need to know Markdown.
 */

'use client';

import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';

function normalizeHtml(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed === '<p></p>') return '';
  return trimmed;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = '',
  minHeight = '140px',
  className = '',
  toolbarExtra = null,
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Underline,
      Table.configure({
        resizable: false,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = normalizeHtml(editor.getHTML());
      onChange?.(html);
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none',
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const current = normalizeHtml(editor.getHTML());
    const next = normalizeHtml(value || '');
    if (current === next) return;
    editor.commands.setContent(next || '<p></p>', false);
  }, [editor, value]);

  if (!editor) return null;

  /**
   * Match product-form chip language (Business types): thin border, white fill,
   * neutral-900 when active — no gray toolbar band or soft shadows.
   */
  const iconBtn =
    'flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-800 transition-colors hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';
  const iconActive = 'border-neutral-900 bg-neutral-900 text-white hover:border-neutral-900 hover:bg-neutral-900';
  const stepBtn =
    'flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white text-sm leading-none text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';

  const Divider = () => (
    <div className="mx-1 h-12 w-px flex-shrink-0 self-center bg-gray-200" aria-hidden="true" />
  );

  return (
    <div className={`overflow-hidden rounded-md border border-gray-200 bg-white ${className}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-2 py-2">
        {/* Format — 2×2 */}
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`${iconBtn} ${editor.isActive('bold') ? iconActive : ''}`}
            title="Bold"
          >
            <span className="text-[11px] font-bold">B</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`${iconBtn} ${editor.isActive('italic') ? iconActive : ''}`}
            title="Italic"
          >
            <span className="text-[11px] italic">I</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`${iconBtn} ${editor.isActive('underline') ? iconActive : ''}`}
            title="Underline"
          >
            <span className="text-[11px] underline">U</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`${iconBtn} ${editor.isActive('strike') ? iconActive : ''}`}
            title="Strikethrough"
          >
            <span className="text-[11px] line-through">S</span>
          </button>
        </div>

        <Divider />

        {/* Lists — stacked */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`${iconBtn} ${editor.isActive('bulletList') ? iconActive : ''}`}
            title="Bullet list"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`${iconBtn} ${editor.isActive('orderedList') ? iconActive : ''}`}
            title="Numbered list"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M4 16.5c0-.83.67-1.5 1.5-1.5S7 15.67 7 16.5 6.33 18 5.5 18H4v-1.5" />
            </svg>
          </button>
        </div>

        <Divider />

        {/* Table — insert + row/col steppers; clear on the table tile */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
              className="flex h-[3.75rem] w-14 flex-col items-center justify-center gap-0.5 rounded-md border border-gray-200 bg-white pr-3 text-gray-800 transition-colors hover:border-gray-400 hover:bg-gray-50"
              title="Insert table"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v18H3V3zm0 9h18m-9-9v18" />
              </svg>
              <span className="text-[9px] font-medium leading-none">Table</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                editor.chain().focus().deleteTable().run();
              }}
              className="absolute right-0.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-30"
              title="Remove table"
              disabled={!editor.can().deleteTable()}
              aria-label="Remove table"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="w-11 text-[10px] font-medium text-gray-500">Row</span>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteRow().run()}
                className={stepBtn}
                title="Delete row"
                disabled={!editor.can().deleteRow()}
              >
                −
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().addRowAfter().run()}
                className={stepBtn}
                title="Add row"
                disabled={!editor.can().addRowAfter()}
              >
                +
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-11 text-[10px] font-medium text-gray-500">Column</span>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteColumn().run()}
                className={stepBtn}
                title="Delete column"
                disabled={!editor.can().deleteColumn()}
              >
                −
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                className={stepBtn}
                title="Add column"
                disabled={!editor.can().addColumnAfter()}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {toolbarExtra ? <div className="ml-auto">{toolbarExtra}</div> : null}
      </div>

      <div
        className="bg-white transition-colors focus-within:bg-gray-50/40"
        style={{ minHeight }}
      >
        <EditorContent editor={editor} className="ProseMirror min-h-[80px] p-3.5 text-sm text-gray-800" />
      </div>
    </div>
  );
}

