import { SITE_CONFIG } from '@/lib/constants/seo';

export const metadata = {
  title: 'My Wishlist',
  description: 'Your saved REGAL® HoReCa products. Hospitality supplies wishlist.',
  robots: { index: false, follow: true },
  openGraph: {
    title: 'My Wishlist | REGAL® HoReCa',
    url: `${SITE_CONFIG.baseUrl}/wishlist`,
  },
  alternates: { canonical: '/wishlist' },
};

export default function WishlistLayout({ children }) {
  return children;
}
