'use client';

import {
  Hand,
  MousePointer2,
  SquareDashed,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3x3,
  Upload,
  Save,
  Send,
  Undo2,
  Redo2,
} from 'lucide-react';

const TOOLS = [
  { id: 'select', label: 'Select', icon: MousePointer2, key: 'V' },
  { id: 'pan', label: 'Pan', icon: Hand, key: 'H' },
  { id: 'createZone', label: 'Create zone', icon: SquareDashed, key: 'Z' },
];

export default function CanvasToolbar({
  activeTool,
  onToolChange,
  editMode,
  canEdit,
  onZoomIn,
  onZoomOut,
  onFit,
  gridEnabled,
  onToggleGrid,
  onUpload,
  onSave,
  onPublish,
  saveStatus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg shadow-sm">
      {editMode && canEdit && (
        <div className="flex items-center gap-0.5 pr-1 border-r border-gray-200 mr-1">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const active = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                title={`${tool.label} (${tool.key})`}
                onClick={() => onToolChange(tool.id)}
                className={`p-2 rounded-md ${active ? 'bg-emerald-50 text-emerald-800' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      )}

      <button type="button" title="Zoom in" onClick={onZoomIn} className="p-2 rounded-md text-gray-600 hover:bg-gray-50">
        <ZoomIn size={16} />
      </button>
      <button type="button" title="Zoom out" onClick={onZoomOut} className="p-2 rounded-md text-gray-600 hover:bg-gray-50">
        <ZoomOut size={16} />
      </button>
      <button type="button" title="Fit to floor plan" onClick={onFit} className="p-2 rounded-md text-gray-600 hover:bg-gray-50">
        <Maximize2 size={16} />
      </button>

      {editMode && canEdit && (
        <>
          <button
            type="button"
            title="Toggle grid"
            onClick={onToggleGrid}
            className={`p-2 rounded-md ${gridEnabled ? 'bg-slate-100 text-slate-800' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Grid3x3 size={16} />
          </button>
          <button type="button" title="Upload floor plan" onClick={onUpload} className="p-2 rounded-md text-gray-600 hover:bg-gray-50">
            <Upload size={16} />
          </button>
          <button
            type="button"
            title="Undo"
            disabled={!canUndo}
            onClick={onUndo}
            className="p-2 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            title="Redo"
            disabled={!canRedo}
            onClick={onRedo}
            className="p-2 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            <Redo2 size={16} />
          </button>
          <button
            type="button"
            title="Save draft"
            onClick={onSave}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Save size={14} />
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'unsaved' ? 'Save*' : 'Save'}
          </button>
          <button
            type="button"
            title="Publish layout"
            onClick={onPublish}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            <Send size={14} />
            Publish
          </button>
        </>
      )}
    </div>
  );
}
