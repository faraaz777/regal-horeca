---
name: SEO Optimization Plan
overview: Comprehensive SEO improvements including metadata enhancements, structured data, technical SEO (sitemap, robots.txt), content optimization with industry keywords, and location-based SEO for Regal Horeca's B2B hospitality distribution business.
todos:
  - id: robots-txt
    content: Create robots.txt file with proper directives and sitemap reference
    status: pending
  - id: sitemap-generation
    content: Create dynamic sitemap.js that generates sitemap from products, categories, and pages
    status: pending
  - id: root-metadata
    content: Enhance app/layout.js with comprehensive metadata, Open Graph tags, and Twitter Cards
    status: pending
  - id: homepage-metadata
    content: Optimize homepage metadata in app/(main)/page.js with location keywords and brand names
    status: pending
  - id: about-metadata
    content: Add metadata export to app/(main)/about/page.js with company information
    status: pending
  - id: product-metadata
    content: Add generateMetadata function to product pages for dynamic SEO per product
    status: pending
  - id: organization-schema
    content: Add Organization JSON-LD schema to root layout with company details and locations
    status: pending
  - id: localbusiness-schema
    content: Add LocalBusiness schema to About page with all store and workshop locations
    status: pending
  - id: product-schema
    content: Add Product schema markup to product detail pages with pricing and details
    status: pending
    dependencies:
      - product-metadata
  - id: breadcrumb-schema
    content: Add BreadcrumbList schema to all pages for better navigation in search results
    status: pending
  - id: homepage-content
    content: Enhance homepage content with location mentions, brand names, and industry keywords
    status: pending
  - id: about-content
    content: Optimize About page content with detailed company info, locations, and clientele
    status: pending
---

# SEO Optimization Plan for Regal Horeca

## Overview

This plan addresses critical SEO gaps and optimizes content for search engines, focusing on HoReCa (Hotel, Restaurant, Café) B2B distribution keywords, location-based searches, and technical SEO fundamentals.

## Current State Analysis

**Existing:**

- Basic metadata on homepage (`app/(main)/page.js`)
- Generic root layout metadata (`app/layout.js`)
- About page exists but lacks metadata
- Product pages are client-side rendered (poor SEO)
- No sitemap.xml or robots.txt
- No structured data (JSON-LD schema)
- No Open Graph tags for social sharing

**Key Issues:**

- Generic metadata doesn't leverage business information
- Missing location-based keywords (Begum Bazar, Afzalgunj, Kuttur, Katedan, IDA Nacharam)
- No product-specific metadata
- Missing schema markup for Organization, Products, LocalBusiness
- No sitemap for search engine crawling

## Implementation Plan

### Phase 1: Technical SEO Fundamentals (High Priority)

#### 1.1 Create `robots.txt`

- File: `app/robots.txt`
- Allow all bots, disallow admin paths
- Reference sitemap location

#### 1.2 Create Dynamic Sitemap

- File: `app/sitemap.js` (Next.js 13+ dynamic sitemap)
- Include: Home, About, Catalog, Product pages, Category pages, Brand pages
- Auto-generate from database products/categories
- Set appropriate priorities and change frequencies

### Phase 2: Enhanced Metadata & Open Graph Tags

#### 2.1 Root Layout Metadata Enhancement (`app/layout.js`)

Update with comprehensive metadata:

- Title: Include "HoReCa", "Hotel Restaurant Café Equipment", "B2B Distributor"
- Description: 155-160 chars with key information (45+ years, locations, brands)
- Add Open Graph tags (og:title, og:description, og:image, og:type, og:url)
- Add Twitter Card tags
- Add canonical URL

#### 2.2 Homepage Metadata Optimization (`app/(main)/page.js`)

Enhance existing metadata with:

- Title: "Regal HoReCa - Premium Hospitality Supplies & Commercial Kitchen Equipment | B2B Distributor Since 1978"
- Description: Include key selling points (45+ years, 250+ staff, major brands, locations)
- Keywords: Add location-based keywords (Begum Bazar, Hyderabad), brand names, product categories

#### 2.3 About Page Metadata (`app/(main)/about/page.js`)

Add metadata export:

- Title: "About Regal Brass & Steelware - 45+ Years of HoReCa Excellence"
- Description: Company story, locations, clientele, specialties
- Include location keywords for local SEO

#### 2.4 Product Page Metadata (Critical)

- File: `app/(main)/products/[slug]/page.js`
- Convert to Server Component or add `generateMetadata` function
- Dynamic titles: "{Product Name} - {Brand} | Regal HoReCa"
- Dynamic descriptions: Include product details, specifications, use cases
- Product-specific keywords

#### 2.5 Catalog/Category Page Metadata

- File: `app/(main)/catalog/page.js`
- Dynamic metadata based on category filters
- Category-specific titles and descriptions

### Phase 3: Structured Data (JSON-LD Schema)

#### 3.1 Organization Schema (All Pages)

- Add to root layout or create component
- Include: name, logo, contact info, address, sameAs (social media)
- Location data for all workshops/stores

#### 3.2 LocalBusiness Schema (About/Contact Pages)

- Multiple locations schema for:
- Begum Bazar store (opposite Osmania Hospital)
- Afzalgunj store
- Workshops: Kuttur, Katedan, IDA Nacharam
- Include business hours, contact info, service area

#### 3.3 Product Schema (Product Pages)

- Product schema with:
- Name, description, image, brand, SKU
- Offers (price, availability, priceCurrency)
- AggregateRating (if reviews added later)
- Category breadcrumbs

