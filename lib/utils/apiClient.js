/**
 * API Client with error handling — uses httpOnly cookie auth.
 */

import { adminFetch, AdminFetchError } from '@/lib/client/adminFetch';

export class ApiError extends AdminFetchError {}

export const apiClient = {
  async request(url, options = {}) {
    const isFormData = options.body instanceof FormData;

    const config = {
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      config.body = JSON.stringify(options.body);
    } else if (options.body) {
      config.body = options.body;
    }

    try {
      const response = await adminFetch(url, config);
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
        throw new ApiError(
          data.error || `Request failed (${response.status})`,
          response.status,
          data.details
        );
      }

      return data;
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new ApiError(
          'Network error: Please check your internet connection',
          0,
          { networkError: true }
        );
      }

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(error.message || 'An unexpected error occurred', 500, {
        originalError: error.message,
      });
    }
  },

  async requestWithRetry(url, options = {}, maxRetries = 3) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.request(url, options);
      } catch (error) {
        lastError = error;

        if (error.status >= 400 && error.status < 500) {
          throw error;
        }

        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }

    throw lastError;
  },
};
