import { SITE_CONFIG } from '@/lib/constants/seo';

export const metadata = {
  title: 'Enquiry & Contact - Get a Quote',
  description: 'Contact REGAL® HoReCa for commercial kitchen equipment quotes. Enquiry for hotel, restaurant, café supplies. Hyderabad showroom.',
  openGraph: {
    title: 'Enquiry | REGAL® HoReCa Hyderabad',
    url: `${SITE_CONFIG.baseUrl}/enquiry`,
  },
  alternates: { canonical: '/enquiry' },
};

export default function EnquiryLayout({ children }) {
  return children;
}
