# REGAL® HoReCa — SEO Implementation Guide

## Step 7 — Content & On-Page SEO Templates

### Product Title Tag
```
{Product Name} | REGAL® HoReCa Hyderabad
```
Example: `Bain Marie 5 Litre Stainless Steel | REGAL® HoReCa Hyderabad`

### Product Meta Description
```
{Product name} - {Product type/category}. {Key benefit}. Commercial kitchen equipment for hotels, restaurants. REGAL® HoReCa Hyderabad. Enquiry for bulk orders.
```
Example: `Bain Marie 5 Litre - Commercial food warmer. Stainless steel, durable. For hotels, restaurants, catering. REGAL® HoReCa Hyderabad. Enquiry for bulk orders.`

### Category Title Tag
```
{Category Type} in Hyderabad | REGAL® HoReCa
```
Example: `Hotel Kitchen Equipment Hyderabad | REGAL® HoReCa`

### Category Meta Description
```
{Premium/category} supplies for {audience}. {Value prop}. REGAL® HoReCa - Hyderabad showroom. Over 45 years.
```
Example: `Hotel kitchen equipment & dining supplies. Tableware, cookware, buffet equipment. REGAL® HoReCa - Hyderabad. Over 45 years.`

### About Page SEO
- **Title:** `About REGAL® HoReCa - 45+ Years of Hospitality Excellence`
- **Description:** `REGAL HoReCa Hyderabad - Premium commercial kitchen equipment & hotel supplies. Our story, showroom, commitment to quality. 45+ years.`

---

## 20 High-Intent Keyword Targets

### Local (Hyderabad)
1. commercial kitchen equipment Hyderabad  
2. hotel supplies Hyderabad  
3. restaurant equipment Hyderabad  
4. catering equipment Hyderabad  
5. Regal Hyderabad  
6. kitchen equipment suppliers Hyderabad  

### Generic (Commercial / HoReCa)
7. commercial kitchen equipment  
8. hotel kitchen equipment  
9. restaurant supplies India  
10. HoReCa supplies  
11. commercial tableware  
12. industrial kitchen equipment  

### Product-Specific
13. bain marie  
14. chafing dish  
15. commercial oven  
16. buffet equipment  
17. hotel tableware  
18. commercial cookware  
19. bar equipment India  
20. hotel glassware  

---

## Step 8 — Verification Checklist

### Google Search Console
- [ ] Add property (www + non-www if applicable)
- [ ] Submit sitemap: `https://yourdomain.com/sitemap.xml`
- [ ] Inspect URLs: home, catalog, about, sample product, sample whom-we-serve
- [ ] Check Coverage report for errors
- [ ] Request indexing for priority pages

### Structured Data Testing
- [ ] [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Verify Organization + LocalBusiness on homepage
- [ ] Verify WebSite with SearchAction
- [ ] Verify Product schema on product pages
- [ ] Verify FAQ schema on homepage
- [ ] Verify BreadcrumbList on product pages

### Lighthouse SEO Audit
- [ ] Run Lighthouse (Chrome DevTools > Lighthouse > SEO)
- [ ] Ensure score ≥ 90
- [ ] Fix: meta descriptions, tap targets, heading order

### Manual Verification
- [ ] Canonical URLs present and correct
- [ ] Open Graph tags (test with [opengraph.xyz](https://www.opengraph.xyz/))
- [ ] Twitter cards
- [ ] `robots.txt` accessible at `/robots.txt`
- [ ] Sitemap accessible at `/sitemap.xml`
- [ ] No `noindex` on indexable pages

---

## Brand Ranking Strategy for "REGAL"

### Goal
Help Google associate "REGAL" with REGAL® HoReCa (hospitality supplies), not cinemas or other brands.

### On-Site Tactics (Implemented)
- REGAL® in logo `alt`, header, structured data
- Dedicated `/regal` brand page
- Brand/Entity section on homepage
- Consistent NAP (Name, Address, Phone) in footer
- REGAL in meta titles and descriptions
- WebSite schema with brand info

### Off-Page Checklist (No Code)

#### 1. Google Business Profile
- [ ] Create/claim profile as "REGAL HoReCa" or "Regal Brass & Steelware"
- [ ] Add address: Tolichowki / Hakeempet X Road, Hyderabad
- [ ] Add phone, website URL
- [ ] Add categories: Kitchen Equipment Supplier, Restaurant Supply Store
- [ ] Add photos: showroom, products
- [ ] Post updates regularly

#### 2. Citations
- [ ] JustDial  
- [ ] IndiaMART  
- [ ] TradeIndia  
- [ ] Sulekha  
- [ ] Yellow Pages India  

#### 3. Press & PR
- [ ] Press release: "REGAL HoReCa expands..." (local news)
- [ ] Industry publications: hospitality, F&B
- [ ] Maintain consistent NAP everywhere

#### 4. YouTube
- [ ] Channel name: REGAL HoReCa
- [ ] Brand-consistent thumbnails and descriptions
- [ ] Link to website in every video

#### 5. Backlinks
- [ ] Local Hyderabad directories
- [ ] Industry associations (FSSAI, hotel associations)
- [ ] Partner/vendor pages (hotels, restaurants you supply)
- [ ] Trade show / event listings

---

## File Summary

### New Files
- `lib/constants/seo.js` — NAP, SITE_CONFIG, social links  
- `lib/constants/whomWeServe.js` — Whom-we-serve slugs & meta  
- `lib/constants/faqs.js` — FAQ content (shared)  
- `lib/utils/getProductBySlug.js` — Server-side product fetch  
- `lib/utils/getProductSlugs.js` — Sitemap product slugs  
- `lib/utils/structuredData.js` — JSON-LD generators  
- `app/sitemap.js` — Dynamic sitemap  
- `app/robots.js` — Robots.txt  
- `app/(main)/regal/page.js` — Brand page  
- `app/(main)/products/[slug]/layout.js` — Product metadata + JSON-LD  
- `app/(main)/whom-we-serve/[slug]/layout.js` — Whom-we-serve metadata  
- `app/(main)/enquiry/layout.js` — Enquiry metadata  
- `app/(main)/wishlist/layout.js` — Wishlist metadata  

### Modified Files
- `app/layout.js` — metadataBase, keywords, OG, JSON-LD scripts  
- `app/(main)/page.js` — metadata, FAQ schema, brand section  
- `app/(main)/catalog/page.js` — metadata  
- `app/(main)/about/page.js` — metadata  
- `app/(main)/catalog/CatalogPageClient.jsx` — H1, breadcrumbs  
- `app/(main)/faqs/FAQs.jsx` — use shared FAQ_ITEMS  
- `components/Footer.jsx` — NAP, REGAL® Brand link  
- `components/Header.jsx` — alt text  
- `components/LoadingPage.jsx` — alt text  
- `components/WhyChooseUs.jsx` — alt text  
