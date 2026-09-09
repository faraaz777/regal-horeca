'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  filterTaxonomyTreeByMatchedIds,
  getSearchExpandIds,
  getSearchMatchedIds,
} from '@/lib/taxonomy/taxonomyTreeUtils';

/**
 * Debounced taxonomy search.
 *
 * Matching branches auto-expand so results are visible in the nested list.
 * The tree is filtered to matches plus ancestors and descendants.
 */
export function useTaxonomySearch({ items, tree, idMap, parentMap, setExpandedIds }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 150);
    return () => clearTimeout(timer);
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

  const displayTree = useMemo(
    () => filterTaxonomyTreeByMatchedIds(tree, matchedIds),
    [tree, matchedIds]
  );

  return { search, setSearch, debouncedSearch, displayTree };
}
