# Caching Strategy for Next.js on Cloudflare

## Overview
This document outlines the comprehensive caching strategy for the Regal HoReCa application deployed on Cloudflare Pages/Workers with Next.js and image optimization.

## Current Caching Implementation

### 1. Image Caching (Cloudflare R2)
**Location:** `lib/utils/r2Upload.js`
- **Cache-Control:** `public, max-age=31536000, immutable` (1 year)
- **Rationale:** Images don't change once uploaded, perfect for long-term caching
- **Status:** ✅ Implemented

### 2. Next.js Image Optimization
**Location:** `next.config.js`
- **Formats:** AVIF, WebP (automatic format selection)
- **Device Sizes:** 640, 750, 828, 1080, 1200, 1920, 2048, 3840
- **Image Sizes:** 16, 32, 48, 64, 96, 128, 256, 384
- **Status:** ✅ Configured

### 3. API Route Caching

#### Products API (`/api/products`)
- **Cache-Control:** `public, s-maxage=60, stale-while-revalidate=120`
- **Strategy:** Cache for 60s, serve stale for 120s while revalidating
- **Rationale:** Product data changes infrequently, but needs freshness

#### Categories API (`/api/categories`)
- **Cache-Control:** `no-store, no-cache, must-revalidate`
- **Strategy:** No caching (admin changes require immediate updates)
- **Rationale:** Category structure changes require instant reflection

#### Facets API (`/api/products/facets`)
- **Cache-Control:** `public, s-maxage=60, stale-while-revalidate=120`
- **Strategy:** Same as products API

#### Enquiries API (`/api/enquiries`)
- **Cache-Control:** `public, s-maxage=30, stale-while-revalidate=60`
- **Strategy:** Shorter cache for more dynamic data

### 4. Client-Side Caching (SWR)
**Location:** `lib/hooks/useSWRConfig.js`
- **Revalidation:** Disabled on focus, reconnect, and stale
- **Deduplication:** 60 seconds
- **Strategy:** Manual revalidation only

### 5. Category Tree Cache
**Location:** `lib/utils/categoryCache.js`
- **Duration:** 10 minutes in-memory cache
- **Strategy:** Reduces database queries for category tree

## Recommended Caching Strategy for Cloudflare

### 1. Static Assets Caching

#### Next.js Static Files
```javascript
// Add to next.config.js headers()
{
  source: '/_next/static/:path*',
  headers: [
    {
      key: 'Cache-Control',
      value: 'public, max-age=31536000, immutable'
    },
    {
      key: 'CF-Cache-Status',
      value: 'HIT'
    }
  ]
}
```

#### Public Assets (images, fonts, etc.)
```javascript
{
  source: '/images/:path*',
  headers: [
    {
      key: 'Cache-Control',
      value: 'public, max-age=31536000, immutable'
    }
  ]
}
```

### 2. API Route Caching (Cloudflare-Specific)

#### High-Frequency, Low-Change Data (Products, Facets)
```javascript
// Recommended headers
{
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
  'CDN-Cache-Control': 'public, s-maxage=300',
  'Cloudflare-CDN-Cache-Control': 'public, s-maxage=300'
}
```

#### Dynamic Data (Categories - when tree=true)
```javascript
// Keep no-cache for admin changes
{
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'CDN-Cache-Control': 'no-store'
}
```

#### User-Specific Data (Enquiries, Cart)
```javascript
// Private caching only
{
  'Cache-Control': 'private, no-cache, must-revalidate'
}
```

### 3. Image Optimization Strategy

#### Option A: Next.js Image Optimization (Recommended)
**Pros:**
- Built-in Next.js feature
- Automatic format selection (AVIF/WebP)
- Responsive images
- Lazy loading

**Configuration:**
```javascript
// next.config.js
images: {
  loader: 'custom',
  loaderFile: './lib/imageLoader.js',
  formats: ['image/avif', 'image/webp'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  minimumCacheTTL: 60, // Cache optimized images for 60s
}
```

**Custom Loader for Cloudflare:**
```javascript
// lib/imageLoader.js
export default function cloudflareLoader({ src, width, quality }) {
  const params = [`w_${width}`];
  if (quality) {
    params.push(`q_${quality}`);
  }
  const paramsString = params.join(',');
  return `${src}?${paramsString}`;
}
```

#### Option B: Cloudflare Images
**Pros:**
- Cloudflare-native solution
- Automatic optimization
- Global CDN

**Setup:**
1. Enable Cloudflare Images in dashboard
2. Use Cloudflare Images API for uploads
3. Use Cloudflare Images URLs in components

### 4. Page-Level Caching

#### Static Pages (Home, About, FAQs)
```javascript
// app/(main)/page.js
export const revalidate = 3600; // Revalidate every hour
export const dynamic = 'force-static'; // Force static generation
```

#### Dynamic Pages (Product Details, Catalog)
```javascript
// app/(main)/products/[slug]/page.js
export const revalidate = 300; // Revalidate every 5 minutes
export const dynamic = 'force-dynamic'; // Or use ISR
```

#### Admin Pages
```javascript
// app/admin/**/page.js
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```

### 5. Cloudflare-Specific Optimizations

