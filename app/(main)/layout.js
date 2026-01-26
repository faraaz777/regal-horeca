/**
 * Main Layout
 * 
 * Layout wrapper for public pages (non-admin).
 * Includes Header and Footer components.
 */

import { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LoadingPage from '@/components/LoadingPage';
import ClientOnly from '@/components/ClientOnly';
import { Analytics } from "@vercel/analytics/next"

export default function MainLayout({ children }) {
  return (
    <>
      <LoadingPage />
      <div className="overflow-x-hidden">
        <ClientOnly fallback={<div className="h-20 bg-white" />}>
          <Suspense fallback={<div className="h-20 bg-white" />}>
            <Header />
          </Suspense>
        </ClientOnly>
        <main className="flex-grow">{children}</main>
        <Analytics />
        <Footer />
      </div>
    </>
  );
}

