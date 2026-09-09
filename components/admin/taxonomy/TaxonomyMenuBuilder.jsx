'use client';

import { useMemo, useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  flattenVisibleTaxonomyRows,
  getLastInSiblingGroupMap,
  getTaxonomyId,
  injectSameLevelAddSlots,
} from '@/lib/taxonomy/taxonomyTreeUtils';
import { useTaxonomyData } from './hooks/useTaxonomyData';
import { useTaxonomySearch } from './hooks/useTaxonomySearch';
import { useTaxonomyDragReorder } from './hooks/useTaxonomyDragReorder';
import { useTaxonomyPermissions } from './hooks/useTaxonomyPermissions';
import TaxonomyMenuRow from './TaxonomyMenuRow';
import TaxonomyEditPanel from './TaxonomyEditPanel';
import TaxonomySameLevelAddRow from './TaxonomySameLevelAddRow';
import TaxonomyToolbar from './TaxonomyToolbar';
import TaxonomyRootAdd from './TaxonomyRootAdd';

/**
 * Sortable nested menu for categories or brands.
 *
 * Create/edit/delete/reorder stay optimistic in useTaxonomyData.
 * This component only composes search, drag, rows, and the edit panel.
 */
export default function TaxonomyMenuBuilder({ config }) {
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
  } = useTaxonomyData(config);

  const { canDelete } = useTaxonomyPermissions();
  const { search, setSearch, debouncedSearch, displayTree } = useTaxonomySearch({
    items,
    tree,
    idMap,
    parentMap,
    setExpandedIds,
  });
  const [editingNode, setEditingNode] = useState(null);

  const visibleRows = useMemo(
    () => flattenVisibleTaxonomyRows(displayTree, expandedIds),
    [displayTree, expandedIds]
  );
  const renderEntries = useMemo(
    () => injectSameLevelAddSlots(visibleRows, expandedIds, canAddChild, getChildLevel),
    [visibleRows, expandedIds, canAddChild, getChildLevel]
  );
  const isRowLastInGroup = useMemo(() => getLastInSiblingGroupMap(visibleRows), [visibleRows]);
  const sortableIds = useMemo(() => visibleRows.map((r) => r.id), [visibleRows]);

  const { sensors, handleDragEnd } = useTaxonomyDragReorder({
    visibleRows,
    items,
    canAddChild,
    reorderSiblings,
    setExpandedIds,
  });

  const handleInlineAdd = async (parentNode, name) => {
    await createItem({
      name,
      parent: getTaxonomyId(parentNode),
      level: getChildLevel(parentNode),
    });
  };

  const handleRootAdd = (name) =>
    createItem({ name, parent: null, level: config.levels[0] });

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

      <TaxonomyToolbar
        search={search}
        onSearchChange={setSearch}
        itemCount={items.length}
        responseKey={config.responseKey}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
      />

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-3 py-2.5 sm:px-4">
          <h2 className="text-sm font-semibold text-gray-800">Menu items</h2>
          <p className="mt-0.5 text-xs text-gray-500">
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
                    onInlineAdd={handleInlineAdd}
                  />
                ) : (
                  <TaxonomySameLevelAddRow
                    key={`add-${getTaxonomyId(entry.parentNode)}-${idx}`}
                    parentNode={entry.parentNode}
                    parentName={entry.parentName}
                    level={entry.level}
                    depth={entry.depth}
                    saving={saving}
                    onAdd={handleInlineAdd}
                  />
                )
              )}
            </SortableContext>
          </DndContext>
        )}

        <div className="border-t border-gray-200 bg-slate-50/50 px-3 py-3 sm:px-4">
          <TaxonomyRootAdd level={config.levels[0]} saving={saving} onAdd={handleRootAdd} />
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
            await updateItem(getTaxonomyId(editingNode), payload);
            setEditingNode(null);
          }}
        />
      )}
    </div>
  );
}
