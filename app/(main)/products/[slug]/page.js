/**
 * Product Detail Page (Server)
 *
 * Fetches product server-side and passes it to the client component so the initial
 * HTML contains full product content (title, price, description, specs) for SEO.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFullProductBySlug } from '@/lib/utils/getProductBySlug';
import ProductDetailClient from '@/components/product-detail/ProductDetailClient';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }) {
  const slug = params?.slug;
  if (!slug) {
    return (
      <div className="min-h-screen bg-white">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
            <Link href="/catalog" className="text-accent hover:text-black transition-colors">
              Back to Catalog
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const product = await getFullProductBySlug(slug);
  // If the requested slug points at a parent variant carrier, the resolver attaches
  // a `redirectTo` slug pointing at the default child. 308 keeps method semantics
  // for any future POST/Form scenarios while still being permanent for SEO.
  if (product?.redirectTo && product.redirectTo !== slug) {
    redirect(`/products/${product.redirectTo}`);
  }
  if (!product) {
    return (
      <div className="min-h-screen bg-white">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
            <Link href="/catalog" className="text-accent hover:text-black transition-colors">
              Back to Catalog
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Ensure serializable for client (ObjectId, Date, etc. become strings/ISO)
  const serializableProduct = JSON.parse(JSON.stringify(product));
  return <ProductDetailClient key={slug} initialProduct={serializableProduct} />;
}
