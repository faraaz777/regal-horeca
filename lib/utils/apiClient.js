/**
 * API Client with error handling, retry logic, and network detection
 */

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export const apiClient = {
  async request(url, options = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('regal_admin_token') : null;
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    // Add body if it's an object (not FormData)
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      config.body = JSON.stringify(options.body);
    } else if (options.body) {
      config.body = options.body;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.error || 'Request failed',
          response.status,
          data.details
        );
      }

      return data;
    } catch (error) {
      // Network error detection
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new ApiError(
          'Network error: Please check your internet connection',
          0,
          { networkError: true }
        );
      }
      
      // Re-throw ApiError as-is
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Unknown error
      throw new ApiError(
        error.message || 'An unexpected error occurred',
        500,
        { originalError: error.message }
      );
    }
  },

  async requestWithRetry(url, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.request(url, options);
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }
    
    throw lastError;
  },
};

