/**
 * Chef Podcast Registration Page
 *
 * Public landing page for chef podcast registrations.
 * The visible experience stays on Regal's website while
 * submissions are posted into the existing Google Form backend.
 */

import { SITE_CONFIG } from '@/lib/constants/seo';
import ChefPodcastForm from './ChefPodcastForm';

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
  return <ChefPodcastForm />;
}
