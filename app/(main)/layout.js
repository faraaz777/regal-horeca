/**
 * Main Layout
 * 
 * Layout wrapper for public pages (non-admin).
 * Includes Header and Footer components.
 */

import { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function MainLayout({ children }) {
  return (
    <>
  <div className="overflow-x-hidden">
  <Suspense fallback={<div className="h-20 bg-white" />}>
    <Header />
  </Suspense>
  <main className="flex-grow">{children}</main>
  <Footer />
</div>

    </>
  );
}

