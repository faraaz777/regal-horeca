/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
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
  },
  
  // Environment variables that should be available on the client side
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER,
  },
};

module.exports = nextConfig;

