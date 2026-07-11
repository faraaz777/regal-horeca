'use client';

import { useState, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { canWriteInventory } from '@/lib/shared/permissions';
import {
  ACTIVE_LOCATION_LEVELS,
  ACTIVE_LOCATION_CHILD,
  ACTIVE_LOCATION_PARENT,
  LOCATION_PATH_SEP,
} from '@/lib/shared/inventoryConstants';

const fetcher = (url) => adminJson(url);

const ACTIVE_LEVEL_LABELS = {
  branch: 'Branch',
  floor: 'Floor',
  rack: 'Rack',
};

const EMPTY_FORM = {
  code: '',
  name: '',
  level: 'branch',
  parentLocationId: '',
};

function TreeNode({ node, depth, selectedId, expanded, onSelect, onToggle }) {
  const id = String(node._id);
  const isSelected = selectedId === id;
  const hasChildren = node.children?.length > 0;
  const isExpanded = expanded.has(id);

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node)}
        className={`w-full flex items-center gap-1.5 py-1.5 pr-2 text-left text-sm rounded-md transition-colors ${
          isSelected
            ? 'bg-emerald-100 text-emerald-900 font-medium'
            : 'hover:bg-gray-50 text-gray-800'
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {hasChildren ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                onToggle(id);
              }
            }}
            className="shrink-0 text-gray-400 hover:text-gray-600"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span className="flex-1 truncate">{node.label}</span>
        <span
          className={`shrink-0 min-w-[1.25rem] text-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
            node.itemCount > 0 ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {node.itemCount}
        </span>
      </button>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child._id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LocationModal({ mode, form, setForm, parentOptions, onClose, onSubmit, submitting }) {
  const isBranch = form.level === 'branch';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {mode === 'create' ? 'Add location' : 'Edit location'}
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Branch {LOCATION_PATH_SEP} Floor {LOCATION_PATH_SEP} Rack
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Level *</label>
            <select
              value={form.level}
              onChange={(e) =>
                setForm((p) => ({ ...p, level: e.target.value, parentLocationId: '' }))
              }
              className="w-full px-3 py-2 text-sm border rounded-lg"
              disabled={mode === 'edit'}
            >
              {ACTIVE_LOCATION_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {ACTIVE_LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </div>
          {!isBranch && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Parent *</label>
              <select
                value={form.parentLocationId}
                onChange={(e) => setForm((p) => ({ ...p, parentLocationId: e.target.value }))}
                className="w-full px-3 py-2 text-sm border rounded-lg"
                required
              >
                <option value="">Select parent…</option>
                {parentOptions.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.path || p.name || p.code} ({ACTIVE_LEVEL_LABELS[p.level] || p.level})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
            <input
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              placeholder="e.g. Hyderabad Main, Floor 2, R012"
              className="w-full px-3 py-2 text-sm border rounded-lg font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Display name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Hyderabad Main Branch"
              className="w-full px-3 py-2 text-sm border rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
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
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const { data: treeData, isLoading: treeLoading, mutate: mutateTree } = useSWR(
    '/api/admin/inventory/locations/tree',
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: allLocsData, mutate: mutateAll } = useSWR(
    '/api/admin/inventory/locations',
    fetcher,
    { revalidateOnFocus: false }
  );

  const itemsUrl = selectedId ? `/api/admin/inventory/locations/${selectedId}/items` : null;
  const { data: itemsData, isLoading: itemsLoading, mutate: mutateItems } = useSWR(itemsUrl, fetcher, {
    revalidateOnFocus: false,
  });

  const tree = treeData?.tree || [];
  const allLocations = allLocsData?.locations || [];

  const parentOptions = useMemo(() => {
    if (!form.level || form.level === 'branch') return [];
    const parentLevel = ACTIVE_LOCATION_PARENT[form.level];
    if (!parentLevel) return [];
    return allLocations.filter((l) => l.level === parentLevel);
  }, [form.level, allLocations]);

  const refresh = useCallback(() => {
    mutateTree();
    mutateAll();
    if (selectedId) mutateItems();
  }, [mutateTree, mutateAll, mutateItems, selectedId]);

  const handleSelect = useCallback((node) => {
    setSelectedId(String(node._id));
    setSelectedNode(node);
    setExpanded((prev) => new Set(prev).add(String(node._id)));
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

  const openCreate = useCallback((parentNode = null) => {
    if (parentNode) {
      const childLevel = ACTIVE_LOCATION_CHILD[parentNode.level];
      if (!childLevel) {
        toast.error('Cannot add children under a rack');
        return;
      }
      setForm({
        code: '',
        name: '',
        level: childLevel,
        parentLocationId: String(parentNode._id),
      });
    } else {
      setForm({ ...EMPTY_FORM });
    }
    setModal('create');
  }, []);

  const openEdit = useCallback(() => {
    if (!selectedNode) return;
    adminJson(`/api/admin/inventory/locations/${selectedNode._id}`)
      .then((res) => {
        const loc = res.location;
        setForm({
          code: loc.code || '',
          name: loc.name || '',
          level: loc.level,
          parentLocationId: loc.parentLocationId ? String(loc.parentLocationId) : '',
        });
        setModal('edit');
      })
      .catch((err) => toast.error(err.message || 'Failed to load location'));
  }, [selectedNode]);

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        level: form.level,
        parentLocationId: form.level === 'branch' ? null : form.parentLocationId || null,
      };

      if (modal === 'create') {
        await adminJson('/api/admin/inventory/locations', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Location created');
      } else {
        await adminJson(`/api/admin/inventory/locations/${selectedId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Location updated');
      }

      setModal(null);
      refresh();
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId || !selectedNode) return;
    if (!window.confirm(`Delete "${selectedNode.displayPath || selectedNode.label}"?`)) return;
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
    const items = itemsData?.items || [];
    const q = itemSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.title?.toLowerCase().includes(q) ||
        it.sku?.toLowerCase().includes(q) ||
        it.fullPath?.toLowerCase().includes(q)
    );
  }, [itemsData, itemSearch]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Locations</h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
            <MapPin size={14} />
            Branch {LOCATION_PATH_SEP} Floor {LOCATION_PATH_SEP} Rack
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={() => openCreate(selectedNode)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
            >
              <Plus size={16} />
              Add location
            </button>
          )}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search items here…"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[520px]">
        <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">
                {ACTIVE_LOCATION_LEVELS.map((l) => ACTIVE_LEVEL_LABELS[l]).join(` ${LOCATION_PATH_SEP} `)}
              </p>
              <button
                type="button"
                onClick={expandAll}
                className="text-[10px] text-emerald-700 hover:underline shrink-0"
              >
                Expand all
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {treeLoading ? (
              <p className="text-sm text-gray-500 p-4 text-center">Loading tree…</p>
            ) : tree.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                <p className="mb-3">No locations yet.</p>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => openCreate()}
                    className="text-emerald-700 font-medium hover:underline"
                  >
                    + Add your first branch
                  </button>
                )}
              </div>
            ) : (
              tree.map((node) => (
                <TreeNode
                  key={node._id}
                  node={node}
                  depth={0}
                  selectedId={selectedId}
                  expanded={expanded}
                  onSelect={handleSelect}
                  onToggle={handleToggle}
                />
              ))
            )}
          </div>
          {selectedNode && canManage && (
            <div className="px-3 py-3 border-t border-gray-100 flex gap-2">
              <button
                type="button"
                onClick={openEdit}
                className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Items here</h2>
              {itemsData?.location && (
                <p className="text-xs text-emerald-700 font-mono mt-0.5">
                  {itemsData.location.displayPath}
                </p>
              )}
            </div>
            {itemsData && (
              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {filteredItems.length}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {!selectedId ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400">
                <Package size={40} className="mb-3 opacity-40" />
                <p className="text-sm">Select a location in the tree</p>
              </div>
            ) : itemsLoading ? (
              <p className="text-sm text-gray-500 p-8 text-center">Loading items…</p>
            ) : filteredItems.length === 0 ? (
              <p className="text-sm text-gray-500 p-8 text-center">No stock at this location</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">SKU</th>
                    <th className="px-4 py-2.5">Sellable</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 min-w-[200px]">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredItems.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 font-medium text-gray-900">{item.title}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.sku || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold">{item.qty}</span>
                        <span className="text-gray-400 text-xs ml-1">{item.stockUnit}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            item.statusBucket === 'sellable'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-600">{item.fullPath}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {modal && (
        <LocationModal
          mode={modal}
          form={form}
          setForm={setForm}
          parentOptions={parentOptions}
          onClose={() => setModal(null)}
          onSubmit={handleSave}
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
