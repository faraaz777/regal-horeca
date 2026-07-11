'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { Loader2, Pencil, Map as MapIcon, Layers, LayoutGrid, PackageOpen } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { hasPermission } from '@/lib/shared/permissions';
import {
  fetchCascadeBranches,
  fetchCascadeFloors,
} from '@/lib/client/locationCascadeApi';
import {
  DEFAULT_RACK_HEIGHT,
  DEFAULT_RACK_WIDTH,
  RACK_STATUS_STYLES,
  racksIntersectMarquee,
} from '@/lib/client/locatorUtils';
import RackUnit from '@/components/admin/inventory/RackUnit';
import UnplacedRacksTray from '@/components/admin/inventory/UnplacedRacksTray';
import LocatorSearchBar from '@/components/admin/inventory/LocatorSearchBar';
import LocatorExportButton from '@/components/admin/inventory/LocatorExportButton';
import RackDetailDrawer from '@/components/admin/inventory/RackDetailDrawer';

const fetcher = (url) => adminJson(url);

function CanvasDropZone({ children, editMode }) {
  const { setNodeRef } = useDroppable({ id: 'floor-canvas' });
  return (
    <div
      ref={setNodeRef}
      className={`absolute inset-0 ${editMode ? 'cursor-crosshair' : ''}`}
      data-locator-canvas
    >
      {children}
    </div>
  );
}

