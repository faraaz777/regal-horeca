'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import {
  ChevronRight,
  ChevronDown,
  Search,
  MapPin,
  Package,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  GripVertical,
} from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { canWriteInventory } from '@/lib/shared/permissions';
import { LOCATION_PATH_SEP } from '@/lib/shared/inventoryConstants';
import { useDebounce } from '@/hooks/useDebounce';
import {
  applyBranchOrder,
  loadBranchOrder,
  moveBranchId,
  saveBranchOrder,
} from '@/lib/client/branchOrderPreference';

const fetcher = (url) => adminJson(url);

/**
 * Locations admin — Branch → Floor → Rack grid.
 * Click selects (products on the right). Pencil opens edit (code + name prefilled).
 * Branch + / rack + auto-create via API. Delete rules unchanged (children / stock / hard delete).
 *
 * Search finds products across warehouses, expands ancestors, and highlights the best rack.
 * Branch tile order is a personal preference (localStorage), not shared.
 */

function findNodeInTree(nodes, id) {
  const target = String(id);
  for (const node of nodes || []) {
    if (String(node._id) === target) return node;
    const found = findNodeInTree(node.children, target);
    if (found) return found;
  }
  return null;
}

function EditLocationModal({ form, setForm, onClose, onSubmit, submitting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Edit location</h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Code
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              autoFocus
            />
          </div>
          <p className="text-[11px] text-gray-400 capitalize">Level: {form.level}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !form.name.trim()}
            onClick={onSubmit}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function RackTile({ rack, selected, matched, onSelect, onEdit, canManage }) {
  const hasStock = (rack.itemCount || 0) > 0;
  let tileClass =
    'border-gray-200 bg-gray-50/80 text-gray-500 hover:border-gray-300 hover:bg-white hover:text-gray-700';
  if (hasStock) {
    tileClass =
      'border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50';
  }
  if (matched && !selected) {
    tileClass =
      'border-emerald-300 bg-emerald-50/60 text-gray-900 hover:border-emerald-400';
  }
  if (selected) {
    tileClass = 'border-emerald-600 bg-emerald-50 text-gray-900 ring-1 ring-emerald-500/40';
  }

  return (
    <div className={`relative group rounded-md border text-left transition-colors ${tileClass}`}>
      <button
        type="button"
        onClick={() => onSelect(rack)}
        className="w-full px-1.5 py-1.5 min-w-[3.25rem] max-w-[4.75rem]"
        title={`${rack.code}${rack.name ? ` · ${rack.name}` : ''}${
          hasStock ? ` · ${rack.itemCount} products` : ' · Empty'
        }`}
      >
        <p
          className={`text-[10px] font-bold font-mono leading-none truncate ${
            hasStock || selected || matched ? 'text-gray-900' : 'text-gray-400'
          }`}
        >
          {rack.code}
        </p>
        <p
          className={`text-[9px] mt-0.5 truncate leading-tight ${
            hasStock || selected || matched ? 'text-gray-500' : 'text-gray-400'
          }`}
        >
          {rack.name || rack.code}
        </p>
        <p
          className={`text-[9px] mt-0.5 leading-none tabular-nums ${
            hasStock ? 'text-gray-600 font-medium' : 'text-gray-300'
          }`}
        >
          {hasStock ? rack.itemCount : '—'}
        </p>
      </button>
      {canManage && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(rack);
          }}
          className="absolute top-0 right-0 p-0.5 rounded text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-white hover:text-emerald-700 transition-opacity"
          title="Edit rack"
        >
          <Pencil size={10} />
        </button>
      )}
    </div>
  );
}

