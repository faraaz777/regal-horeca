'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { PlusIcon, SearchIcon } from '@/components/Icons';
import {
  flattenVisibleTaxonomyRows,
  getSearchExpandIds,
  getSearchMatchedIds,
  getTaxonomyId,
  getTaxonomyParentId,
  injectSameLevelAddSlots,
} from '@/lib/taxonomy/taxonomyTreeUtils';
import { useTaxonomyData } from './hooks/useTaxonomyData';
import TaxonomyMenuRow from './TaxonomyMenuRow';
import TaxonomyEditPanel from './TaxonomyEditPanel';
import TaxonomySameLevelAddRow from './TaxonomySameLevelAddRow';
import TaxonomyAddContext from './TaxonomyAddContext';
import { useTaxonomyPermissions } from './hooks/useTaxonomyPermissions';

/**
 * Shopify-style sortable menu list for categories or brands.
 */
export default function TaxonomyMenuBuilder({ config }) {
  const data = useTaxonomyData(config);
  const {
    items,
    tree,
    idMap,
    parentMap,
    loading,
    error,
    saving,
    expandedIds,
    setExpandedIds,
    createItem,
    updateItem,
    deleteItem,
    reorderSiblings,
    toggleExpand,
    expandAll,
    collapseAll,
    canAddChild,
    getChildLevel,
  } = data;

  const { canDelete } = useTaxonomyPermissions();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [editingNode, setEditingNode] = useState(null);
  const [addingRoot, setAddingRoot] = useState(false);
  const [rootName, setRootName] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 150);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!debouncedSearch.trim()) return;
    const expandIds = getSearchExpandIds(items, debouncedSearch, idMap, parentMap);
    if (expandIds.size) {
      setExpandedIds((prev) => new Set([...prev, ...expandIds]));
    }
  }, [debouncedSearch, items, idMap, parentMap, setExpandedIds]);

  const matchedIds = useMemo(
    () => getSearchMatchedIds(items, debouncedSearch, idMap, parentMap),
    [items, debouncedSearch, idMap, parentMap]
  );

  const displayTree = useMemo(() => {
    if (!matchedIds) return tree;
    const filterTree = (nodes) =>
      nodes
        .filter((n) => matchedIds.has(getTaxonomyId(n)))
        .map((n) => ({
          ...n,
          children: n.children ? filterTree(n.children) : undefined,
        }));
    return filterTree(tree);
  }, [tree, matchedIds]);

  const visibleRows = useMemo(
    () => flattenVisibleTaxonomyRows(displayTree, expandedIds),
    [displayTree, expandedIds]
  );

  const renderEntries = useMemo(
    () => injectSameLevelAddSlots(visibleRows, expandedIds, canAddChild, getChildLevel),
    [visibleRows, expandedIds, canAddChild, getChildLevel]
  );

  const sortableIds = useMemo(() => visibleRows.map((r) => r.id), [visibleRows]);

  const isRowLastInGroup = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < visibleRows.length; i++) {
      const row = visibleRows[i];
      if (!row.parentId) {
        map.set(row.id, false);
        continue;
      }
      let isLast = true;
      for (let j = i + 1; j < visibleRows.length; j++) {
        if (visibleRows[j].parentId === row.parentId) {
          isLast = false;
          break;
        }
        if (visibleRows[j].depth <= row.depth) break;
      }
      map.set(row.id, isLast);
    }
    return map;
  }, [visibleRows]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeRow = visibleRows.find((r) => r.id === active.id);
    const overRow = visibleRows.find((r) => r.id === over.id);
    if (!activeRow || !overRow) return;

    const activeParent = activeRow.parentId ?? null;
    const overParent = overRow.parentId ?? null;

    if (activeParent === overParent) {
      const siblings = items.filter((x) => (getTaxonomyParentId(x) ?? null) === activeParent);
      const siblingIds = siblings.map((x) => getTaxonomyId(x));
      const oldIndex = siblingIds.indexOf(active.id);
      const newIndex = siblingIds.indexOf(over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      reorderSiblings(activeParent, arrayMove(siblingIds, oldIndex, newIndex));
      return;
    }

    if (canAddChild(overRow.node)) {
      const newParentId = overRow.id;
      const newSiblings = items.filter(
        (x) => getTaxonomyParentId(x) === newParentId && getTaxonomyId(x) !== active.id
      );
      const orderedIds = [...newSiblings.map(getTaxonomyId), active.id];
      reorderSiblings(newParentId, orderedIds);
      setExpandedIds((prev) => new Set(prev).add(newParentId));
    }
  };

  const handleInlineAddChild = async (parentNode, name) => {
    const parentId = getTaxonomyId(parentNode);
    const level = getChildLevel(parentNode);
    await createItem({ name, parent: parentId, level });
  };

  const handleSameLevelAdd = async (parentNode, name) => {
    await handleInlineAddChild(parentNode, name);
  };

  const handleRootAdd = async (e) => {
    e.preventDefault();
    const trimmed = rootName.trim();
    if (!trimmed) return;
    await createItem({ name: trimmed, parent: null, level: config.levels[0] });
    setRootName('');
    setAddingRoot(false);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${config.responseKey}…`}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <span className="text-gray-500">{items.length} items</span>
          <button
            type="button"
            onClick={expandAll}
            className="rounded border border-gray-200 px-2.5 py-1.5 text-gray-600 hover:bg-gray-50"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded border border-gray-200 px-2.5 py-1.5 text-gray-600 hover:bg-gray-50"
          >
            Collapse all
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-3 py-2.5 sm:px-4">
          <h2 className="text-sm font-semibold text-gray-800">Menu items</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Drag to reorder. Drop on another item to nest under it.
          </p>
        </div>

        {visibleRows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            {debouncedSearch ? 'No matches found.' : `No ${config.responseKey} yet.`}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {renderEntries.map((entry, idx) =>
                entry.type === 'item' ? (
                  <TaxonomyMenuRow
                    key={entry.row.id}
                    row={entry.row}
                    idMap={idMap}
                    saving={saving}
                    canAddChild={canAddChild}
                    getChildLevel={getChildLevel}
                    isLastInGroup={isRowLastInGroup.get(entry.row.id) ?? false}
                    canDelete={canDelete}
                    searchQuery={debouncedSearch}
                    onToggle={toggleExpand}
                    onEdit={setEditingNode}
                    onDelete={(id) => deleteItem(id, { canDelete })}
                    onInlineAdd={handleInlineAddChild}
                  />
                ) : (
                  <TaxonomySameLevelAddRow
                    key={`add-${getTaxonomyId(entry.parentNode)}-${idx}`}
                    parentNode={entry.parentNode}
                    parentName={entry.parentName}
                    level={entry.level}
                    depth={entry.depth}
                    saving={saving}
                    onAdd={handleSameLevelAdd}
                  />
                )
              )}
            </SortableContext>
          </DndContext>
        )}

        <div className="border-t border-gray-200 bg-slate-50/50 px-3 py-3 sm:px-4">
          {addingRoot ? (
            <form onSubmit={handleRootAdd} className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2.5">
              <input
                autoFocus
                value={rootName}
                onChange={(e) => setRootName(e.target.value)}
                placeholder={`New ${config.levels[0]} name`}
                className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <button type="submit" disabled={saving || !rootName.trim()} className="text-sm font-semibold text-primary">
                Add
              </button>
              <button type="button" onClick={() => setAddingRoot(false)} className="text-sm text-gray-500">
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAddingRoot(true)}
              className="flex w-full items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white/80 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-white"
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-dashed border-primary/30 bg-primary/5 text-primary">
                <PlusIcon className="h-3.5 w-3.5" />
              </span>
              <TaxonomyAddContext level={config.levels[0]} parentName={null} />
            </button>
          )}
        </div>
      </div>

      {editingNode && (
        <TaxonomyEditPanel
          config={config}
          node={editingNode}
          idMap={idMap}
          saving={saving}
          onClose={() => setEditingNode(null)}
          onSave={async (payload) => {
            const id = getTaxonomyId(editingNode);
            await updateItem(id, payload);
            setEditingNode(null);
          }}
        />
      )}
    </div>
  );
}
