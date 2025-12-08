/**
 * Root Layout
 * 
 * This is the root layout component for the Next.js app.
 * It wraps all pages and provides global context providers.
 */

import './globals.css';
import { AppProvider } from '@/context/AppContext';

export const metadata = {
  title: 'Regal HoReCa - Premium Hospitality Supplies',
  description: 'Your one-stop solution for hotel, restaurant, and café equipment and supplies.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}

