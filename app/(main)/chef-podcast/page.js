/**
 * Chef Podcast Registration Page
 *
 * Public landing page for chef podcast registrations.
 * The visible experience stays on Regal's website while
 * submissions are posted into the existing Google Form backend.
 */

import { Bodoni_Moda, Fraunces, Outfit } from 'next/font/google';
import { SITE_CONFIG } from '@/lib/constants/seo';
import ChefPodcastForm from './ChefPodcastForm';

const bodoni = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-bodoni',
  display: 'swap',
  weight: ['700', '800', '900'],
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  style: ['normal', 'italic'],
  weight: ['700', '800', '900'],
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata = {
  title: 'Chef Podcast Registration | REGAL HoReCa',
  description:
    'Register your interest in being featured on the REGAL HoReCa Chef Podcast.',
  openGraph: {
    title: 'REGAL HoReCa Chef Podcast Registration',
    description:
      'Share your culinary journey and register your interest for the REGAL HoReCa Chef Podcast.',
    url: `${SITE_CONFIG.baseUrl}/chef-podcast`,
  },
  alternates: { canonical: '/chef-podcast' },
};

export default function ChefPodcastPage() {
  return (
    <div className={`${bodoni.variable} ${fraunces.variable} ${outfit.variable}`}>
      <ChefPodcastForm />
    </div>
  );
}
