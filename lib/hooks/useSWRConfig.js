/**
 * SWR Configuration for caching
 */

'use client';

import { SWRConfig } from 'swr';

const fetcher = async (url) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('regal_admin_token') : null;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  if (!response.ok) {
    const error = new Error('An error occurred while fetching the data.');
    error.info = await response.json();
    error.status = response.status;
    throw error;
  }

  return response.json();
};

export const swrConfig = {
  fetcher,
  revalidateOnFocus: false,
  revalidateOnReconnect: false, // Don't auto-revalidate on reconnect
  revalidateIfStale: false, // Don't revalidate stale data automatically
  dedupingInterval: 5000, // Dedupe requests within 5 seconds (increased from 2s)
  errorRetryCount: 2, // Reduce retries (from 3)
  errorRetryInterval: 10000, // Increase retry interval (from 5s)
  onError: (error, key) => {
    console.error('SWR Error:', error, 'Key:', key);
  },
};

export function SWRProvider({ children }) {
  return <SWRConfig value={swrConfig}>{children}</SWRConfig>;
}

