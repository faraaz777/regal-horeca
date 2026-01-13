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
  icons: {
    icon: '/favicon.ico',
  },
};

export default async function RootLayout({ children }) {
  // Fetch categories server-side with caching
  // Uses React cache() for deduplication and unstable_cache for cross-request caching
  // This ensures categories are available instantly without blocking page loads
  // Cache prevents database queries on every request
  const initialCategories = await getCategories();

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppProvider initialCategories={initialCategories}>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}

