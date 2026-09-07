'use client';

import { useState } from 'react';
import { PlusIcon } from '@/components/Icons';
import TaxonomyAddContext from './TaxonomyAddContext';

/**
 * Add a top-level department at the bottom of the menu list.
 * Level is always the first config level — never chosen from a dropdown.
 */
export default function TaxonomyRootAdd({ level, saving, onAdd }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await onAdd(trimmed);
    setName('');
    setAdding(false);
  };

  if (adding) {
    return (
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2.5"
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`New ${level} name`}
          className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <button type="submit" disabled={saving || !name.trim()} className="text-sm font-semibold text-primary">
          Add
        </button>
        <button type="button" onClick={() => setAdding(false)} className="text-sm text-gray-500">
          Cancel
        </button>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="flex w-full items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white/80 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-white"
    >
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-dashed border-primary/30 bg-primary/5 text-primary">
        <PlusIcon className="h-3.5 w-3.5" />
      </span>
      <TaxonomyAddContext level={level} parentName={null} />
    </button>
  );
}