function FloorBlock({
  floor,
  selectedId,
  matchIds,
  expanded,
  onSelect,
  onToggle,
  onEdit,
  onAddRack,
  canManage,
  busyId,
}) {
  const id = String(floor._id);
  const isExpanded = expanded.has(id);
  const isSelected = selectedId === id;
  const isMatched = matchIds?.has(id);
  const racks = (floor.children || []).filter((c) => c.level === 'rack');

  return (
    <div
      className={`rounded-md border overflow-hidden ${
        isSelected
          ? 'border-emerald-400 bg-emerald-50/40'
          : isMatched
            ? 'border-emerald-200 bg-emerald-50/20'
            : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          type="button"
          onClick={() => onToggle(id)}
          className="shrink-0 text-gray-400 hover:text-gray-600 p-0.5"
          aria-label={isExpanded ? 'Collapse floor' : 'Expand floor'}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-amber-500 text-white text-[9px] font-bold">
          F
        </div>
        <button type="button" onClick={() => onSelect(floor)} className="min-w-0 flex-1 text-left">
          <span className="text-xs font-semibold text-gray-900 truncate block leading-tight">
            {floor.name || floor.code}
            {floor.name && floor.code && floor.name !== floor.code ? (
              <span className="font-normal text-gray-400 font-mono"> ({floor.code})</span>
            ) : null}
          </span>
        </button>
        <span className="text-[9px] text-gray-500 font-medium shrink-0 tabular-nums">
          {racks.length}r
        </span>
        {canManage && (
          <button
            type="button"
            onClick={() => onEdit(floor)}
            className="p-1 rounded text-gray-400 hover:bg-gray-100 hover:text-emerald-700"
            title="Edit floor"
          >
            <Pencil size={12} />
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="px-2 pb-2 pt-1 border-t border-gray-100">
          <div className="flex flex-wrap gap-1">
            {racks.map((rack) => (
              <RackTile
                key={rack._id}
                rack={rack}
                selected={selectedId === String(rack._id)}
                matched={matchIds?.has(String(rack._id))}
                onSelect={onSelect}
                onEdit={onEdit}
                canManage={canManage}
              />
            ))}
            {canManage && (
              <button
                type="button"
                disabled={busyId === `rack-${id}`}
                onClick={() => onAddRack(floor)}
                className="min-w-[2.75rem] min-h-[2.75rem] rounded-md border border-dashed border-gray-300 text-gray-400 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 flex items-center justify-center disabled:opacity-50"
                title="Add rack"
              >
                {busyId === `rack-${id}` ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BranchCard({
  branch,
  selectedId,
  matchIds,
  expanded,
  onSelect,
  onToggle,
  onEdit,
  onAddFloor,
  onAddRack,
  canManage,
  busyId,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}) {
  const id = String(branch._id);
  const isExpanded = expanded.has(id);
  const floors = (branch.children || []).filter((c) => c.level === 'floor');

  return (
    <div
      className={`group/branch rounded-lg border bg-white shadow-sm transition-opacity ${
        isDragging ? 'opacity-50 border-emerald-300' : 'border-gray-200'
      } ${isDragOver ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}`}
      onDragOver={(e) => onDragOver?.(e, id)}
      onDragLeave={() => onDragLeave?.(id)}
      onDrop={(e) => onDrop?.(e, id)}
    >
      <div
        className={`sticky top-0 z-10 flex items-center gap-1 px-1.5 py-1.5 bg-gray-50 border-b border-gray-100 ${
          isExpanded ? 'rounded-t-lg' : 'rounded-lg border-b-0'
        }`}
      >
        <div
          role="button"
          tabIndex={0}
          draggable
          onDragStart={(e) => onDragStart?.(e, id)}
          onDragEnd={() => onDragEnd?.()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
          }}
          className="shrink-0 p-0.5 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none select-none opacity-40 group-hover/branch:opacity-100 focus:opacity-100 transition-opacity"
          title="Drag to reorder (saved on this device)"
          aria-label="Drag to reorder branch"
        >
          <GripVertical size={14} />
        </div>
        <button
          type="button"
          onClick={() => onToggle(id)}
          className="shrink-0 text-gray-400 hover:text-gray-600 p-0.5"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-800 text-white text-[9px] font-bold">
          B
        </div>
        <button type="button" onClick={() => onSelect(branch)} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-bold text-gray-900 truncate leading-tight">
              {branch.name || branch.code}
            </span>
            <span className="inline-flex shrink-0 px-1 py-px rounded text-[9px] font-mono font-semibold bg-gray-200 text-gray-600">
              {branch.code}
            </span>
          </span>
        </button>
        <span className="text-[10px] text-gray-500 shrink-0 tabular-nums">
          {floors.length}f
        </span>
        {canManage && (
          <>
            <button
              type="button"
              onClick={() => onEdit(branch)}
              className="p-1 rounded text-gray-400 hover:bg-white hover:text-emerald-700"
              title="Edit branch"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              disabled={busyId === `floor-${id}`}
              onClick={() => onAddFloor(branch)}
              className="p-1 rounded text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
              title="Add floor"
            >
              {busyId === `floor-${id}` ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Plus size={12} />
              )}
            </button>
          </>
        )}
      </div>

      {isExpanded && (
        <div className="p-1.5 space-y-1">
          {floors.length === 0 ? (
            <p className="text-[10px] text-gray-400 px-1 py-1">
              No floors yet.{canManage ? ' Click + to add Floor 1.' : ''}
            </p>
          ) : (
            floors.map((floor) => (
              <FloorBlock
                key={floor._id}
                floor={floor}
                selectedId={selectedId}
                matchIds={matchIds}
                expanded={expanded}
                onSelect={onSelect}
                onToggle={onToggle}
                onEdit={onEdit}
                onAddRack={onAddRack}
                canManage={canManage}
                busyId={busyId}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function InventoryLocationsPage() {
  const { data: meData } = useSWR('/api/auth/me', fetcher);
  const canManage = canWriteInventory(meData?.user?.role);

  const [selectedId, setSelectedId] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [itemSearch, setItemSearch] = useState('');
  const [editForm, setEditForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const lastAppliedSearchRef = useRef('');
  const [branchOrder, setBranchOrder] = useState([]);
  const [draggingBranchId, setDraggingBranchId] = useState(null);
  const [dragOverBranchId, setDragOverBranchId] = useState(null);

  const debouncedSearch = useDebounce(itemSearch, 300);
  const searchQuery = debouncedSearch.trim();
  const isSearching = searchQuery.length >= 2;

  const { data: treeData, isLoading: treeLoading, mutate: mutateTree } = useSWR(
    '/api/admin/inventory/locations/tree',
    fetcher,
    { revalidateOnFocus: false }
  );

  const searchUrl = isSearching
    ? `/api/admin/inventory/locations/search?q=${encodeURIComponent(searchQuery)}`
    : null;
  const { data: searchData, isLoading: searchLoading } = useSWR(searchUrl, fetcher, {
    revalidateOnFocus: false,
  });

  const itemsUrl = selectedId ? `/api/admin/inventory/locations/${selectedId}/items` : null;
  const { data: itemsData, isLoading: itemsLoading, mutate: mutateItems } = useSWR(
    itemsUrl,
    fetcher,
    { revalidateOnFocus: false }
  );

  const tree = treeData?.tree || [];

  /**
   * Sync personal branch order when the tree loads or gains/loses branches.
   * New branches append by code; removed IDs are dropped from storage.
   */
  useEffect(() => {
    const branches = treeData?.tree;
    if (!branches?.length) {
      setBranchOrder((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const ordered = applyBranchOrder(branches, loadBranchOrder());
    const ids = ordered.map((b) => String(b._id));
    setBranchOrder((prev) => {
      if (prev.length === ids.length && prev.every((id, i) => id === ids[i])) return prev;
      return ids;
    });
    saveBranchOrder(ids);
  }, [treeData?.tree]);

  const orderedBranches = useMemo(
    () => applyBranchOrder(tree, branchOrder),
    [tree, branchOrder]
  );

  const handleBranchDragStart = useCallback((e, id) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingBranchId(id);
  }, []);

  const handleBranchDragOver = useCallback((e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverBranchId(id);
  }, []);

  const handleBranchDragLeave = useCallback((id) => {
    setDragOverBranchId((prev) => (prev === id ? null : prev));
  }, []);

  const handleBranchDrop = useCallback(
    (e, overId) => {
      e.preventDefault();
      const activeId = e.dataTransfer.getData('text/plain') || draggingBranchId;
      setDraggingBranchId(null);
      setDragOverBranchId(null);
      if (!activeId || activeId === overId) return;

      setBranchOrder((prev) => {
        const base = prev.length ? prev : tree.map((b) => String(b._id));
        const next = moveBranchId(base, activeId, overId);
        saveBranchOrder(next);
        return next;
      });
    },
    [draggingBranchId, tree]
  );

  const handleBranchDragEnd = useCallback(() => {
    setDraggingBranchId(null);
    setDragOverBranchId(null);
  }, []);

  const matchIds = useMemo(() => {
    if (!isSearching || !searchData?.hits?.length) return new Set();
    return new Set(
      (searchData.highlightIds || searchData.hits.map((h) => h.locationId)).map(String)
    );
  }, [isSearching, searchData]);

  /**
   * Expand every matching rack's ancestors; select the primary hit once per query.
   * Match highlights use matchIds (all hits), not only selectedId — so A1/mazda
   * light up every rack that holds stock even when stock lived on a legacy shelf.
   */
  useEffect(() => {
    if (!isSearching) {
      lastAppliedSearchRef.current = '';
      return;
    }
    if (!searchData || searchData.query !== searchQuery) return;

    const hits = searchData.hits || [];
    if (hits.length) {
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const hit of hits) {
          for (const id of hit.ancestorIds || []) next.add(String(id));
          next.add(String(hit.locationId));
        }
        return next;
      });
    }

    if (lastAppliedSearchRef.current === searchQuery) return;
    lastAppliedSearchRef.current = searchQuery;

    if (!searchData.primary) return;

    const { locationId, ancestorIds } = searchData.primary;
    const node =
      findNodeInTree(tree, locationId) || {
        _id: locationId,
        ...searchData.primary,
      };

    setSelectedId(String(locationId));
    setSelectedNode(node);
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of ancestorIds || []) next.add(String(id));
      next.add(String(locationId));
      return next;
    });
  }, [isSearching, searchData, searchQuery, tree]);

  const refresh = useCallback(() => {
    mutateTree();
    if (selectedId) mutateItems();
  }, [mutateTree, mutateItems, selectedId]);

  const handleSelect = useCallback((node) => {
    setSelectedId(String(node._id));
    setSelectedNode(node);
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(String(node._id));
      return next;
    });
  }, []);

  const handleToggle = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const ids = new Set();
    function walk(nodes) {
      for (const n of nodes) {
        ids.add(String(n._id));
        if (n.children?.length) walk(n.children);
      }
    }
    walk(tree);
    setExpanded(ids);
  }, [tree]);

  const createChild = useCallback(
    async (level, parentNode) => {
      if (!canManage) return;
      const key =
        level === 'branch'
          ? 'branch-root'
          : `${level}-${parentNode ? String(parentNode._id) : 'root'}`;
      setBusyId(key);
      try {
        const body = {
          level,
          parentLocationId: parentNode ? String(parentNode._id) : null,
        };
        const res = await adminJson('/api/admin/inventory/locations', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        toast.success(
          level === 'branch'
            ? 'Branch created'
            : level === 'floor'
              ? 'Floor created'
              : 'Rack created'
        );
        await mutateTree();
        if (parentNode) {
          setExpanded((prev) => {
            const next = new Set(prev);
            next.add(String(parentNode._id));
            if (level === 'rack' && parentNode.level === 'floor') {
              // keep floor expanded
            } else if (level === 'floor') {
              next.add(String(parentNode._id));
            }
            return next;
          });
        }
        if (res?.location) {
          handleSelect({
            _id: res.location._id,
            code: res.location.code,
            name: res.location.name,
            level: res.location.level,
            label: res.location.name || res.location.code,
            displayPath: res.location.displayPath,
            itemCount: 0,
            children: [],
          });
        }
      } catch (err) {
        toast.error(err.message || 'Create failed');
      } finally {
        setBusyId(null);
      }
    },
    [canManage, mutateTree, handleSelect]
  );

  const openEdit = useCallback((node) => {
    setEditForm({
      id: String(node._id),
      code: node.code || '',
      name: node.name || '',
      level: node.level,
    });
  }, []);

  const handleSaveEdit = async () => {
    if (!editForm) return;
    setSubmitting(true);
    try {
      await adminJson(`/api/admin/inventory/locations/${editForm.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          code: editForm.code.trim(),
          name: editForm.name.trim(),
        }),
      });
      toast.success('Location updated');
      setEditForm(null);
      refresh();
      if (selectedId === editForm.id) {
        setSelectedNode((prev) =>
          prev
            ? {
                ...prev,
                code: editForm.code.trim(),
                name: editForm.name.trim(),
                label: editForm.name.trim() || editForm.code.trim(),
              }
            : prev
        );
      }
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId || !selectedNode) return;
    if (
      !window.confirm(
        `Delete "${selectedNode.displayPath || selectedNode.label || selectedNode.name}"?\n\nChildren must be deleted first. Locations with stock cannot be deleted. This cannot be undone.`
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await adminJson(`/api/admin/inventory/locations/${selectedId}`, { method: 'DELETE' });
      toast.success('Location deleted');
      setSelectedId(null);
      setSelectedNode(null);
      refresh();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = useMemo(() => {
    /**
     * Prefer search-API matches at the primary rack so the right pane shows
     * the products that caused the jump.
     * For other highlighted racks the user clicks, filter that location's items.
     */
    if (
      isSearching &&
      searchData?.primary &&
      String(searchData.primary.locationId) === String(selectedId) &&
      searchData.items?.length > 0
    ) {
      return searchData.items;
    }

    if (
      isSearching &&
      searchData?.primary &&
      String(searchData.primary.locationId) === String(selectedId)
    ) {
      const locationOnlyHit = searchData.hits?.some(
        (h) =>
          String(h.locationId) === String(selectedId) &&
          h.matchedByLocationName &&
          !h.matchCount
      );
      if (locationOnlyHit) return itemsData?.items || [];
    }

    const items = itemsData?.items || [];
    const q = itemSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.title?.toLowerCase().includes(q) ||
        it.sku?.toLowerCase().includes(q) ||
        it.fullPath?.toLowerCase().includes(q)
    );
  }, [itemsData, itemSearch, isSearching, searchData, selectedId]);

  const otherHitCount = useMemo(() => {
    if (!isSearching || !searchData?.hits?.length) return 0;
    return Math.max(0, searchData.hits.length - 1);
  }, [isSearching, searchData]);

  const rightPaneLoading =
    (isSearching && searchLoading) ||
    (Boolean(selectedId) &&
      itemsLoading &&
      !(isSearching && searchData?.items && searchData.items.length > 0));

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Locations</h1>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <MapPin size={12} />
            Branch {LOCATION_PATH_SEP} Floor {LOCATION_PATH_SEP} Rack
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canManage && (
            <button
              type="button"
              disabled={busyId === 'branch-root'}
              onClick={() => createChild('branch', null)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {busyId === 'branch-root' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Add branch
            </button>
          )}
          <div className="relative w-full sm:w-56 lg:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search product or location…"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-2 focus:ring-emerald-500/30"
            />
            {itemSearch ? (
              <button
                type="button"
                onClick={() => setItemSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[480px] xl:min-h-[560px]">
        <div className="lg:col-span-6 xl:col-span-6 2xl:col-span-5 flex flex-col gap-2 min-w-0">
          <div className="flex items-center justify-between px-0.5 gap-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Warehouse layout
            </p>
            {tree.length > 0 && (
              <button
                type="button"
                onClick={expandAll}
                className="text-[10px] text-emerald-700 hover:underline"
              >
                Expand all
              </button>
            )}
          </div>

          <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[62vh] xl:max-h-[70vh] pr-0.5">
            {treeLoading ? (
              <p className="text-xs text-gray-500 p-3 text-center">Loading…</p>
            ) : tree.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-500 bg-white rounded-lg border border-dashed border-gray-200">
                <p className="mb-2">No locations yet.</p>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => createChild('branch', null)}
                    className="text-emerald-700 font-medium hover:underline"
                  >
                    + Add your first branch
                  </button>
                )}
              </div>
            ) : (
              orderedBranches.map((branch) => (
                <BranchCard
                  key={branch._id}
                  branch={branch}
                  selectedId={selectedId}
                  matchIds={matchIds}
                  expanded={expanded}
                  onSelect={handleSelect}
                  onToggle={handleToggle}
                  onEdit={openEdit}
                  onAddFloor={(b) => createChild('floor', b)}
                  onAddRack={(f) => createChild('rack', f)}
                  canManage={canManage}
                  busyId={busyId}
                  isDragging={draggingBranchId === String(branch._id)}
                  isDragOver={dragOverBranchId === String(branch._id)}
                  onDragStart={handleBranchDragStart}
                  onDragOver={handleBranchDragOver}
                  onDragLeave={handleBranchDragLeave}
                  onDrop={handleBranchDrop}
                  onDragEnd={handleBranchDragEnd}
                />
              ))
            )}
          </div>

          {selectedNode && canManage && (
            <div className="flex gap-1.5 bg-white rounded-lg border border-gray-200 p-1.5 shadow-sm">
              <button
                type="button"
                onClick={() => openEdit(selectedNode)}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium border border-gray-200 rounded-md hover:bg-gray-50"
              >
                <Pencil size={12} /> Edit
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-6 xl:col-span-6 2xl:col-span-7 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden min-w-0">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900">Items here</h2>
              {(searchData?.primary?.displayPath || itemsData?.location?.displayPath) && (
                <p className="text-[10px] text-emerald-700 font-mono mt-0.5 truncate">
                  {String(searchData?.primary?.locationId) === String(selectedId)
                    ? searchData.primary.displayPath
                    : itemsData?.location?.displayPath}
                </p>
              )}
              {isSearching && otherHitCount > 0 && (
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Also found in {otherHitCount} other location
                  {otherHitCount === 1 ? '' : 's'}
                </p>
              )}
            </div>
            {(itemsData || (isSearching && searchData)) && (
              <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">
                {filteredItems.length}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {!selectedId && !isSearching ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
                <Package size={28} className="mb-2 opacity-40" />
                <p className="text-xs">Select a branch, floor, or rack</p>
              </div>
            ) : rightPaneLoading ? (
              <p className="text-xs text-gray-500 p-6 text-center">
                {isSearching ? 'Searching…' : 'Loading items…'}
              </p>
            ) : isSearching && !searchLoading && searchData && !searchData.primary ? (
              <p className="text-xs text-gray-500 p-6 text-center">
                No locations or stock match “{searchQuery}”
              </p>
            ) : filteredItems.length === 0 ? (
              <p className="text-xs text-gray-500 p-6 text-center">
                {isSearching
                  ? `No matching items at this location for “${searchQuery}”`
                  : 'No stock at this location'}
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-3 py-1.5">Name</th>
                    <th className="px-3 py-1.5">SKU</th>
                    <th className="px-3 py-1.5">Qty</th>
                    <th className="px-3 py-1.5 min-w-[140px]">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredItems.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50/80">
                      <td className="px-3 py-1.5 font-medium text-gray-900">{item.title}</td>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-gray-600">
                        {item.sku || '—'}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className="font-semibold">{item.qty}</span>
                        <span className="text-gray-400 text-[10px] ml-0.5">{item.stockUnit}</span>
                      </td>
                      <td className="px-3 py-1.5 text-[10px] font-mono text-gray-600">
                        {item.fullPath}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {editForm && (
        <EditLocationModal
          form={editForm}
          setForm={setEditForm}
          onClose={() => setEditForm(null)}
          onSubmit={handleSaveEdit}
          submitting={submitting}
        />
      )}

      <p className="text-xs text-gray-400">
        <Link href="/admin/inventory" className="text-emerald-700 hover:underline">
          ← Back to inventory
        </Link>
      </p>
    </div>
  );
}
