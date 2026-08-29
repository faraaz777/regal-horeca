'use client';

import { useState } from 'react';
import { PlusIcon } from '@/components/Icons';
import TaxonomyAddContext from './TaxonomyAddContext';
import TaxonomyRowShell from './TaxonomyRowShell';
import TaxonomyTreeIndent from './TaxonomyTreeIndent';

/**
 * Same-level add row — aligned with siblings and labeled with parent context.
 */
export default function TaxonomySameLevelAddRow({
  parentName,
  level,
  depth,
  saving,
  onAdd,
  parentNode,
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await onAdd(parentNode, trimmed);
    setName('');
    setAdding(false);
  };

  const spacer = <div className="h-4 w-4 shrink-0" aria-hidden />;

  if (adding) {
    return (
      <TaxonomyRowShell
        variant="add"
        dragHandle={spacer}
        treeIndent={<TaxonomyTreeIndent depth={depth} isLastInGroup />}
      >
        <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`New ${level} name`}
            className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm"
          />
          <button type="submit" disabled={saving || !name.trim()} className="text-xs font-semibold text-primary">
            Add
          </button>
          <button type="button" onClick={() => setAdding(false)} className="text-xs text-gray-500">
            Cancel
          </button>
        </form>
      </TaxonomyRowShell>
    );
  }

  return (
    <TaxonomyRowShell
      variant="add"
      dragHandle={spacer}
      treeIndent={<TaxonomyTreeIndent depth={depth} isLastInGroup />}
    >
      <button
        type="button"
        onClick={() => setAdding(true)}
        disabled={saving}
        className="flex w-full items-center gap-3 rounded-md border border-dashed border-gray-300 bg-white/80 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-white disabled:opacity-50"
      >
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-dashed border-primary/30 bg-primary/5 text-primary">
          <PlusIcon className="h-3.5 w-3.5" />
        </span>
        <TaxonomyAddContext level={level} parentName={parentName} />
      </button>
    </TaxonomyRowShell>
  );
}
