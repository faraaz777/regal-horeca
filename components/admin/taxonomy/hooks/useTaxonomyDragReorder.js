'use client';

import { useCallback } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { getTaxonomyId, getTaxonomyParentId } from '@/lib/taxonomy/taxonomyTreeUtils';

/**
 * Drag-and-drop for the taxonomy menu list.
 *
 * Drop among siblings to reorder. Drop onto a node that can have children
 * to nest under it — that is how parent/level is changed without a dropdown.
 */
export function useTaxonomyDragReorder({
  visibleRows,
  items,
  canAddChild,
  reorderSiblings,
  setExpandedIds,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event) => {
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
    },
    [visibleRows, items, canAddChild, reorderSiblings, setExpandedIds]
  );

  return { sensors, handleDragEnd };
}
