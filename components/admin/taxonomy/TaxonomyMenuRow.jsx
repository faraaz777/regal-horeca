'use client';

import { memo, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DragHandleIcon,
  PlusIcon,
} from '@/components/Icons';
import { getTaxonomyPath } from '@/lib/taxonomy/taxonomyTreeUtils';
import { formatTaxonomyLevelLabel } from './taxonomyMenuLayout';
import TaxonomyLevelBadge from './TaxonomyLevelBadge';
import TaxonomyRowShell from './TaxonomyRowShell';
import TaxonomyTreeIndent from './TaxonomyTreeIndent';

function TaxonomyMenuRowComponent({
  row,
  idMap,
  saving,
  canAddChild,
  getChildLevel,
  isLastInGroup = false,
  canDelete = false,
  onToggle,
  onEdit,
  onDelete,
  onInlineAdd,
  searchQuery,
}) {
  const { node, depth, hasChildren, isExpanded, id } = row;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { parentId: row.parentId, depth },
  });

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  const path = getTaxonomyPath(id, idMap);
  const pathLabel = path.join(' › ');
  const expandable = hasChildren || canAddChild(node);
  const isParent = expandable || hasChildren;

  const handleInlineSubmit = async (e) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    await onInlineAdd(node, trimmed);
    setNewName('');
    setAdding(false);
  };

  const handleToggle = () => {
    if (expandable) onToggle(id);
  };

  const highlightName = (name) => {
    if (!searchQuery) return name;
    const q = searchQuery.toLowerCase();
    const lower = String(name).toLowerCase();
    const idx = lower.indexOf(q);
    if (idx < 0) return name;
    return (
      <>
        {name.slice(0, idx)}
        <mark className="bg-amber-100 rounded px-0.5">{name.slice(idx, idx + q.length)}</mark>
        {name.slice(idx + q.length)}
      </>
    );
  };

  const dragHandle = (
    <button
      type="button"
      className="touch-none cursor-grab active:cursor-grabbing rounded p-1.5 text-gray-400 hover:bg-white hover:text-gray-600"
      aria-label="Drag to reorder"
      onClick={(e) => e.stopPropagation()}
      {...attributes}
      {...listeners}
    >
      <DragHandleIcon className="h-4 w-4" />
    </button>
  );

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={isDragging ? 'relative z-20 shadow-md ring-1 ring-gray-200' : undefined}
      >
        <TaxonomyRowShell
          isParent={isParent}
          isExpanded={isExpanded}
          dragHandle={dragHandle}
          treeIndent={<TaxonomyTreeIndent depth={depth} isLastInGroup={isLastInGroup} />}
        >
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={handleToggle}
              disabled={!expandable}
              className={[
                'flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 pl-1 pr-2 text-left transition-colors',
                expandable ? 'cursor-pointer hover:bg-gray-100/80' : 'cursor-default',
              ].join(' ')}
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center text-gray-500 ${expandable ? '' : 'invisible'}`}>
                {expandable && (isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />)}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className={`truncate text-sm ${isParent ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>
                    {highlightName(node.name)}
                  </span>
                  <TaxonomyLevelBadge level={node.level} />
                </span>
                {depth > 0 && (
                  <span className="mt-0.5 block truncate text-[11px] text-gray-400" title={pathLabel}>
                    {pathLabel}
                  </span>
                )}
              </span>
            </button>

            <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              {canAddChild(node) && (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  disabled={saving}
                  className="hidden rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 sm:inline-flex sm:items-center sm:gap-0.5"
                  title={`Add ${formatTaxonomyLevelLabel(getChildLevel?.(node))}`}
                >
                  <PlusIcon className="h-3 w-3" /> Child
                </button>
              )}
              <button
                type="button"
                onClick={() => onEdit(node)}
                disabled={saving}
                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Edit
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(id)}
                  disabled={saving}
                  className="rounded-md border border-red-100 bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </TaxonomyRowShell>
      </div>

      {adding && (
        <form
          onSubmit={handleInlineSubmit}
          className="flex items-center gap-2 border-b border-gray-100 bg-blue-50/40 py-2.5 pl-[52px] pr-3 sm:pl-[52px]"
          style={{ marginLeft: depth > 0 ? depth * 20 : 0 }}
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`New ${getChildLevel?.(node) || 'child'} name`}
            className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm"
          />
          <button type="submit" disabled={saving || !newName.trim()} className="text-xs font-semibold text-primary">
            Add
          </button>
          <button type="button" onClick={() => setAdding(false)} className="text-xs text-gray-500">
            Cancel
          </button>
        </form>
      )}
    </>
  );
}

export default memo(TaxonomyMenuRowComponent);
