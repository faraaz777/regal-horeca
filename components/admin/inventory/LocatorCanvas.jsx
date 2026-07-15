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
import { Loader2, Pencil, Map as MapIcon, Layers, PackageOpen } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import {
  publishFloorLayout,
  updateFloorLayout,
  uploadFloorPlanBackground,
} from '@/lib/client/floorLayoutApi';
import { hasPermission } from '@/lib/shared/permissions';
import {
  DEFAULT_COORDINATE_HEIGHT,
  DEFAULT_COORDINATE_WIDTH,
  DEFAULT_ZONE_FILL,
  DEFAULT_ZONE_STROKE,
} from '@/lib/shared/floorLayoutConstants';
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
import { clampRackInsideZone } from '@/lib/shared/rackPlacementUtils';
import { generateZoneId, nextZoneName } from '@/lib/client/zoneUtils';
import RackUnit from '@/components/admin/inventory/RackUnit';
import UnplacedRacksTray from '@/components/admin/inventory/UnplacedRacksTray';
import LocatorSearchBar from '@/components/admin/inventory/LocatorSearchBar';
import LocatorExportButton from '@/components/admin/inventory/LocatorExportButton';
import RackDetailDrawer from '@/components/admin/inventory/RackDetailDrawer';
import FloorPlanBackground from '@/components/admin/inventory/locator/FloorPlanBackground';
import ZoneLayer from '@/components/admin/inventory/locator/ZoneLayer';
import CanvasToolbar from '@/components/admin/inventory/locator/CanvasToolbar';
import ZoneDetailDrawer from '@/components/admin/inventory/locator/ZoneDetailDrawer';
import ManageZoneRacksDialog from '@/components/admin/inventory/locator/ManageZoneRacksDialog';
import FloorPlanUploadDialog from '@/components/admin/inventory/locator/FloorPlanUploadDialog';
import CanvasLayersPanel from '@/components/admin/inventory/locator/CanvasLayersPanel';

const fetcher = (url) => adminJson(url);
const HISTORY_LIMIT = 50;

function CanvasDropZone({ children, editMode, activeTool }) {
  const { setNodeRef } = useDroppable({ id: 'floor-canvas' });
  return (
    <div
      ref={setNodeRef}
      className={`absolute inset-0 pointer-events-none ${editMode && activeTool === 'createZone' ? 'cursor-crosshair' : ''}`}
      data-locator-canvas
    >
      {children}
    </div>
  );
}

