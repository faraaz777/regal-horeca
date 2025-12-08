/**
 * Toast notification utilities
 * Wrapper around react-hot-toast for consistent styling
 */

import toast from 'react-hot-toast';

export const showToast = {
  success: (message) => {
    toast.success(message, {
      duration: 3000,
      position: 'top-right',
      style: {
        background: '#10b981',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '14px',
      },
    });
  },
  
  error: (message) => {
    toast.error(message, {
      duration: 4000,
      position: 'top-right',
      style: {
        background: '#ef4444',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '14px',
      },
    });
  },
  
  loading: (message) => {
    return toast.loading(message, {
      position: 'top-right',
      style: {
        background: '#3b82f6',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '14px',
      },
    });
  },
  
  promise: (promise, messages) => {
    return toast.promise(promise, messages, {
      position: 'top-right',
      style: {
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '14px',
      },
    });
  },
};

