'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * Transparent loader overlay for CTAs - prevents double-click and shows feedback
 */
function LoaderOverlay({ loading }) {
  if (!loading) return null;
  return (
    <span
      className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[1px] rounded-[inherit] z-10"
      aria-hidden="true"
    >
      <span className="w-5 h-5 border-2 border-black/30 border-t-transparent rounded-full animate-spin" />
    </span>
  );
}

/**
 * Button with transparent loading overlay - for async actions
 * Prevents double-click and shows spinner when loading
 */
export function LoadingButton({
  children,
  onClick,
  disabled,
  loading: controlledLoading,
  className = '',
  type = 'button',
  ...props
}) {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = controlledLoading ?? internalLoading;

  const handleClick = async (e) => {
    if (loading || disabled) return;
    if (onClick) {
      const result = onClick(e);
      if (result && typeof result.then === 'function') {
        setInternalLoading(true);
        try {
          await result;
        } finally {
          setInternalLoading(false);
        }
      }
    }
  };

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled || loading}
      className={`relative overflow-hidden ${className}`}
      {...props}
    >
      {children}
      <LoaderOverlay loading={loading} />
    </button>
  );
}

/**
 * Link with transparent loading overlay on click - for navigation
 * Prevents double-click and shows spinner until navigation starts
 */
export function LoadingLink({
  href,
  children,
  onClick,
  className = '',
  ...props
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = (e) => {
    if (loading) {
      e.preventDefault();
      return;
    }
    if (onClick) onClick(e);
    if (e.defaultPrevented) return;
    // Client-side navigation - show loading
    const isSameOrigin = href.startsWith('/') || href.startsWith(window?.location?.origin || '');
    if (isSameOrigin && !href.startsWith('#')) {
      e.preventDefault();
      setLoading(true);
      router.push(href);
    }
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={`relative overflow-hidden inline-flex items-center justify-center ${className}`}
      {...props}
    >
      {children}
      <LoaderOverlay loading={loading} />
    </Link>
  );
}
