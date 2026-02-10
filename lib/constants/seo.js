/**
 * SEO & Brand Constants
 * Centralized NAP (Name, Address, Phone) and brand info for consistency site-wide.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL 
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://regalhoreca.com');

// REGAL® HoReCa - NAP for structured data, footer, brand page
export const REGAL_NAP = {
  name: 'REGAL® HoReCa',
  legalName: 'Regal Brass & Steelware',
  address: {
    street: '15-5, Afzal Gunj, Mahaboob Gunj, 696ASHOKBAZARAFZALGUNJ',
    locality: 'Hyderabad',
    region: 'Telangana',
    country: 'India',
    full: '15-5, Afzal Gunj, Mahaboob Gunj, 696ASHOKBAZARAFZALGUNJ, Hyderabad, Telangana 500012',
  },
  phones: ['+91 70939 13311'],
  email: 'regalmetals@rediffmail.com',
  showroom: 'Physical showroom in Hyderabad',
  yearsInBusiness: 45,
};

// Social profiles for SameAs / structured data
export const REGAL_SOCIAL = [
  'https://www.instagram.com/regalhoreca',
  'https://www.facebook.com/regalhoreca',
  'https://twitter.com/regalhoreca',
  'https://www.linkedin.com/company/regalhoreca',
  'https://www.youtube.com/@regalhoreca',
  'https://wa.me/917093913311',
];

export const SITE_CONFIG = {
  baseUrl: BASE_URL,
  defaultTitle: 'REGAL® HoReCa - Premium Hospitality Supplies | Hyderabad',
  defaultDescription: 'Commercial kitchen equipment & hotel supplies in Hyderabad. Quality tableware, kitchenware, barware for hotels, restaurants, cafés. Over 45 years of excellence.',
  locale: 'en_IN',
};
