'use client';

import { createContext, useContext, useCallback, useMemo } from 'react';
import useSWR from 'swr';

const TaxonomyContext = createContext(undefined);

function flattenTree(nodes) {
  if (!Array.isArray(nodes)) return [];
  let result = [];
  nodes.forEach((node) => {
    result.push(node);
    if (node.children && node.children.length > 0) {
      result = result.concat(flattenTree(node.children));
    }
  });
  return result;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  return { response, data };
}

async function fetchCategoriesFlat() {
  const { data } = await fetchJson('/api/categories?tree=true');
  if (!data.success) return [];
  return flattenTree(data.categories || []);
}

async function fetchBrandsFlat() {
  const { data } = await fetchJson('/api/brands?tree=true');
  if (!data.success) return [];
  return flattenTree(data.brands || []);
}

async function fetchBusinessTypesList() {
  const { data } = await fetchJson('/api/business-types');
  if (!data.success) return [];
  return data.businessTypes || [];
}

export function TaxonomyProvider({ children, initialCategories = [] }) {
  const hasServerCategories = initialCategories.length > 0;

  const {
    data: categories = [],
    mutate: mutateCategories,
    isLoading: categoriesLoading,
  } = useSWR('/api/categories?tree=true', fetchCategoriesFlat, {
    fallbackData: hasServerCategories ? initialCategories : undefined,
    revalidateOnFocus: false,
    revalidateOnMount: !hasServerCategories,
  });

  const { data: brands = [], mutate: mutateBrands, isLoading: brandsLoading } = useSWR(
    '/api/brands?tree=true',
    fetchBrandsFlat,
    { revalidateOnFocus: false }
  );

  const { data: businessTypes = [], isLoading: btLoading } = useSWR(
    '/api/business-types',
    fetchBusinessTypesList,
    { revalidateOnFocus: false }
  );

  const loading = categoriesLoading || brandsLoading || btLoading;

  const refreshCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/categories?tree=true');
      const data = await response.json();
      if (response.ok && data.success) {
        const flat = flattenTree(data.categories || []);
        await mutateCategories(flat, { revalidate: false });
      }
    } catch (error) {
      console.error('Failed to refresh categories:', error);
    }
  }, [mutateCategories]);

  const upsertCategory = useCallback(
    (category) => {
      if (!category) return;
      const id = (category._id || category.id)?.toString?.() ?? (category._id || category.id);
      if (!id) return;

      mutateCategories(
        (prev) => {
          const list = Array.isArray(prev) ? [...prev] : [];
          const idx = list.findIndex((c) => (c._id || c.id)?.toString?.() === id);
          if (idx >= 0) {
            list[idx] = { ...list[idx], ...category };
            return list;
          }
          return [...list, category];
        },
        { revalidate: false }
      );
    },
    [mutateCategories]
  );

  const removeCategory = useCallback(
    (categoryId) => {
      const id = categoryId?.toString?.() ?? categoryId;
      if (!id) return;
      mutateCategories(
        (prev) => (Array.isArray(prev) ? prev.filter((c) => (c._id || c.id)?.toString?.() !== id) : []),
        { revalidate: false }
      );
    },
    [mutateCategories]
  );

  const refreshBrands = useCallback(async () => {
    try {
      const next = await fetchBrandsFlat();
      await mutateBrands(next, { revalidate: false });
    } catch (error) {
      console.error('Failed to refresh brands:', error);
    }
  }, [mutateBrands]);

  const value = useMemo(
    () => ({
      categories,
      brands,
      businessTypes,
      loading,
      refreshCategories,
      upsertCategory,
      removeCategory,
      refreshBrands,
    }),
    [
      categories,
      brands,
      businessTypes,
      loading,
      refreshCategories,
      upsertCategory,
      removeCategory,
      refreshBrands,
    ]
  );

  return <TaxonomyContext.Provider value={value}>{children}</TaxonomyContext.Provider>;
}

export function useTaxonomy() {
  const ctx = useContext(TaxonomyContext);
  if (ctx === undefined) {
    throw new Error('useTaxonomy must be used within TaxonomyProvider');
  }
  return ctx;
}
