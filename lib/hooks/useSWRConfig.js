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
  revalidateOnReconnect: true,
  dedupingInterval: 2000, // Dedupe requests within 2 seconds
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  onError: (error, key) => {
    console.error('SWR Error:', error, 'Key:', key);
  },
};

export function SWRProvider({ children }) {
  return <SWRConfig value={swrConfig}>{children}</SWRConfig>;
}

