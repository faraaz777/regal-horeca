'use client';

import { useState } from 'react';

// YouTube video ID - Update this with your actual YouTube video ID
// You can extract it from a YouTube URL: https://www.youtube.com/watch?v=VIDEO_ID
// Or set it via environment variable: NEXT_PUBLIC_YOUTUBE_VIDEO_ID
const YOUTUBE_VIDEO_ID = 'https://www.youtube.com/watch?v=steCLFmCP6s';

export default function Hero({ videoId: propVideoId }) {
  const [isLoaded, setIsLoaded] = useState(false);

  // Extract video ID from URL if full URL is provided
  const getVideoId = (videoIdOrUrl) => {
    if (!videoIdOrUrl) return null;
    
    // If it's already just an ID, return it
    if (!videoIdOrUrl.includes('youtube.com') && !videoIdOrUrl.includes('youtu.be')) {
      return videoIdOrUrl;
    }
    
    // Extract from full URL
    const urlPatterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
    ];
    
    for (const pattern of urlPatterns) {
      const match = videoIdOrUrl.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  };

  // Use prop video ID if provided, otherwise use constant/env variable
  const videoId = getVideoId(propVideoId || YOUTUBE_VIDEO_ID);

  if (!videoId) {
    return (
      <section className="relative w-full overflow-hidden">
        <div className="relative w-full aspect-[21/9] sm:aspect-[21/8] md:aspect-[21/7] lg:aspect-[21/6] bg-gray-900 flex items-center justify-center">
          <p className="text-white text-center px-4">
            Please update YOUTUBE_VIDEO_ID in components/Hero.jsx with your YouTube video ID
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-full overflow-hidden bg-black">
      <div className="relative w-full aspect-[21/9] sm:aspect-[21/8] md:aspect-[21/7] lg:aspect-[21/6] overflow-hidden">
        {/* YouTube Video Embed - Zoomed to fill width */}
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1&enablejsapi=1`}
            title="Hero Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onLoad={() => setIsLoaded(true)}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '177.78%', // 16:9 aspect ratio scaled up (100% * 16/9)
              height: '177.78%',
              minWidth: '100%',
              minHeight: '100%',
              transform: 'translate(-50%, -50%) scale(1.5)', // Scale up to fill width
            }}
          />
        </div>

        {/* Optional: Overlay for better text readability if needed */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
      </div>
    </section>
  );
}
