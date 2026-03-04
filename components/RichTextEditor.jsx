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

  const btn =
    'min-w-[32px] h-8 px-2 text-xs font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-white hover:border-gray-300 hover:shadow-sm transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed';
  const active = 'bg-gray-800 text-white border-gray-800 hover:bg-gray-700 hover:border-gray-700 hover:shadow-sm';

  const Divider = () => (
    <div className="w-px h-6 bg-gray-200 flex-shrink-0" aria-hidden="true" />
  );

  return (
    <div className={`rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 bg-gray-50/80 border-b border-gray-200">
        {/* Format: B, /, U, S */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`${btn} ${editor.isActive('bold') ? active : ''}`}
            title="Bold"
          >
            <span className="font-bold">B</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`${btn} ${editor.isActive('italic') ? active : ''}`}
            title="Italic"
          >
            <span className="italic font-serif text-sm">/</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`${btn} ${editor.isActive('underline') ? active : ''}`}
            title="Underline"
          >
            <span className="underline">U</span>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`${btn} ${editor.isActive('strike') ? active : ''}`}
            title="Strikethrough"
          >
            <span className="line-through">S</span>
          </button>
        </div>

        <Divider />

        {/* Lists */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`${btn} ${editor.isActive('bulletList') ? active : ''}`}
            title="Bullet list"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`${btn} ${editor.isActive('orderedList') ? active : ''}`}
            title="Numbered list"
          >
            <span className="font-mono text-sm">#</span>
          </button>
        </div>

        <Divider />

        {/* Table: icon + Row/Col + Clear */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
            className={btn}
            title="Insert table"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v18H3V3zm0 9h18m-9-9v18" />
            </svg>
          </button>
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className={btn} title="Add row">
            + Row
          </button>
          <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className={btn} title="Delete row">
            − Row
          </button>
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className={btn} title="Add column">
            + Col
          </button>
          <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className={btn} title="Delete column">
            − Col
          </button>
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className={`${btn} text-red-600 hover:text-red-700 hover:border-red-200 hover:bg-red-50`} title="Delete table">
            Clear
          </button>
        </div>

        {toolbarExtra && (
          <>
            <Divider />
            <div className="ml-auto">{toolbarExtra}</div>
          </>
        )}
      </div>

      <div
        className="bg-white focus-within:ring-2 focus-within:ring-gray-200 focus-within:ring-inset transition-shadow"
        style={{ minHeight }}
      >
        <EditorContent editor={editor} className="p-4 ProseMirror min-h-[80px]" />
      </div>
    </div>
  );
}

