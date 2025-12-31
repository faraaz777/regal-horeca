/**
 * About Us Page
 * 
 * Company information, history, and details about Regal Horeca
 */


import Hero from '@/components/about/Hero';
import Stats from '@/components/about/Stats';
import About from '@/components/about/About';
import Features from '@/components/about/Features';
import Partners from '@/components/about/Partners';
import Ventures from '@/components/about/Ventures';
import Locations from '@/components/about/Locations';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-regal-black selection:bg-regal-orange selection:text-white">
      <Hero />
      <Stats />
      <About />
      <Features />
      <Partners />
      <Ventures />
      <Locations />
    </div>
  );
}

