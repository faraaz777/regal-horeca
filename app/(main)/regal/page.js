/**
 * REGAL® Brand Page
 * Dedicated page for brand/entity association - helps Google understand REGAL = this business.
 */

import Link from 'next/link';
import { SITE_CONFIG } from '@/lib/constants/seo';
import { REGAL_NAP, REGAL_SOCIAL } from '@/lib/constants/seo';

export const metadata = {
  title: 'REGAL® HoReCa - The Brand | Hyderabad Hospitality Supplies',
  description: 'REGAL HoReCa Hyderabad - Over 45 years of commercial kitchen equipment & hotel supplies. Our story, showroom, products. Premium tableware, kitchenware, barware.',
  openGraph: {
    title: 'REGAL® HoReCa - The Brand | Hyderabad',
    url: `${SITE_CONFIG.baseUrl}/regal`,
  },
  alternates: { canonical: '/regal' },
};

export default function RegalBrandPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-regal-black">
      {/* Hero */}
      <section className="relative py-16 md:py-24 bg-black text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <span className="text-accent text-xs font-bold tracking-widest uppercase mb-4 block">
              The Brand
            </span>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              REGAL® HoReCa
              <span className="block text-accent mt-2">Hyderabad</span>
            </h1>
            <p className="text-lg md:text-xl text-white/80 leading-relaxed">
              Over {REGAL_NAP.yearsInBusiness} years powering hospitality excellence. Commercial kitchen equipment, 
              tableware, and hotel supplies trusted by leading hotels, restaurants, and cafés.
            </p>
          </div>
        </div>
      </section>

      {/* What REGAL Stands For */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 md:mb-12">What REGAL Stands For</h2>
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 max-w-4xl">
            <div>
              <h3 className="text-lg font-semibold mb-3">Quality & Durability</h3>
              <p className="text-black/70 leading-relaxed">
                REGAL HoReCa delivers commercial-grade tableware, kitchenware, and barware designed for 
                high-volume hospitality environments. Dishwasher-safe, engineered for maximum durability.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">Trusted Partnership</h3>
              <p className="text-black/70 leading-relaxed">
                From luxury hotels to boutique cafés, REGAL has been the preferred supplier for hospitality 
                businesses across India. A physical showroom in Hyderabad and a comprehensive online catalog.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories We Serve */}
      <section className="py-16 md:py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">Categories We Serve</h2>
          <p className="text-black/70 max-w-2xl mb-10">
            REGAL HoReCa supplies commercial kitchen equipment and hospitality products for:
          </p>
          <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Hotels', slug: 'hotels' },
              { label: 'Restaurants', slug: 'restaurants' },
              { label: 'Cafés', slug: 'cafes' },
              { label: 'Bakeries', slug: 'bakeries' },
              { label: 'Catering', slug: 'catering' },
              { label: 'Banquets', slug: 'banquets' },
            ].map(({ label, slug }) => (
              <li key={slug} className="flex items-center gap-2">
                <span className="w-2 h-2 bg-accent rounded-full" />
                <Link href={`/whom-we-serve/${slug}`} className="hover:text-accent transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Location & Contact */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">Visit Our Showroom</h2>
          <div className="grid md:grid-cols-2 gap-12 max-w-4xl">
            <address className="not-italic text-black/80 space-y-4">
              <p className="font-semibold text-black">{REGAL_NAP.name}</p>
              <p>{REGAL_NAP.address.full}</p>
              <p>
                {REGAL_NAP.phones.map((phone) => (
                  <span key={phone} className="block">
                    <a href={`tel:${phone.replace(/\s/g, '')}`} className="hover:text-accent transition-colors">
                      {phone}
                    </a>
                  </span>
                ))}
              </p>
              <p>
                <a href={`mailto:${REGAL_NAP.email}`} className="hover:text-accent transition-colors">
                  {REGAL_NAP.email}
                </a>
              </p>
            </address>
            <div>
              <Link
                href="/catalog"
                className="inline-block px-6 py-3 bg-accent text-black font-bold uppercase tracking-widest hover:bg-accent/90 transition-colors"
              >
                Browse Catalog
              </Link>
              <span className="mx-4 text-black/50">|</span>
              <Link
                href="/enquiry"
                className="inline-block px-6 py-3 border-2 border-black font-bold uppercase tracking-widest hover:border-accent hover:text-accent transition-colors"
              >
                Enquiry
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Social & NAP */}
      <section className="py-12 bg-black text-white">
        <div className="container mx-auto px-4 text-center">
          <p className="text-white/80 mb-4">
            Follow REGAL® HoReCa
          </p>
          <div className="flex justify-center gap-6 mb-6">
            {REGAL_SOCIAL.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/70 hover:text-accent transition-colors"
              >
                {url.includes('instagram') ? 'Instagram' : url.includes('facebook') ? 'Facebook' : url.includes('linkedin') ? 'LinkedIn' : url.includes('youtube') ? 'YouTube' : url.includes('wa.me') ? 'WhatsApp' : 'Social'}
              </a>
            ))}
          </div>
          <p className="text-sm text-white/60">
            {REGAL_NAP.name} · {REGAL_NAP.address.full} · {REGAL_NAP.phones[0]}
          </p>
        </div>
      </section>
    </div>
  );
}
