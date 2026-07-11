'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { getRackStatusStyle } from '@/lib/client/locatorUtils';

export default function UnplacedRacksTray({ racks, editMode, onRackClick }) {
  if (!racks.length) {
    return (
      <div className="text-xs text-gray-400 italic px-2 py-4 text-center">
        All racks on this floor are placed.
      </div>
    );
  }

  return (
    <ul className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
      {racks.map((rack) => (
        <UnplacedRackRow
          key={rack._id}
          rack={rack}
          editMode={editMode}
          onRackClick={onRackClick}
        />
      ))}
    </ul>
  );
}

function UnplacedRackRow({ rack, editMode, onRackClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `unplaced-${rack._id}`,
    disabled: !editMode,
    data: { type: 'unplaced', rack },
  });

  const statusStyle = getRackStatusStyle(rack.stockStatus);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: transform ? CSS.Translate.toString(transform) : undefined, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-2 py-2"
    >
      {editMode && (
        <button
          type="button"
          className="text-gray-400 hover:text-gray-600 cursor-grab"
          {...listeners}
          {...attributes}
          aria-label="Drag to canvas"
        >
          <GripVertical size={14} />
        </button>
      )}
      <button
        type="button"
        onClick={() => onRackClick?.(rack._id)}
        className="flex-1 text-left min-w-0"
      >
        <p className="text-xs font-mono font-semibold text-gray-800 truncate">{rack.displayPathShort}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {rack.sellableQty} sellable
          {rack.holdQty > 0 ? ` · ${rack.holdQty} hold` : ''}
        </p>
      </button>
      <span className={`shrink-0 px-1.5 py-px rounded-full text-[9px] font-semibold ${statusStyle.fill} ${statusStyle.text}`}>
        {statusStyle.label}
      </span>
    </li>
  );
}
