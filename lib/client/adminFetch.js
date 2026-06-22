/**
 * Admin fetch — cookie auth with silent refresh on 401.
 */

export class AdminFetchError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'AdminFetchError';
    this.status = status;
    this.details = details;
  }
}

let refreshPromise = null;

async function tryRefreshSession() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  }).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function adminFetch(url, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  let response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (response.status === 401 && !String(url).includes('/api/auth/login')) {
    const refreshed = await tryRefreshSession();
    if (refreshed.ok) {
      response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers,
      });
    }
  }

  if (response.status === 401 && typeof window !== 'undefined') {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/admin/login?next=${next}`;
    throw new AdminFetchError('Session expired', 401);
  }

  return response;
}

export async function adminJson(url, options = {}) {
  const response = await adminFetch(url, options);
  const text = await response.text();
  let data = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    throw new AdminFetchError(data.error || `Request failed (${response.status})`, response.status, data.details);
  }

  return data;
}