#### Cloudflare Workers/Pages Configuration
```javascript
// wrangler.toml or Cloudflare Pages settings
[build]
command = "npm run build"

[[headers]]
for = "/_next/static/*"
[headers.values]
Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
for = "/api/products"
[headers.values]
Cache-Control = "public, s-maxage=300, stale-while-revalidate=600"

[[headers]]
for = "/api/categories"
[headers.values]
Cache-Control = "no-store, no-cache, must-revalidate"
```

#### Cloudflare Cache Rules (via Dashboard)
1. **Static Assets:**
   - Path: `/_next/static/*`
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 year

2. **API Routes:**
   - Path: `/api/products*`
   - Cache Level: Standard
   - Edge Cache TTL: 5 minutes
   - Browser Cache TTL: Respect Existing Headers

3. **Images:**
   - Path: `*.r2.dev/*` or your CDN domain
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 year

### 6. Image Optimization Best Practices

#### Pre-upload Optimization
**Location:** `lib/utils/imageOptimizer.js`
- ✅ Already implemented
- Max size: 550KB
- Max width: 1920px
- Format: WebP conversion
- Quality: 60-85% adaptive

#### Post-upload Optimization
1. **Use Next.js Image Component:**
```jsx
import Image from 'next/image';

<Image
  src={product.heroImage}
  alt={product.title}
  width={800}
  height={600}
  priority={isAboveFold}
  placeholder="blur" // If you have blur data
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>
```

2. **Lazy Loading:**
- Use `loading="lazy"` for below-fold images
- Use `priority` for above-fold images

3. **Responsive Images:**
- Use `sizes` attribute for proper responsive loading
- Next.js automatically generates srcset

### 7. Cache Invalidation Strategy

#### Manual Invalidation
```javascript
// When product is updated
await fetch('/api/products/invalidate', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});

// Cloudflare API call to purge cache
await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${CF_API_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    files: [`https://yourdomain.com/api/products/${productId}`]
  })
});
```

#### Automatic Invalidation
- Use `revalidate` in page exports
- Use `revalidatePath` in API routes after mutations
- Clear category cache after category updates (already implemented)

### 8. Monitoring Cache Performance

#### Metrics to Track
1. **Cache Hit Ratio:** Should be >80% for static assets
2. **API Response Times:** Should improve with caching
3. **Image Load Times:** Monitor with Web Vitals
4. **CDN Performance:** Cloudflare Analytics

#### Cloudflare Analytics
- Check Cache Hit Ratio in Cloudflare Dashboard
- Monitor bandwidth savings
- Track cache status headers

## Implementation Checklist

### Immediate Actions
- [ ] Add static asset caching headers in `next.config.js`
- [ ] Configure Cloudflare cache rules via dashboard
- [ ] Update API route cache headers for Cloudflare compatibility
- [ ] Test cache behavior in production

### Optimization Actions
- [ ] Implement custom image loader for Cloudflare
- [ ] Set up cache invalidation webhook
- [ ] Configure page-level revalidation
- [ ] Monitor and adjust cache TTLs based on usage

### Advanced Actions
- [ ] Consider Cloudflare Images for automatic optimization
- [ ] Implement edge caching for API routes
- [ ] Set up cache warming for popular pages
- [ ] Configure geo-based caching if needed

## Cache Headers Reference

### Static Assets (1 year)
```
Cache-Control: public, max-age=31536000, immutable
```

### API Data (5 minutes with stale-while-revalidate)
```
Cache-Control: public, s-maxage=300, stale-while-revalidate=600
CDN-Cache-Control: public, s-maxage=300
```

### Dynamic Data (no cache)
```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
```

### User-Specific Data (private)
```
Cache-Control: private, no-cache, must-revalidate
```

## Cloudflare-Specific Considerations

1. **Next.js on Cloudflare Pages:**
   - Uses Cloudflare Workers under the hood
   - Supports Edge Runtime
   - Image optimization requires custom setup

2. **R2 Storage:**
   - Already configured with 1-year cache
   - Served via Cloudflare CDN automatically
   - No additional configuration needed

3. **Cache Purging:**
   - Use Cloudflare API for programmatic purging
   - Can purge by URL, tag, or everything
   - Consider using cache tags for better control

4. **Edge Caching:**
   - Cloudflare automatically caches at edge
   - Respects Cache-Control headers
   - Can override with Cloudflare cache rules

## Performance Targets

- **Static Assets:** 100% cache hit rate
- **API Routes:** 70-80% cache hit rate
- **Images:** 90%+ cache hit rate
- **Page Load Time:** <2s with caching
- **Time to First Byte (TTFB):** <200ms from edge

## Troubleshooting

### Cache Not Working
1. Check Cloudflare cache rules
2. Verify Cache-Control headers in response
3. Check if route is marked as dynamic
4. Verify Cloudflare is in front of your app

### Stale Data Issues
1. Reduce cache TTL
2. Implement cache invalidation
3. Use stale-while-revalidate pattern
4. Check revalidation settings

### Image Optimization Issues
1. Verify Next.js Image config
2. Check R2 CORS settings
3. Ensure image URLs are accessible
4. Test with different image formats

