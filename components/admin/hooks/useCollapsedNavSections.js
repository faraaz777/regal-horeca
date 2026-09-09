'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'regal.admin.nav.collapsed';

function readCollapsedIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

/**
 * Remembers which sidebar sections the user collapsed.
 * The section that contains the current page is always kept open.
 */
export function useCollapsedNavSections(activeSectionId) {
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());

  useEffect(() => {
    setCollapsedIds(readCollapsedIds());
  }, []);

  useEffect(() => {
    if (!activeSectionId) return;
    setCollapsedIds((prev) => {
      if (!prev.has(activeSectionId)) return prev;
      const next = new Set(prev);
      next.delete(activeSectionId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // ignore quota / private mode
      }
      return next;
    });
  }, [activeSectionId]);

  const toggleSection = useCallback((sectionId) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { collapsedIds, toggleSection };
}
