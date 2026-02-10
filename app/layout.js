/**
 * Root Layout
 * 
 * This is the root layout component for the Next.js app.
 * It wraps all pages and provides global context providers.
 */

import './globals.css';
import { AppProvider } from '@/context/AppContext';
import { getCategories } from '@/lib/utils/getCategories';
import { SITE_CONFIG, REGAL_NAP, REGAL_SOCIAL } from '@/lib/constants/seo';
import { generateOrganizationSchema, generateWebSiteSchema } from '@/lib/utils/structuredData';

export const metadata = {
  metadataBase: new URL(SITE_CONFIG.baseUrl),
  title: {
    default: SITE_CONFIG.defaultTitle,
    template: '%s | REGAL® HoReCa',
  },
  description: SITE_CONFIG.defaultDescription,
  keywords: ['REGAL', 'REGAL HoReCa', 'Regal Hyderabad', 'commercial kitchen equipment Hyderabad', 'hospitality supplies', 'hotel equipment', 'restaurant supplies', 'HoReCa', 'tableware', 'kitchenware'],
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    type: 'website',
    locale: SITE_CONFIG.locale,
    siteName: REGAL_NAP.name,
    url: SITE_CONFIG.baseUrl,
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: SITE_CONFIG.baseUrl,
  },
};

export default async function RootLayout({ children }) {
  const initialCategories = await getCategories();
  const organizationSchema = generateOrganizationSchema();
  const websiteSchema = generateWebSiteSchema();

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <AppProvider initialCategories={initialCategories}>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}

