'use client';

import { useCallback, useEffect, useState } from 'react';
import { TAXONOMY_UI_STORAGE_KEY } from '@/lib/taxonomy/taxonomyConfig';

/** @returns {['classic' | 'menu-builder', (mode: 'classic' | 'menu-builder') => void]} */
export function useTaxonomyUiMode() {
  const [mode, setModeState] = useState('menu-builder');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TAXONOMY_UI_STORAGE_KEY);
      if (stored === 'classic' || stored === 'menu-builder') {
        setModeState(stored);
      }
    } catch {
      // ignore storage errors
    }
    setHydrated(true);
  }, []);

  const setMode = useCallback((next) => {
    setModeState(next);
    try {
      localStorage.setItem(TAXONOMY_UI_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  return [mode, setMode, hydrated];
}