function defaultLayoutMeta() {
  return {
    backgroundImage: {
      url: null,
      opacity: 1,
      visible: true,
      locked: true,
    },
    canvas: {
      coordinateWidth: DEFAULT_COORDINATE_WIDTH,
      coordinateHeight: DEFAULT_COORDINATE_HEIGHT,
      gridEnabled: true,
      gridSize: 20,
      snapEnabled: true,
      guidesEnabled: true,
      rackPlacementRule: 'allow_unzoned',
    },
    zones: [],
    version: 1,
    status: 'draft',
  };
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
  const [activeTool, setActiveTool] = useState('select');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [highlightIds, setHighlightIds] = useState(new Set());
  const [highlightZoneIds, setHighlightZoneIds] = useState(new Set());
  const [drawerRackId, setDrawerRackId] = useState(null);
  const [localRacks, setLocalRacks] = useState([]);
  const [localUnplaced, setLocalUnplaced] = useState([]);
  const [localLayout, setLocalLayout] = useState(defaultLayoutMeta);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [saving, setSaving] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [drawerZoneId, setDrawerZoneId] = useState(null);
  const [manageRacksOpen, setManageRacksOpen] = useState(false);
  const [isDraggingRack, setIsDraggingRack] = useState(false);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [marquee, setMarquee] = useState(null);
  const [zoneDraft, setZoneDraft] = useState(null);
  const [isPanning, setIsPanning] = useState(false);

  const marqueeStart = useRef(null);
  const panStart = useRef(null);
  const panMoved = useRef(false);
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const dragOffsets = useRef(new Map());
  const historyPast = useRef([]);
  const historyFuture = useRef([]);
  // Refs alone don't re-render — tick bumps so Undo/Redo enabled state updates
  const [historyTick, setHistoryTick] = useState(0);
  const autosaveTimer = useRef(null);

  const layoutUrl = floorId ? `/api/admin/inventory/locations/${floorId}/layout` : null;
  const { data: layout, isLoading, mutate } = useSWR(layoutUrl, fetcher, {
    revalidateOnFocus: false,
  });

  const coordinateWidth = localLayout?.canvas?.coordinateWidth ?? DEFAULT_COORDINATE_WIDTH;
  const coordinateHeight = localLayout?.canvas?.coordinateHeight ?? DEFAULT_COORDINATE_HEIGHT;
  const gridSize = localLayout?.canvas?.gridSize ?? 20;
  const gridEnabled = localLayout?.canvas?.gridEnabled !== false;
  const rackPlacementRule = localLayout?.canvas?.rackPlacementRule ?? 'allow_unzoned';

  const pushHistory = useCallback(() => {
    historyPast.current.push({
      racks: JSON.parse(JSON.stringify(localRacks)),
      unplaced: JSON.parse(JSON.stringify(localUnplaced)),
      layout: JSON.parse(JSON.stringify(localLayout)),
    });
    if (historyPast.current.length > HISTORY_LIMIT) historyPast.current.shift();
    historyFuture.current = [];
    setHistoryTick((t) => t + 1);
  }, [localLayout, localRacks, localUnplaced]);

  const clearHistory = useCallback(() => {
    historyPast.current = [];
    historyFuture.current = [];
    setHistoryTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCascade(true);
      try {
        const res = await fetchCascadeBranches();
        const branchList = res?.branches || [];
        if (cancelled) return;
        setBranches(branchList);
        if (branchList.length && !branchId) setBranchId(branchList[0]._id);
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
      setLocalLayout(layout.layout || defaultLayoutMeta());
      setSelectedIds(new Set());
      setSelectedZoneId(null);
      setDrawerZoneId(null);
      setHighlightIds(new Set());
      setHighlightZoneIds(new Set());
      setSaveStatus('saved');
    }
  }, [layout]);

  // Only reset undo stack when switching floors — not after every save/mutate
  useEffect(() => {
    clearHistory();
  }, [floorId, clearHistory]);

  const fitToCanvas = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const scale = Math.min(rect.width / coordinateWidth, rect.height / coordinateHeight) * 0.92;
    setZoom(scale);
    setPan({
      x: (rect.width - coordinateWidth * scale) / 2,
      y: (rect.height - coordinateHeight * scale) / 2,
    });
  }, [coordinateWidth, coordinateHeight]);

  useEffect(() => {
    if (layout?.layout?.backgroundImage?.url) fitToCanvas();
  }, [layout?.layout?.backgroundImage?.url, floorId, fitToCanvas]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.001);
        setZoom((prevZoom) => {
          const newZoom = Math.min(2, Math.max(0.25, prevZoom * factor));
          setPan((prevPan) => ({
            x: mouseX - ((mouseX - prevPan.x) / prevZoom) * newZoom,
            y: mouseY - ((mouseY - prevPan.y) / prevZoom) * newZoom,
          }));
          return newZoom;
        });
        return;
      }

      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [floorId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const allRacksOnFloor = useMemo(
    () => [...localRacks, ...localUnplaced],
    [localRacks, localUnplaced]
  );

  const maxTotalQty = layout?.maxTotalQty ?? 1;

  const drawerZone = useMemo(
    () => localLayout.zones?.find((z) => z.id === drawerZoneId) || null,
    [localLayout.zones, drawerZoneId]
  );

  const selectedZone = useMemo(
    () => localLayout.zones?.find((z) => z.id === selectedZoneId) || null,
    [localLayout.zones, selectedZoneId]
  );

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

  const scheduleAutosave = useCallback(() => {
    setSaveStatus('unsaved');
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      // manual save preferred; autosave hook point
    }, 1500);
  }, []);

  const persistLayout = useCallback(
    async (nextLayout = localLayout) => {
      if (!floorId) return;
      setSaving(true);
      setSaveStatus('saving');
      try {
        const res = await updateFloorLayout(floorId, {
          expectedVersion: nextLayout.version ?? layout?.layout?.version ?? 1,
          canvas: nextLayout.canvas,
          backgroundImage: {
            opacity: nextLayout.backgroundImage?.opacity,
            visible: nextLayout.backgroundImage?.visible,
            locked: nextLayout.backgroundImage?.locked,
          },
          zones: nextLayout.zones,
        });
        setLocalLayout(res.layout || nextLayout);
        setSaveStatus('saved');
        await mutate();
        toast.success('Layout saved');
      } catch (err) {
        if (err.status === 409) {
          toast.error('Layout was updated elsewhere — reload to continue');
          setSaveStatus('conflict');
        } else {
          toast.error(err.message || 'Failed to save layout');
          setSaveStatus('failed');
        }
      } finally {
        setSaving(false);
      }
    },
    [floorId, layout?.layout?.version, localLayout, mutate]
  );

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
              zoneId: u.zoneId ?? null,
              rotation: u.rotation,
            })),
          }),
        });
        await mutate();
      } catch (err) {
        toast.error(err.message || 'Failed to save rack positions');
        await mutate();
      } finally {
        setSaving(false);
      }
    },
    [mutate]
  );

  const applyZoneUpdate = useCallback(
    (updatedZone, { recordHistory = false } = {}) => {
      if (recordHistory) pushHistory();
      setLocalLayout((prev) => ({
        ...prev,
        zones: prev.zones.map((z) => (z.id === updatedZone.id ? updatedZone : z)),
      }));
      scheduleAutosave();
    },
    [pushHistory, scheduleAutosave]
  );

  const handleZoneChangeEnd = useCallback(
    async (updatedZone) => {
      const nextLayout = {
        ...localLayout,
        zones: localLayout.zones.map((z) => (z.id === updatedZone.id ? updatedZone : z)),
      };
      setLocalLayout(nextLayout);
      await persistLayout(nextLayout);
    },
    [localLayout, persistLayout]
  );

  // Snapshot before zone drag/resize starts (live onChange already mutates localLayout)
  const handleZoneInteractionStart = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const handleCreateZoneComplete = useCallback(
    async (rect) => {
      if (rect.width < 20 || rect.height < 20) return;
      pushHistory();
      const zone = {
        id: generateZoneId(),
        name: nextZoneName(localLayout.zones),
        code: '',
        description: '',
        ...rect,
        rotation: 0,
        fill: DEFAULT_ZONE_FILL,
        stroke: DEFAULT_ZONE_STROKE,
        opacity: 1,
        locked: false,
        hidden: false,
        zIndex: (localLayout.zones?.length || 0) + 1,
      };
      const nextLayout = {
        ...localLayout,
        zones: [...(localLayout.zones || []), zone],
      };
      setLocalLayout(nextLayout);
      setSelectedZoneId(zone.id);
      setSelectedIds(new Set());
      await persistLayout(nextLayout);
    },
    [localLayout, persistLayout, pushHistory]
  );

  const handleDeleteZone = useCallback(
    async (zone) => {
      const racksInZone = localRacks.filter((r) => r.position?.zoneId === zone.id);
      if (racksInZone.length) {
        const action = window.confirm(
          `This zone contains ${racksInZone.length} rack(s).\n\nOK = keep racks on canvas without zone\nCancel = abort`
        );
        if (!action) return;
        pushHistory();
        const cleared = localRacks.map((r) =>
          r.position?.zoneId === zone.id
            ? { ...r, position: { ...r.position, zoneId: null } }
            : r
        );
        setLocalRacks(cleared);
        await persistPositions(
          racksInZone.map((r) => ({
            _id: r._id,
            x: r.position.x,
            y: r.position.y,
            width: r.position.width,
            height: r.position.height,
            zoneId: null,
          }))
        );
      } else {
        pushHistory();
      }

      const nextLayout = {
        ...localLayout,
        zones: localLayout.zones.filter((z) => z.id !== zone.id),
      };
      setLocalLayout(nextLayout);
      setSelectedZoneId(null);
      setDrawerZoneId(null);
      await persistLayout(nextLayout);
    },
    [localLayout, localRacks, persistLayout, persistPositions, pushHistory]
  );

  const resolveDropPosition = useCallback(
    (rack, rawX, rawY, rawWidth, rawHeight) => {
      const zoneId = rack.position?.zoneId;
      if (!zoneId) return null;
      const zone = localLayout.zones?.find((z) => z.id === zoneId);
      if (!zone) return null;
      return clampRackInsideZone(
        { x: rawX, y: rawY, width: rawWidth, height: rawHeight, zoneId },
        zone,
        rawWidth,
        rawHeight
      );
    },
    [localLayout.zones]
  );

  const handleSelectZone = useCallback(
    (zoneId) => {
      setSelectedZoneId(zoneId);
      if (editMode) {
        setDrawerZoneId(null);
      } else {
        setDrawerZoneId(zoneId);
      }
      setDrawerRackId(null);
      setSelectedIds(new Set());
    },
    [editMode]
  );

  const handleRackSelect = useCallback(
    (rackId, event) => {
      setSelectedZoneId(null);
      setDrawerZoneId(null);
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
    },
    [editMode]
  );

  const handleManageRacks = useCallback((zoneId) => {
    setSelectedZoneId(zoneId);
    setSelectedIds(new Set());
    setManageRacksOpen(true);
  }, []);

  const handleDragStart = useCallback(
    (event) => {
      if (activeTool === 'pan') return;
      const { active } = event;
      const data = active.data.current;
      if (data?.type === 'unplaced') return;

      setIsDraggingRack(true);
      const rackId = data?.rack?._id;
      if (!rackId) return;

      const idsToMove =
        selectedIds.has(rackId) && selectedIds.size > 1 ? [...selectedIds] : [rackId];

      const offsets = new Map();
      for (const id of idsToMove) {
        const rack = localRacks.find((r) => r._id === id);
        if (rack?.position) offsets.set(id, { x: rack.position.x, y: rack.position.y });
      }
      dragOffsets.current = offsets;

      if (!selectedIds.has(rackId)) setSelectedIds(new Set([rackId]));
    },
    [activeTool, localRacks, selectedIds]
  );

  const handleDragEnd = useCallback(
    async (event) => {
      setIsDraggingRack(false);
      const { active, delta } = event;
      const data = active.data.current;
      if (!data?.rack || !editMode || activeTool === 'pan' || data.type === 'unplaced') return;

      const rackId = data.rack._id;

      const idsToMove =
        selectedIds.has(rackId) && selectedIds.size > 1 ? [...selectedIds] : [rackId];

      const updates = [];
      const nextRacks = [...localRacks];

      for (const id of idsToMove) {
        const idx = nextRacks.findIndex((r) => r._id === id);
        if (idx < 0) continue;
        const rack = nextRacks[idx];
        if (!rack.position?.zoneId) continue;

        const base = dragOffsets.current.get(id) || rack.position;
        const rawX = Math.max(0, base.x + delta.x / zoom);
        const rawY = Math.max(0, base.y + delta.y / zoom);
        const width = rack.position.width ?? DEFAULT_RACK_WIDTH;
        const height = rack.position.height ?? DEFAULT_RACK_HEIGHT;

        const pos = resolveDropPosition(rack, rawX, rawY, width, height);
        if (!pos) {
          toast.error('Rack must stay inside its assigned zone');
          await mutate();
          return;
        }

        const newPos = { ...rack.position, ...pos, zoneId: rack.position.zoneId };
        nextRacks[idx] = { ...rack, position: newPos };
        updates.push({ _id: id, ...newPos });
      }

      if (!updates.length) return;

      pushHistory();
      setLocalRacks(nextRacks);
      await persistPositions(updates);
    },
    [
      activeTool,
      editMode,
      localRacks,
      mutate,
      persistPositions,
      pushHistory,
      resolveDropPosition,
      selectedIds,
      zoom,
    ]
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
        const zoneIds = new Set(
          localRacks.filter((r) => ids.includes(r._id)).map((r) => r.position?.zoneId).filter(Boolean)
        );
        setHighlightZoneIds(zoneIds);
        toast.success(`Located: ${product.title}`);
        setTimeout(() => {
          setHighlightIds(new Set());
          setHighlightZoneIds(new Set());
        }, 4000);
      } catch (err) {
        toast.error(err.message || 'Could not locate product');
      }
    },
    [localRacks, localUnplaced]
  );

  const onViewportMouseDown = (e) => {
    const onInteractive = e.target.closest('.rack-unit') || e.target.closest('.zone-unit');

    if (e.button === 1) {
      e.preventDefault();
      panMoved.current = false;
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }

    if (e.button !== 0) return;

    const pt = clientToCanvas(e.clientX, e.clientY);

    if (editMode && activeTool === 'pan') {
      panMoved.current = false;
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }

    if (onInteractive) return;

    if (!editMode) {
      panMoved.current = false;
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }

    if (editMode && activeTool === 'createZone') {
      marqueeStart.current = pt;
      setZoneDraft({ x: pt.x, y: pt.y, width: 0, height: 0 });
      return;
    }

    if (editMode && activeTool === 'select') {
      setSelectedZoneId(null);
      setDrawerZoneId(null);
      marqueeStart.current = pt;
      setMarquee({ x: pt.x, y: pt.y, width: 0, height: 0 });
      return;
    }
  };

  const onViewportMouseMove = (e) => {
    if (panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) panMoved.current = true;
      setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
      return;
    }

    if (!marqueeStart.current) return;
    const pt = clientToCanvas(e.clientX, e.clientY);
    const start = marqueeStart.current;

    if (zoneDraft !== null) {
      setZoneDraft({
        x: Math.min(start.x, pt.x),
        y: Math.min(start.y, pt.y),
        width: Math.abs(pt.x - start.x),
        height: Math.abs(pt.y - start.y),
      });
      return;
    }

    setMarquee({
      x: Math.min(start.x, pt.x),
      y: Math.min(start.y, pt.y),
      width: Math.abs(pt.x - start.x),
      height: Math.abs(pt.y - start.y),
    });
  };

  const onViewportMouseUp = async () => {
    if (panStart.current) {
      const moved = panMoved.current;
      panStart.current = null;
      panMoved.current = false;
      setIsPanning(false);
      if (!moved && !editMode) {
        setSelectedZoneId(null);
        setDrawerZoneId(null);
      }
      return;
    }

    if (zoneDraft && zoneDraft.width > 8 && zoneDraft.height > 8) {
      await handleCreateZoneComplete(zoneDraft);
    }
    setZoneDraft(null);

    if (marquee && marquee.width > 4 && marquee.height > 4) {
      const hits = localRacks.filter((r) => racksIntersectMarquee(r, marquee));
      setSelectedIds(new Set(hits.map((r) => r._id)));
    }
    marqueeStart.current = null;
    setMarquee(null);
  };

  const viewportCursorClass = isPanning
    ? 'cursor-grabbing'
    : !editMode || activeTool === 'pan'
      ? 'cursor-grab'
      : activeTool === 'createZone'
        ? 'cursor-crosshair'
        : '';

  const handleUndo = useCallback(() => {
    const prev = historyPast.current.pop();
    if (!prev) return;
    historyFuture.current.push({
      racks: JSON.parse(JSON.stringify(localRacks)),
      unplaced: JSON.parse(JSON.stringify(localUnplaced)),
      layout: JSON.parse(JSON.stringify(localLayout)),
    });
    setLocalRacks(prev.racks);
    setLocalUnplaced(prev.unplaced);
    setLocalLayout(prev.layout);
    setHistoryTick((t) => t + 1);
    scheduleAutosave();
  }, [localLayout, localRacks, localUnplaced, scheduleAutosave]);

  const handleRedo = useCallback(() => {
    const next = historyFuture.current.pop();
    if (!next) return;
    historyPast.current.push({
      racks: JSON.parse(JSON.stringify(localRacks)),
      unplaced: JSON.parse(JSON.stringify(localUnplaced)),
      layout: JSON.parse(JSON.stringify(localLayout)),
    });
    setLocalRacks(next.racks);
    setLocalUnplaced(next.unplaced);
    setLocalLayout(next.layout);
    setHistoryTick((t) => t + 1);
    scheduleAutosave();
  }, [localLayout, localRacks, localUnplaced, scheduleAutosave]);

  const handleUpload = async (file, repositionMode) => {
    const res = await uploadFloorPlanBackground(floorId, file, repositionMode);
    if (res.layout) setLocalLayout(res.layout);
    await mutate();
    toast.success('Floor plan uploaded');
    fitToCanvas();
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
          {editMode && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
              Edit mode
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LocatorSearchBar layoutRacks={allRacksOnFloor} onLocateRacks={handleLocateRacks} />
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                if (!editMode) setDrawerZoneId(null);
                setEditMode((v) => !v);
                if (editMode) setActiveTool('select');
              }}
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
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
              {localUnplaced.length} unallocated — use Manage racks on a zone
            </span>
          )}
          <div className="inline-flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
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
          <LocatorExportButton canvasRef={canvasRef} floorLabel={floorLabel} branchLabel={branchLabel} />
        </div>
      </div>

      <CanvasToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        editMode={editMode}
        canEdit={canEdit}
        onZoomIn={() => setZoom((z) => Math.min(2, z + 0.1))}
        onZoomOut={() => setZoom((z) => Math.max(0.25, z - 0.1))}
        onFit={fitToCanvas}
        gridEnabled={gridEnabled}
        onToggleGrid={() => {
          pushHistory();
          const next = {
            ...localLayout,
            canvas: { ...localLayout.canvas, gridEnabled: !gridEnabled },
          };
          setLocalLayout(next);
          scheduleAutosave();
        }}
        onUpload={() => setUploadOpen(true)}
        onSave={() => persistLayout()}
        onPublish={async () => {
          try {
            await publishFloorLayout(floorId);
            toast.success('Layout published');
            await mutate();
          } catch (err) {
            toast.error(err.message || 'Publish failed');
          }
        }}
        saveStatus={saveStatus}
        canUndo={historyTick >= 0 && historyPast.current.length > 0}
        canRedo={historyTick >= 0 && historyFuture.current.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {heatmapMode && layout?.heatmapNote && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {layout.heatmapNote}
        </p>
      )}

      <div className="flex gap-4 flex-col xl:flex-row">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <aside className="w-full xl:w-60 shrink-0 bg-white border border-gray-200 rounded-xl p-3 shadow-sm order-2 xl:order-1">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Layers</h3>
            <CanvasLayersPanel
              backgroundImage={localLayout.backgroundImage}
              zones={localLayout.zones}
              racks={localRacks}
              unplacedRacks={localUnplaced}
              selectedZoneId={selectedZoneId}
              selectedRackIds={selectedIds}
              onSelectZone={handleSelectZone}
              onSelectRack={(id) => handleRackSelect(id, {})}
              onToggleZoneHidden={(id) => {
                const z = localLayout.zones.find((x) => x.id === id);
                if (z) applyZoneUpdate({ ...z, hidden: !z.hidden }, { recordHistory: true });
              }}
              onToggleZoneLocked={(id) => {
                const z = localLayout.zones.find((x) => x.id === id);
                if (z) applyZoneUpdate({ ...z, locked: !z.locked }, { recordHistory: true });
              }}
            />
            <div className="border-t border-gray-100 my-3" />
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              Unplaced racks
              {localUnplaced.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  {localUnplaced.length}
                </span>
              )}
            </h3>
            <UnplacedRacksTray racks={localUnplaced} onRackClick={(id) => setDrawerRackId(id)} />
          </aside>

          <div className="flex-1 min-w-0 order-1 xl:order-2">
            <div
              ref={viewportRef}
              className={`relative h-[520px] bg-slate-100 border border-gray-200 rounded-xl overflow-hidden overscroll-contain ${viewportCursorClass}`}
              onMouseDown={onViewportMouseDown}
              onMouseMove={onViewportMouseMove}
              onMouseUp={onViewportMouseUp}
              onMouseLeave={onViewportMouseUp}
            >
              {(isLoading || saving) && (
                <div className="absolute inset-0 z-50 bg-white/50 flex items-center justify-center">
                  <Loader2 className="animate-spin text-emerald-600" size={28} />
                </div>
              )}

              <div
                ref={canvasRef}
                className="absolute origin-top-left bg-white"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  width: coordinateWidth,
                  height: coordinateHeight,
                }}
              >
                <FloorPlanBackground
                  backgroundImage={localLayout.backgroundImage}
                  coordinateWidth={coordinateWidth}
                  coordinateHeight={coordinateHeight}
                />

                {gridEnabled && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage:
                        'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
                      backgroundSize: `${gridSize}px ${gridSize}px`,
                    }}
                  />
                )}

                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-3 py-2 rounded-lg border border-gray-200 text-xs shadow-sm z-40">
                  <p className="font-semibold text-gray-900 flex items-center gap-1">
                    <MapIcon size={12} /> {branchLabel} › {floorLabel}
                  </p>
                  <p className="text-gray-500 mt-0.5">
                    {localRacks.length} placed · {localUnplaced.length} unplaced ·{' '}
                    {localLayout.zones?.length || 0} zones
                  </p>
                </div>

                <ZoneLayer
                  zones={localLayout.zones}
                  selectedZoneId={selectedZoneId}
                  editMode={editMode}
                  activeTool={activeTool}
                  heatmapMode={heatmapMode}
                  highlightZoneIds={highlightZoneIds}
                  zoom={zoom}
                  suppressHover={isDraggingRack || manageRacksOpen || isPanning}
                  onSelectZone={handleSelectZone}
                  onZoneInteractionStart={handleZoneInteractionStart}
                  onZoneChange={(z) => applyZoneUpdate(z)}
                  onZoneChangeEnd={handleZoneChangeEnd}
                />

                <CanvasDropZone editMode={editMode} activeTool={activeTool}>
                  {localRacks.map((rack) => {
                    const rackZoneId = rack.position?.zoneId;
                    // Zone-assigned racks are represented by the rack count on
                    // the zone. Do not overlay individual rack boxes on it.
                    if (rackZoneId) return null;

                    return (
                      <RackUnit
                        key={rack._id}
                        rack={rack}
                        selected={selectedIds.has(rack._id)}
                        editMode={editMode && activeTool === 'select'}
                        heatmapMode={heatmapMode}
                        maxTotalQty={maxTotalQty}
                        highlighted={highlightIds.has(rack._id)}
                        onSelect={handleRackSelect}
                      />
                    );
                  })}
                </CanvasDropZone>

                {!localLayout.backgroundImage?.url && !localLayout.zones?.length && !isLoading && (
                  <div className="absolute top-24 left-1/2 -translate-x-1/2 text-center pointer-events-none z-30">
                    <PackageOpen className="mx-auto text-gray-400 mb-2" size={36} />
                    <p className="text-sm font-medium text-gray-600">No floor plan uploaded</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-xs">
                      Upload an image or continue with the blank canvas. Use Create zone to map sections.
                    </p>
                  </div>
                )}

                {zoneDraft && (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none z-20"
                    style={{
                      left: zoneDraft.x,
                      top: zoneDraft.y,
                      width: zoneDraft.width,
                      height: zoneDraft.height,
                    }}
                  />
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
            </div>
          </div>
        </DndContext>
      </div>

      <ManageZoneRacksDialog
        open={manageRacksOpen}
        onClose={() => setManageRacksOpen(false)}
        floorId={floorId}
        zone={drawerZone || selectedZone}
        layoutVersion={localLayout.version ?? layout?.layout?.version ?? 1}
        floorLabel={floorLabel}
        // Rack assign/move/remove is inventory ops — not tied to layout edit mode
        canEdit={canEdit}
        onUpdated={() => mutate()}
      />

      <FloorPlanUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={handleUpload}
        hasExisting={!!localLayout.backgroundImage?.url}
      />

      {drawerZoneId && drawerZone && (
        <ZoneDetailDrawer
          zone={drawerZone}
          floorLabel={floorLabel}
          branchLabel={branchLabel}
          racks={localRacks}
          canEdit={canEdit}
          editMode={editMode}
          saving={saving}
          onClose={() => {
            setDrawerZoneId(null);
            setSelectedZoneId(null);
          }}
          onManageRacks={handleManageRacks}
          onOpenRack={(rackId) => {
            setDrawerZoneId(null);
            setSelectedZoneId(null);
            setDrawerRackId(rackId);
          }}
          onChange={(z) => applyZoneUpdate(z)}
          onDelete={handleDeleteZone}
          onSave={() => handleZoneChangeEnd(drawerZone)}
        />
      )}

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
