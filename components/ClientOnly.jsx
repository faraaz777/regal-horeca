'use client';

import { useEffect, useState } from 'react';

/**
 * ClientOnly Component
 * 
 * Wraps components that use client-side only features (like navigation hooks)
 * to prevent SSR/hydration errors. Only renders children on the client.
 */
export default function ClientOnly({ children, fallback = null }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return fallback;
  }

  return <>{children}</>;
}
