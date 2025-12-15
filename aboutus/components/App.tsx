import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Stats from './components/Stats';
import About from './components/About';
import Ventures from './components/Ventures';
import Features from './components/Features';
import Partners from './components/Partners';
import Locations from './components/Locations';
import Footer from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-white font-sans text-regal-black selection:bg-regal-orange selection:text-white">
      <Navbar />
      <Hero />
      <Stats />
      <About />
      <Features />
      <Partners />
      <Ventures />
      <Locations />
      <Footer />
    </div>
  );
}

export default App;