export default function LocatorCanvas({ role }) {
  const canEdit = hasPermission(role, 'locations:write');

  const [branchId, setBranchId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [branches, setBranches] = useState([]);
  const [floors, setFloors] = useState([]);
  const [loadingCascade, setLoadingCascade] = useState(true);

  const [editMode, setEditMode] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [highlightIds, setHighlightIds] = useState(new Set());
  const [drawerRackId, setDrawerRackId] = useState(null);
  const [localRacks, setLocalRacks] = useState([]);
  const [localUnplaced, setLocalUnplaced] = useState([]);
  const [saving, setSaving] = useState(false);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [marquee, setMarquee] = useState(null);
  const marqueeStart = useRef(null);
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const dragOffsets = useRef(new Map());

  const layoutUrl = floorId ? `/api/admin/inventory/locations/${floorId}/layout` : null;
  const { data: layout, isLoading, mutate } = useSWR(layoutUrl, fetcher, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCascade(true);
      try {
        const res = await fetchCascadeBranches();
        const branchList = res?.branches || [];
        if (cancelled) return;
        setBranches(branchList);
        if (branchList.length && !branchId) {
          setBranchId(branchList[0]._id);
        }
      } catch (err) {
        toast.error(err.message || 'Failed to load branches');
      } finally {
        if (!cancelled) setLoadingCascade(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!branchId) {
      setFloors([]);
      setFloorId('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchCascadeFloors(branchId);
        const floorList = res?.floors || [];
        if (cancelled) return;
        setFloors(floorList);
        setFloorId((prev) => {
          if (prev && floorList.some((f) => f._id === prev)) return prev;
          return floorList[0]?._id || '';
        });
      } catch (err) {
        toast.error(err.message || 'Failed to load floors');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  useEffect(() => {
    if (layout) {
      setLocalRacks(layout.racks || []);
      setLocalUnplaced(layout.unplacedRacks || []);
      setSelectedIds(new Set());
      setHighlightIds(new Set());
    }
  }, [layout]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const allRacksOnFloor = useMemo(
    () => [...localRacks, ...localUnplaced],
    [localRacks, localUnplaced]
  );

  const maxTotalQty = layout?.maxTotalQty ?? 1;

  const clientToCanvas = useCallback(
    (clientX, clientY) => {
      const viewport = viewportRef.current;
      if (!viewport) return { x: 0, y: 0 };
      const rect = viewport.getBoundingClientRect();
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  const handleRackSelect = useCallback((rackId, event) => {
    if (editMode) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (event?.shiftKey) {
          if (next.has(rackId)) next.delete(rackId);
          else next.add(rackId);
        } else {
          next.clear();
          next.add(rackId);
        }
        return next;
      });
      return;
    }
    setDrawerRackId(rackId);
  }, [editMode]);

  const persistPositions = useCallback(
    async (updates) => {
      if (!updates.length) return;
      setSaving(true);
      try {
        await adminJson('/api/admin/inventory/locations/positions/bulk', {
          method: 'PATCH',
          body: JSON.stringify({
            positions: updates.map((u) => ({
              id: u._id,
              x: Math.round(u.x),
              y: Math.round(u.y),
              width: u.width,
              height: u.height,
            })),
          }),
        });
        await mutate();
        toast.success('Layout saved');
      } catch (err) {
        toast.error(err.message || 'Failed to save layout');
        await mutate();
      } finally {
        setSaving(false);
      }
    },
    [mutate]
  );

  const handleAutoArrange = useCallback(async () => {
    if (!localUnplaced.length) return;

    const startX = 60;
    const startY = 60;
    const gapX = DEFAULT_RACK_WIDTH + 24;
    const gapY = DEFAULT_RACK_HEIGHT + 24;
    const perRow = 6;
    const placedCount = localRacks.length;

    const newlyPlaced = localUnplaced.map((rack, i) => {
      const idx = placedCount + i;
      const col = idx % perRow;
      const row = Math.floor(idx / perRow);
      return {
        ...rack,
        position: {
          x: startX + col * gapX,
          y: startY + row * gapY,
          width: DEFAULT_RACK_WIDTH,
          height: DEFAULT_RACK_HEIGHT,
        },
      };
    });

    setLocalRacks((prev) => [...prev, ...newlyPlaced]);
    setLocalUnplaced([]);
    await persistPositions(
      newlyPlaced.map((r) => ({ _id: r._id, ...r.position }))
    );
  }, [localRacks.length, localUnplaced, persistPositions]);

  const handleDragStart = useCallback(
    (event) => {
      const { active } = event;
      const data = active.data.current;
      const rackId = data?.rack?._id;
      if (!rackId) return;

      const idsToMove =
        selectedIds.has(rackId) && selectedIds.size > 1
          ? [...selectedIds]
          : [rackId];

      const offsets = new Map();
      for (const id of idsToMove) {
        const rack = localRacks.find((r) => r._id === id);
        if (rack?.position) {
          offsets.set(id, { x: rack.position.x, y: rack.position.y });
        }
      }
      dragOffsets.current = offsets;

      if (!selectedIds.has(rackId)) {
        setSelectedIds(new Set([rackId]));
      }
    },
    [localRacks, selectedIds]
  );

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, delta, over } = event;
      const data = active.data.current;
      if (!data?.rack || !editMode) return;

      const rackId = data.rack._id;
      const isUnplaced = data.type === 'unplaced';

      if (isUnplaced && over?.id !== 'floor-canvas') return;

      const dropPoint = event.activatorEvent
        ? clientToCanvas(
            event.activatorEvent.clientX + (delta?.x || 0),
            event.activatorEvent.clientY + (delta?.y || 0)
          )
        : { x: 40, y: 40 };

      const idsToMove =
        !isUnplaced && selectedIds.has(rackId) && selectedIds.size > 1
          ? [...selectedIds]
          : [rackId];

      const updates = [];
      const nextRacks = [...localRacks];
      const nextUnplaced = [...localUnplaced];

      if (isUnplaced) {
        const placed = {
          ...data.rack,
          position: {
            x: Math.max(0, dropPoint.x - DEFAULT_RACK_WIDTH / 2),
            y: Math.max(0, dropPoint.y - DEFAULT_RACK_HEIGHT / 2),
            width: DEFAULT_RACK_WIDTH,
            height: DEFAULT_RACK_HEIGHT,
          },
        };
        nextUnplaced.splice(
          nextUnplaced.findIndex((r) => r._id === rackId),
          1
        );
        nextRacks.push(placed);
        updates.push({ _id: rackId, ...placed.position });
      } else {
        for (const id of idsToMove) {
          const idx = nextRacks.findIndex((r) => r._id === id);
          if (idx < 0) continue;
          const rack = nextRacks[idx];
          const base = dragOffsets.current.get(id) || rack.position;
          const newPos = {
            ...rack.position,
            x: Math.max(0, base.x + delta.x / zoom),
            y: Math.max(0, base.y + delta.y / zoom),
          };
          nextRacks[idx] = { ...rack, position: newPos };
          updates.push({ _id: id, ...newPos });
        }
      }

      setLocalRacks(nextRacks);
      setLocalUnplaced(nextUnplaced);
      await persistPositions(updates);
    },
    [clientToCanvas, editMode, localRacks, localUnplaced, persistPositions, selectedIds, zoom]
  );

  const handleLocateRacks = useCallback(
    async ({ rackIds, product, message }) => {
      if (message) {
        toast.error(message);
        return;
      }

      if (!product?._id) return;

      try {
        const detail = await adminJson(`/api/admin/inventory/${product._id}/stock`);
        const locations = detail.locations || [];
        const onFloor = locations.filter((loc) => {
          const rid = String(loc.rackId || loc.locationId);
          return localRacks.some((r) => r._id === rid) || localUnplaced.some((r) => r._id === rid);
        });

        if (!onFloor.length) {
          const otherFloor = locations.find((l) => l.floorId);
          if (otherFloor?.floorId) {
            toast(`Product is on another floor — switch floor to locate`, { icon: 'ℹ️' });
            setFloorId(String(otherFloor.floorId));
            return;
          }
          toast.error('Product not on this floor');
          return;
        }

        const ids = onFloor.map((l) => String(l.rackId || l.locationId));
        setHighlightIds(new Set(ids));
        toast.success(`Located: ${product.title}`);
        setTimeout(() => setHighlightIds(new Set()), 4000);
      } catch (err) {
        toast.error(err.message || 'Could not locate product');
      }
    },
    [localRacks, localUnplaced]
  );

  const onViewportMouseDown = (e) => {
    if (!editMode || e.target.closest('.rack-unit')) return;
    if (e.button !== 0) return;
    const pt = clientToCanvas(e.clientX, e.clientY);
    marqueeStart.current = pt;
    setMarquee({ x: pt.x, y: pt.y, width: 0, height: 0 });
  };

  const onViewportMouseMove = (e) => {
    if (!marqueeStart.current) return;
    const pt = clientToCanvas(e.clientX, e.clientY);
    const start = marqueeStart.current;
    setMarquee({
      x: Math.min(start.x, pt.x),
      y: Math.min(start.y, pt.y),
      width: Math.abs(pt.x - start.x),
      height: Math.abs(pt.y - start.y),
    });
  };

  const onViewportMouseUp = () => {
    if (marquee && marquee.width > 4 && marquee.height > 4) {
      const hits = localRacks.filter((r) => racksIntersectMarquee(r, marquee));
      setSelectedIds(new Set(hits.map((r) => r._id)));
    }
    marqueeStart.current = null;
    setMarquee(null);
  };

  const onWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) => Math.min(2, Math.max(0.4, z - e.deltaY * 0.001)));
    }
  };

  const floorLabel = layout?.floor?.name || layout?.floor?.code || 'Floor';
  const branchLabel = layout?.branch?.name || layout?.branch?.code || 'Branch';

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={loadingCascade}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          >
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.code} {b.name ? `— ${b.name}` : ''}
              </option>
            ))}
          </select>
          <select
            value={floorId}
            onChange={(e) => setFloorId(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          >
            {floors.map((f) => (
              <option key={f._id} value={f._id}>
                {f.code} {f.name ? `— ${f.name}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LocatorSearchBar layoutRacks={allRacksOnFloor} onLocateRacks={handleLocateRacks} />
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border ${
                editMode
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Pencil size={14} />
              {editMode ? 'Editing' : 'Edit layout'}
            </button>
          )}
          {canEdit && localUnplaced.length > 0 && (
            <button
              type="button"
              onClick={handleAutoArrange}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <LayoutGrid size={14} />
              Auto-arrange ({localUnplaced.length})
            </button>
          )}
          <div className="inline-flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
            <span className="px-2 py-2 text-gray-400 hidden sm:inline">Color:</span>
            <button
              type="button"
              onClick={() => setHeatmapMode(false)}
              className={`px-3 py-2 flex items-center gap-1.5 ${
                !heatmapMode ? 'bg-emerald-50 text-emerald-800' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Layers size={14} />
              Status
            </button>
            <button
              type="button"
              onClick={() => setHeatmapMode(true)}
              className={`px-3 py-2 flex items-center gap-1.5 border-l border-gray-200 ${
                heatmapMode ? 'bg-sky-50 text-sky-800' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Layers size={14} />
              Fill %
            </button>
          </div>
          <LocatorExportButton
            canvasRef={canvasRef}
            floorLabel={floorLabel}
            branchLabel={branchLabel}
          />
        </div>
      </div>

      {heatmapMode && layout?.heatmapNote && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {layout.heatmapNote}
        </p>
      )}

      <div className="flex gap-4 flex-col xl:flex-row">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 min-w-0">
            <div
              ref={viewportRef}
              className="relative h-[520px] bg-slate-100 border border-gray-200 rounded-xl overflow-hidden"
              onMouseDown={onViewportMouseDown}
              onMouseMove={onViewportMouseMove}
              onMouseUp={onViewportMouseUp}
              onMouseLeave={onViewportMouseUp}
              onWheel={onWheel}
            >
              {(isLoading || saving) && (
                <div className="absolute inset-0 z-50 bg-white/50 flex items-center justify-center">
                  <Loader2 className="animate-spin text-emerald-600" size={28} />
                </div>
              )}

              <div
                ref={canvasRef}
                className="absolute origin-top-left"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  width: 2400,
                  height: 1600,
                }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[size:24px_24px]" />

                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-3 py-2 rounded-lg border border-gray-200 text-xs shadow-sm">
                  <p className="font-semibold text-gray-900 flex items-center gap-1">
                    <MapIcon size={12} /> {branchLabel} › {floorLabel}
                  </p>
                  <p className="text-gray-500 mt-0.5">
                    {localRacks.length} placed · {localUnplaced.length} unplaced
                  </p>
                </div>

                <CanvasDropZone editMode={editMode}>
                  {localRacks.map((rack) => (
                    <RackUnit
                      key={rack._id}
                      rack={rack}
                      selected={selectedIds.has(rack._id)}
                      editMode={editMode}
                      heatmapMode={heatmapMode}
                      maxTotalQty={maxTotalQty}
                      highlighted={highlightIds.has(rack._id)}
                      onSelect={handleRackSelect}
                    />
                  ))}
                </CanvasDropZone>

                {!isLoading && localRacks.length === 0 && (
                  <div className="absolute top-24 left-1/2 -translate-x-1/2 text-center pointer-events-none">
                    <PackageOpen className="mx-auto text-gray-400 mb-2" size={36} />
                    <p className="text-sm font-medium text-gray-600">No racks placed on this floor yet</p>
                    {localUnplaced.length > 0 ? (
                      <p className="text-xs text-gray-500 mt-1 max-w-xs">
                        {localUnplaced.length} rack{localUnplaced.length === 1 ? '' : 's'} in the
                        “Unplaced racks” panel on the right.
                        {canEdit ? ' Click Auto-arrange or enable Edit layout and drag them here.' : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">
                        No racks exist under this floor. Add racks in Locations first.
                      </p>
                    )}
                  </div>
                )}

                {marquee && (
                  <div
                    className="absolute border-2 border-emerald-500 bg-emerald-500/10 pointer-events-none z-20"
                    style={{
                      left: marquee.x,
                      top: marquee.y,
                      width: marquee.width,
                      height: marquee.height,
                    }}
                  />
                )}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-gray-600">
              {Object.entries(RACK_STATUS_STYLES).map(([key, style]) => (
                <span key={key} className="inline-flex items-center gap-1">
                  <span className={`w-3 h-3 rounded ${style.fill} border ${style.border}`} />
                  {style.label}
                </span>
              ))}
              {editMode && (
                <span className="text-gray-400">
                  Shift+click multi-select · drag marquee on empty canvas
                </span>
              )}
            </div>
          </div>

          <aside className="w-full xl:w-72 shrink-0 bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              Unplaced racks
              {localUnplaced.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  {localUnplaced.length}
                </span>
              )}
            </h3>
            <p className="text-[10px] text-gray-400 mb-2">
              Drag onto the canvas to set first-time position.
            </p>
            <UnplacedRacksTray
              racks={localUnplaced}
              editMode={editMode}
              onRackClick={(id) => (editMode ? handleRackSelect(id, {}) : setDrawerRackId(id))}
            />
          </aside>
        </DndContext>
      </div>

      {drawerRackId && (
        <RackDetailDrawer
          rackId={drawerRackId}
          canEdit={canEdit}
          onClose={() => setDrawerRackId(null)}
          onCapacitySaved={() => mutate()}
        />
      )}
    </div>
  );
}
