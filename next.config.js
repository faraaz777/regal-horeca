/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Production optimizations
  swcMinify: true,
  compress: true,
  
  // Image optimization configuration
  images: {
    // Allow images from Cloudflare R2 and other external sources
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudflare.com',
      },
      {
        protocol: 'https',
        hostname: '**.r2.dev',
      },
      {
        protocol: 'https',
        hostname: 'pub-83aac0f4bf7f4e08825bbcd70a863973.r2.dev',
      },
    ],
    // Optimize images in production
    // Reduced sizes/formats to minimize Vercel image optimization usage
    formats: ['image/webp'], // Removed AVIF to cut formats in half
    deviceSizes: [640, 1200, 1920], // Reduced from 8 to 3 essential sizes
    imageSizes: [256, 384], // Reduced from 8 to 2 essential sizes
    // Cache optimized images for 1 year (images don't change)
    minimumCacheTTL: 31536000,
  },
  
  // Environment variables that should be available on the client side
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER,
  },
  
  // Production headers for security and performance
  async headers() {
    return [
      // Static assets - long-term caching (1 year)
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
        ],
      },
      // Next.js image optimization cache
      {
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
        ],
      },
      // Public assets (images, fonts, etc.)
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
        ],
      },
      // General security headers for all routes
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
        ],
      },
    ];
  },
  
  // Output configuration - use standalone for better production deployment
  output: 'standalone',
};

module.exports = nextConfig;

