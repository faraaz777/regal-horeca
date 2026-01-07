/**
 * Root Layout
 * 
 * This is the root layout component for the Next.js app.
 * It wraps all pages and provides global context providers.
 */

import './globals.css';
import { AppProvider } from '@/context/AppContext';
import { getCategories } from '@/lib/utils/getCategories';

export const metadata = {
  title: 'Regal HoReCa - Premium Hospitality Supplies',
  description: 'Your one-stop solution for hotel, restaurant, and café equipment and supplies.',
};

// Force dynamic rendering to prevent build-time database calls
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }) {
  // Fetch categories server-side for instant availability
  // Skip during build to prevent build slowdown (categories will load client-side)
  let initialCategories = [];
  try {
    // Only fetch if not during build phase
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      initialCategories = await getCategories();
    }
  } catch (error) {
    // Silently fail during build - categories will load client-side
    console.warn('Categories not available during build, will load client-side');
  }

  return (
    <html lang="en">
      <body>
        <AppProvider initialCategories={initialCategories}>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}

