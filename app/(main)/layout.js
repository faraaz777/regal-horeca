/**
 * Main Layout
 * 
 * Layout wrapper for public pages (non-admin).
 * Includes Header and Footer components.
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function MainLayout({ children }) {
  return (
    <>
  <div className="overflow-x-hidden">
  <Header />
  <main className="flex-grow">{children}</main>
  <Footer />
</div>

    </>
  );
}

