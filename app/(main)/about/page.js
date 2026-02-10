/**
 * About Us Page
 * 
 * Company information, history, and details about Regal Horeca
 */

import Hero from '@/components/about/Hero';
import Stats from '@/components/about/Stats';
import About from '@/components/about/About';
import Features from '@/components/about/Features';
import Ventures from '@/components/about/Ventures';
import ParticipatingBrands from './ParticipatingBrands';
import WhyChooseUs from '@/components/WhyChooseUs';
import Locations from '@/components/about/Locations';
import { SITE_CONFIG } from '@/lib/constants/seo';

export const metadata = {
  title: 'About REGAL® HoReCa - 45+ Years of Hospitality Excellence',
  description: 'REGAL HoReCa Hyderabad - Premium commercial kitchen equipment & hotel supplies. Our story, showroom, and commitment to quality since 45+ years.',
  openGraph: {
    title: 'About REGAL® HoReCa | Hyderabad Hospitality Supplies',
    url: `${SITE_CONFIG.baseUrl}/about`,
  },
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-regal-black selection:bg-regal-orange selection:text-white">
      <Hero />
      <Stats />
      <About />
      <Features />
      <Ventures />
      <ParticipatingBrands />
      <WhyChooseUs />
      <Locations />
    </div>
  );
}