#### 3.4 BreadcrumbList Schema (All Pages)

- Navigation breadcrumbs for better search result display
- Product pages: Home > Category > Subcategory > Product
- Catalog pages: Home > Category

#### 3.5 Website Schema (Homepage)

- SearchAction schema for Google site search
- Organization reference

### Phase 4: Content Optimization

#### 4.1 Homepage Content Enhancement

Update hero and key sections in `app/(main)/page.js`:

- Add location mentions: "Based in Hyderabad" or "Serving South India"
- Include brand names naturally: "Distributing Ariane, Pasabahce, Ocean, Hawkins, Prestige"
- Add industry-specific keywords: "commercial kitchen equipment", "hotel supplies", "restaurant equipment", "bulk orders"
- Include client testimonials or client names (if permitted)

#### 4.2 About Page Content

Enhance `components/about/About.jsx`:

- Add detailed company history (45+ years since 1978)
- Include all locations with addresses
- Mention clientele (5-star hotels, major restaurants)
- Add service areas (South India, pan-India)
- Include specialties: "Special biryani handis", "Brass and copper utensils", "PVD-coated items"

#### 4.3 Create Location-Specific Content

Consider adding:

- "Our Locations" section with detailed addresses
- Location-specific landing pages (if multiple cities)
- Service area information

#### 4.4 Product Category Descriptions

- Add descriptive content to category pages
- Include use cases, applications, industry standards
- Add "Why Choose [Product Category] from Regal Horeca"

### Phase 5: Keyword Strategy Implementation

#### Primary Keywords to Integrate:

- **Industry Terms**: HoReCa supplies, hospitality equipment, commercial kitchen equipment, hotel supplies, restaurant equipment, café supplies
- **Product Categories**: Biryani handis, brass utensils, copper cookware, PVD-coated items, hotelware, tableware, kitchenware, barware, catering supplies
- **Location-Based**: Begum Bazar hotel supplies, Hyderabad HoReCa distributor, South India hospitality equipment
- **Business Type**: B2B distributor, bulk orders, wholesale hospitality supplies
- **Brand Names**: Ariane distributor, Pasabahce dealer, Ocean products, Hawkins commercial
- **Specialties**: 5-star hotel equipment, commercial kitchen solutions, traditional brass cookware

### Phase 6: Additional SEO Enhancements

#### 6.1 Image Alt Text Optimization

- Ensure all product images have descriptive alt text
- Include product name, brand, category in alt text
- Location images: "Regal Horeca store Begum Bazar"

#### 6.2 Internal Linking Strategy

- Link to relevant categories from homepage
- Cross-link related products
- Link from About page to product categories
- Link from product pages to brand pages (if created)

#### 6.3 URL Structure

- Ensure clean, keyword-rich URLs
- Product URLs: `/products/[slug]` (should include product name)
- Category URLs: `/catalog?category=[slug]`

#### 6.4 Create Missing Pages (if needed)

- Brands listing page (mentioned in gaps analysis)
- Services page with detailed service offerings
- Contact page with location details and forms

### Phase 7: Performance & Technical

#### 7.1 Server-Side Rendering for Product Pages

- Convert product detail page from client component to server component
- Use `generateMetadata` for dynamic SEO
- Fetch product data server-side for initial HTML

#### 7.2 Canonical URLs

- Add canonical tags to prevent duplicate content
- Handle URL parameters properly (catalog filters)

## Files to Modify/Create

### New Files:

1. `app/robots.txt` - Robots directives
2. `app/sitemap.js` - Dynamic sitemap generation
3. `components/StructuredData.jsx` - Reusable schema markup component (optional)

### Files to Modify:

1. `app/layout.js` - Enhanced metadata, OG tags
2. `app/(main)/page.js` - Improved homepage metadata and content
3. `app/(main)/about/page.js` - Add metadata export
4. `app/(main)/products/[slug]/page.js` - Add generateMetadata, convert to SSR (if possible)
5. `components/about/About.jsx` - Enhanced content with keywords
6. `app/(main)/catalog/page.js` - Add dynamic metadata

## Priority Ranking

**Critical (Do First):**

1. robots.txt and sitemap.xml
2. Enhanced root layout metadata with OG tags
3. Product page metadata (generateMetadata)
4. Organization and LocalBusiness schema

**High Priority:**

5. Homepage metadata and content optimization
6. About page metadata and content enhancement
7. BreadcrumbList schema
8. Product schema markup

**Medium Priority:**

9. Catalog page metadata
10. Image alt text audit
11. Internal linking improvements

**Nice to Have:**

12. Location-specific pages
13. Services page
14. Blog/content section for ongoing SEO

## Expected SEO Improvements

- **Search Visibility**: Better rankings for HoReCa, hospitality equipment, and location-based searches
- **Click-Through Rate**: Rich snippets from schema markup
- **Indexing**: Sitemap helps Google discover all products
- **Local SEO**: LocalBusiness schema improves local search visibility
- **Social Sharing**: OG tags improve appearance on social platforms
- **B2B Search**: Keyword optimization targets business buyers

## Notes

- All metadata should be 50-60 chars (titles) and 150-160 chars (descriptions)
- Include location keywords naturally, don't stuff
- Brand names should be integrated naturally in content
- Maintain user experience while optimizing for SEO
- Test schema markup with Google's Rich Results Test
- Submit sitemap to Google Search Console after implementation