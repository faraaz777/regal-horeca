'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAppContext } from '@/context/AppContext';
import { apiClient, ApiError } from '@/lib/utils/apiClient';
import { showToast } from '@/lib/utils/toast';
import {
  buildTaxonomyMaps,
  buildTaxonomyTree,
  compareTaxonomySiblings,
  deriveLevelFromParent,
  getTaxonomyId,
  getTaxonomyParentId,
  slugifyTaxonomyName,
  sortTaxonomyFlatList,
} from '@/lib/taxonomy/taxonomyTreeUtils';

/**
 * Shared data layer for menu-builder (categories + brands).
 * Optimistic updates — no full refetch after mutations.
 */
export function useTaxonomyData(config) {
  const { upsertCategory, removeCategory, upsertBrand, removeBrand } = useAppContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiClient.request(config.adminListApi);
      if (data.success) {
        const list = data[config.responseKey] || [];
        setItems(sortTaxonomyFlatList(list));
        return list;
      }
      setError(data.error || `Failed to load ${config.responseKey}`);
      return [];
    } catch (err) {
      setError(err?.message || `Failed to load ${config.responseKey}`);
      return [];
    } finally {
      setLoading(false);
    }
  }, [config.adminListApi, config.responseKey]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const { parentMap, idMap } = useMemo(() => buildTaxonomyMaps(items), [items]);
  const tree = useMemo(() => buildTaxonomyTree(items), [items]);

  const syncContext = useCallback(
    (savedItem, action) => {
      if (config.type === 'category') {
        if (action === 'delete') removeCategory(savedItem);
        else upsertCategory(savedItem);
      } else if (config.type === 'brand') {
        if (action === 'delete') removeBrand(savedItem);
        else upsertBrand(savedItem);
      }
    },
    [config.type, removeCategory, upsertCategory, removeBrand, upsertBrand]
  );

  const upsertLocal = useCallback((savedItem) => {
    const id = getTaxonomyId(savedItem);
    setItems((prev) => {
      const next = [...prev];
      const idx = next.findIndex((x) => getTaxonomyId(x) === id);
      if (idx >= 0) next[idx] = { ...next[idx], ...savedItem };
      else next.push(savedItem);
      return sortTaxonomyFlatList(next);
    });
  }, []);

  const removeLocal = useCallback((itemId) => {
    const id = itemId?.toString?.() ?? itemId;
    setItems((prev) => prev.filter((x) => getTaxonomyId(x) !== id));
  }, []);

  const createItem = useCallback(
    async (payload) => {
      const toastId = showToast.loading(`Creating ${config.singularLabel.toLowerCase()}...`);
      setSaving(true);
      try {
        const body = { ...payload };
        if (!body.slug && body.name) body.slug = slugifyTaxonomyName(body.name);
        if (body.parent == null) body.level = config.levels[0];
        else if (!body.level) body.level = deriveLevelFromParent(body.parent, idMap, config.levels);

        const siblings = parentMap.get(body.parent?.toString?.() ?? body.parent ?? null) || [];
        body.sortOrder = siblings.length;

        const res = await apiClient.requestWithRetry(config.apiBase, {
          method: 'POST',
          body,
        });
        const savedItem = res?.category || res?.brand;
        if (savedItem) {
          upsertLocal(savedItem);
          syncContext(savedItem, 'upsert');
          if (body.parent) {
            const parentStr = (body.parent?.toString?.() ?? body.parent)?.toString?.();
            if (parentStr) {
              setExpandedIds((prev) => new Set(prev).add(parentStr));
            }
          }
        }
        showToast.success(`${config.singularLabel} created`);
        return savedItem;
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Create failed';
        showToast.error(msg);
        throw err;
      } finally {
        toast.dismiss(toastId);
        setSaving(false);
      }
    },
    [config, idMap, parentMap, syncContext, upsertLocal]
  );

  const updateItem = useCallback(
    async (itemId, payload) => {
      const toastId = showToast.loading(`Updating ${config.singularLabel.toLowerCase()}...`);
      setSaving(true);
      try {
        const body = { ...payload };
        if (!body.slug && body.name) body.slug = slugifyTaxonomyName(body.name);

        const res = await apiClient.requestWithRetry(`${config.apiBase}/${itemId}`, {
          method: 'PUT',
          body,
        });
        const savedItem = res?.category || res?.brand;
        if (savedItem) {
          upsertLocal(savedItem);
          syncContext(savedItem, 'upsert');
        }
        showToast.success(`${config.singularLabel} updated`);
        return savedItem;
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Update failed';
        showToast.error(msg);
        throw err;
      } finally {
        toast.dismiss(toastId);
        setSaving(false);
      }
    },
    [config, syncContext, upsertLocal]
  );

  const deleteItem = useCallback(
    async (itemId, { canDelete = false } = {}) => {
      if (!canDelete) {
        showToast.error('Only Super Admin can delete items.');
        return false;
      }
      const hasChildren = items.some((x) => getTaxonomyParentId(x) === itemId?.toString?.());
      if (hasChildren) {
        showToast.error(`Cannot delete ${config.singularLabel.toLowerCase()} with children.`);
        return false;
      }
      if (!window.confirm(`Delete this ${config.singularLabel.toLowerCase()}?`)) return false;

      const toastId = showToast.loading('Deleting...');
      setSaving(true);
      try {
        await apiClient.requestWithRetry(`${config.apiBase}/${itemId}`, { method: 'DELETE' });
        removeLocal(itemId);
        syncContext(itemId, 'delete');
        showToast.success(`${config.singularLabel} deleted`);
        return true;
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Delete failed';
        showToast.error(msg);
        return false;
      } finally {
        toast.dismiss(toastId);
        setSaving(false);
      }
    },
    [config, items, removeLocal, syncContext]
  );

  const reorderSiblings = useCallback(
    async (parentId, orderedIds) => {
      const normalizedParent = parentId?.toString?.() ?? parentId ?? null;
      const prev = items;
      const childLevel = deriveLevelFromParent(normalizedParent, idMap, config.levels);

      setItems((current) => {
        const orderMap = new Map(orderedIds.map((id, i) => [id?.toString?.() ?? id, i]));
        return sortTaxonomyFlatList(
          current.map((x) => {
            const id = getTaxonomyId(x);
            if (!orderMap.has(id)) return x;
            return {
              ...x,
              parent: normalizedParent,
              level: normalizedParent ? childLevel : config.levels[0],
              sortOrder: orderMap.get(id),
            };
          })
        );
      });

      try {
        await apiClient.requestWithRetry(config.reorderApi, {
          method: 'POST',
          body: {
            type: config.type,
            parentId: normalizedParent,
            orderedIds,
          },
        });
      } catch (err) {
        setItems(prev);
        const msg = err instanceof ApiError ? err.message : 'Reorder failed';
        showToast.error(msg);
      }
    },
    [config, idMap, items]
  );

  const toggleExpand = useCallback((id) => {
    const idStr = id?.toString?.() ?? id;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idStr)) next.delete(idStr);
      else next.add(idStr);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const all = new Set();
    for (const item of items) {
      const id = getTaxonomyId(item);
      const kids = parentMap.get(id);
      if (kids?.length) all.add(id);
    }
    setExpandedIds(all);
  }, [items, parentMap]);

  const collapseAll = useCallback(() => setExpandedIds(new Set()), []);

  const canAddChild = useCallback(
    (node) => {
      const level = node?.level;
      const idx = config.levels.indexOf(level);
      return idx >= 0 && idx < config.levels.length - 1;
    },
    [config.levels]
  );

  const getChildLevel = useCallback(
    (parentNode) => {
      const idx = config.levels.indexOf(parentNode?.level);
      if (idx < 0 || idx >= config.levels.length - 1) return null;
      return config.levels[idx + 1];
    },
    [config.levels]
  );

  return {
    items,
    tree,
    parentMap,
    idMap,
    loading,
    error,
    saving,
    expandedIds,
    setExpandedIds,
    fetchList,
    createItem,
    updateItem,
    deleteItem,
    reorderSiblings,
    toggleExpand,
    expandAll,
    collapseAll,
    canAddChild,
    getChildLevel,
    compareTaxonomySiblings,
  };
}
