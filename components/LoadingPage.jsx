'use client';

/**
 * Loading Page Component
 * 
 * Shows a loading screen when the website is first opened.
 */

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Logo from './new/regalLogo.png';

export default function LoadingPage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Hide loading after page is fully loaded
    const handleLoad = () => {
      setTimeout(() => {
        setIsLoading(false);
      }, 5000); // Show for 1.5 seconds minimum
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-white flex items-center justify-center">
      <div className="flex flex-col items-center justify-center space-y-6">
        {/* Logo with animation */}
        <div className="transform transition-all duration-1000 animate-pulse">
          <Image
            src={Logo}
            alt="Regal HoReCa"
            width={200}
            height={100}
            priority
            className="h-20 w-auto sm:h-24 md:h-32 object-contain"
          />
        </div>

        {/* Loading text */}
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-black mb-2">
            Regal HoReCa
          </h2>
          <p className="text-sm sm:text-base text-black/70">
            Premium Hospitality Supplies
          </p>
      
        </div>

        {/* Loading spinner */}
        <div className="flex items-center justify-center space-x-2">
          <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200">
        <div className="h-full bg-accent animate-progress" />
      </div>

      <style jsx>{`
        @keyframes progress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
        .animate-progress {
          animation: progress 1.5s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
}

