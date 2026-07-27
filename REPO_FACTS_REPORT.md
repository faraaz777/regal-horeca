# Regal Horeca - Repository Facts Report
*Generated for ChatGPT Project Proposal / Delivery Pack*

---

## 1. Stack & Architecture

### Framework & Language
| Item | Value | File/Evidence |
|------|-------|---------------|
| Framework | **Next.js 14** (App Router) | `package.json` line 18: `"next": "^14.2.0"` |
| Language | **JavaScript (JSX)** | All components use `.js`/`.jsx` extensions |
| React | 18.3.0 | `package.json` line 19: `"react": "^18.3.0"` |

### Styling & UI
| Item | Value | File/Evidence |
|------|-------|---------------|
| CSS Framework | **Tailwind CSS 3.4.4** | `package.json` line 36, `tailwind.config.js` |
| UI Library | **None** (custom components) | No MUI/shadcn/Chakra dependencies |
| Icons | **Lucide React** | `package.json` line 16: `"lucide-react": "^0.556.0"` |
| Font | Montserrat | `app/globals.css` line 6 |
| Notifications | react-hot-toast | `package.json` line 21 |

### State Management & Data Fetching
| Item | Value | File/Evidence |
|------|-------|---------------|
| State Management | **React Context API** | `context/AppContext.jsx` |
| Data Fetching | **SWR + fetch** | `package.json` line 23: `"swr": "^2.3.6"` |
| Database | MongoDB with Mongoose | `lib/db/connect.js`, `lib/models/*.js` |
| File Storage | Cloudflare R2 (S3-compatible) | `lib/utils/r2Upload.js`, `@aws-sdk/client-s3` |

### Folder Structure
```
app/
├── (main)/           # Public pages (Home, Catalog, Products, etc.)
│   ├── page.js       # Home page
│   ├── layout.js     # Header/Footer layout wrapper
│   ├── about/        # About page
│   ├── catalog/      # Product listing
│   ├── products/[slug]/ # Product detail (dynamic)
│   ├── enquiry/      # Enquiry form
│   ├── wishlist/     # Wishlist page
│   └── whom-we-serve/[slug]/ # Business type pages
├── admin/            # Admin dashboard pages
│   ├── dashboard/
│   ├── products/
│   ├── categories/
│   ├── brands/
│   ├── business-types/
│   └── enquiries/
├── api/              # Next.js API routes
│   ├── products/
│   ├── categories/
│   ├── brands/
│   ├── business-types/
│   ├── enquiries/
│   ├── upload/
│   └── admin/
├── globals.css
└── layout.js         # Root layout with AppProvider

components/
├── Header.jsx
├── Footer.jsx
├── ProductCard.jsx
├── ProductCardSkeleton.jsx
├── ProductGallery.jsx
├── ProductForm.jsx
├── CartDrawer.jsx
├── AiAssistant.jsx
├── Icons.jsx
├── ErrorBoundary.jsx
├── new/
│   ├── WhomWeServe.jsx
│   ├── SearchBar.jsx
│   └── FeaturedProducts.jsx
└── about/
    ├── Hero.jsx
    ├── Stats.jsx
    ├── About.jsx
    ├── Features.jsx
    ├── Partners.jsx
    ├── Ventures.jsx
    └── Locations.jsx

context/
└── AppContext.jsx    # Global state (products, categories, cart, wishlist)

lib/
├── db/connect.js     # MongoDB connection
├── models/           # Mongoose schemas
│   ├── Product.js
│   ├── Category.js
│   ├── Brand.js
│   ├── BusinessType.js
│   ├── Enquiry.js
│   ├── EnquiryItem.js
│   ├── EnquiryMessage.js
│   └── Customer.js
├── utils/
│   ├── whatsapp.js
│   ├── r2Upload.js
│   ├── slug.js
│   ├── categoryCache.js
│   ├── imageOptimizer.js
│   ├── aiPromptBuilder.js
│   └── auth.js
└── hooks/
    └── useSWRConfig.js

hooks/
└── useProductFilters.js  # URL-synced filter logic
```

---

## 2. Route Map

| URL Route | Page File Path | Purpose | Status |
|-----------|---------------|---------|--------|
| `/` | `app/(main)/page.js` | Home page with hero slider, categories, featured products | **Implemented** |
| `/catalog` | `app/(main)/catalog/page.js` | Product listing with filters | **Implemented** |
| `/catalog?category={slug}` | `app/(main)/catalog/page.js` | Category-filtered products | **Implemented** |
| `/catalog?business={slug}` | `app/(main)/catalog/page.js` | Business type filtered products | **Implemented** |
| `/catalog?search={query}` | `app/(main)/catalog/page.js` | Search results | **Implemented** |
| `/products/[slug]` | `app/(main)/products/[slug]/page.js` | Product detail page | **Implemented** |
| `/about` | `app/(main)/about/page.js` | About Us page | **Implemented** |
| `/enquiry` | `app/(main)/enquiry/page.js` | Enquiry/RFQ form | **Implemented** |
| `/wishlist` | `app/(main)/wishlist/page.js` | Wishlist page | **Implemented** |
| `/whom-we-serve/[slug]` | `app/(main)/whom-we-serve/[slug]/page.js` | Business type landing pages | **Implemented** |
| `/contact` | - | Contact page | **Missing** |
| `/faq` | - | FAQ page | **Missing** |
| `/brands` | - | Brands listing page | **Missing** |
| `/services` | - | Services page | **Missing** |
| `/projects` | - | Projects/Portfolio page | **Missing** |
| `/testimonials` | - | Testimonials page | **Missing** |
| `/news` | - | News page | **Missing** |
| `/blog` | - | Blog listing page | **Missing** |
| `/blog/[slug]` | - | Blog detail page | **Missing** |
| `/resources` | - | Resources/Downloads page | **Missing** |
| `/careers` | - | Careers page | **Missing** |
| `/register` | - | User registration page | **Missing** |
| `/franchise` | - | Franchise inquiry page | **Missing** |
| `/admin/dashboard` | `app/admin/dashboard/page.js` | Admin dashboard | **Implemented** |
| `/admin/products` | `app/admin/products/page.js` | Admin product list | **Implemented** |
| `/admin/products/add` | `app/admin/products/add/page.js` | Add new product | **Implemented** |
| `/admin/categories` | `app/admin/categories/page.js` | Category management | **Implemented** |
| `/admin/brands` | `app/admin/brands/page.js` | Brand management | **Implemented** |
| `/admin/business-types` | `app/admin/business-types/page.js` | Business type management | **Implemented** |
| `/admin/enquiries` | `app/admin/enquiries/page.js` | Enquiry list | **Implemented** |
| `/admin/enquiries/[id]` | `app/admin/enquiries/[id]/page.js` | Enquiry detail | **Implemented** |

---

## 3. Home Page Sections Coverage

| Section | Component | File Path | Imported In | Status |
|---------|-----------|-----------|-------------|--------|
| Hero Slider | Built-in (slides array) | `app/(main)/page.js` (lines 19-81) | Same file | **Implemented** |
| Category Tiles | Built-in (mainCategories) | `app/(main)/page.js` (lines 291-323) | Same file | **Implemented** |
| Featured Products | `ProductCard` | `components/ProductCard.jsx` | `app/(main)/page.js` | **Implemented** |
| New Arrivals | `ProductCard` | `components/ProductCard.jsx` | `app/(main)/page.js` | **Implemented** |
| Whom We Serve | `WhomWeServe` | `components/new/WhomWeServe.jsx` | `app/(main)/page.js` | **Implemented** |
| About Teaser | Built-in | `app/(main)/page.js` (lines 401-418) | Same file | **Implemented** |
| Metrics Strip | - | - | - | **Missing** (only in About page) |
| Services/Specializations | - | - | - | **Missing** |
| Brands/Clients Carousel | - | - | - | **Missing** |
| Contact/Map Section | - | - | - | **Missing** |
| Footer Gallery | - | - | - | **Missing** |
| Footer | `Footer` | `components/Footer.jsx` | `app/(main)/layout.js` | **Implemented** |

---

## 4. Catalogue & Taxonomy Summary

### A) Taxonomy Model

| Aspect | Details | File Path |
|--------|---------|-----------|
| **Storage** | MongoDB Database (Mongoose) | `lib/models/Category.js`, `lib/models/Brand.js` |
| **Hierarchy Levels** | `department` → `category` → `subcategory` → `type` | `lib/models/Category.js` line 27 |
| **Parent Reference** | `parent` field (ObjectId ref to self) | `lib/models/Category.js` line 33 |
| **Business Types** | Separate model (Hotels, Restaurants, Cafes, etc.) | `lib/models/BusinessType.js` |

**Data Structure:**
```javascript
// Category Schema (lib/models/Category.js)
{
  name: String,           // "Tableware"
  slug: String,           // "tableware"
  level: enum ['department', 'category', 'subcategory', 'type'],
  parent: ObjectId,       // Reference to parent category
  image: String,
  tagline: String
}

// Product Category Assignment (lib/models/Product.js)
{
  categoryId: ObjectId,       // Primary category (backward compat)
  categoryIds: [ObjectId],    // Multiple categories
  businessTypeSlugs: [String] // "hotels", "restaurants", etc.
}
```

**How to Extend:**
1. Add new categories via Admin → `/admin/categories`
2. API: `POST /api/categories` with `{ name, slug, level, parent }`
3. Products linked via `categoryId` or `categoryIds` array

### B) Product Listing & Filters

| Aspect | Details | File Path |
|--------|---------|-----------|
| **Listing Page** | `app/(main)/catalog/page.js` | Full faceted navigation |
| **Filter Logic** | `hooks/useProductFilters.js` | URL state synced |
| **Facets API** | `app/api/products/facets/route.js` | Server-side aggregation |
| **Filter Mode** | **Hybrid** (context from API, filtering client-side) | - |

**Filter Fields Supported:**
| Filter | Source | Status |
|--------|--------|--------|
| Category | `categoryId`/`categoryIds` | **Implemented** |
| Business Type | `businessTypeSlugs` | **Implemented** |
| Price Range | `price` | **Implemented** |
| Brand | `brand` | **Implemented** |
| Color | `colorVariants[].colorName` | **Implemented** |
| Dynamic Filters (Material, Size, etc.) | `filters[]` array | **Implemented** |
| Search (title, brand, tags) | Text search | **Implemented** |
| Status | `status` field | **Partial** (in model, not sidebar) |
| Dimensions | - | **Missing** |
| Availability | `status` enum | **Partial** |

**Filter Options Source:** Backend API `/api/products/facets` aggregates available options from current product set.

---

## 5. Product Type Page Checklist

| Feature | Component/Section | File Path | Status |
|---------|-------------------|-----------|--------|
| Breadcrumb | Built-in `getCategoryPath()` | `app/(main)/products/[slug]/page.js` (lines 112-131) | **Implemented** |
| Product Gallery | `ProductGallery` | `components/ProductGallery.jsx` | **Implemented** |
| Title & Brand | Built-in | `app/(main)/products/[slug]/page.js` (lines 259-264) | **Implemented** |
| Price Display | `formatPrice()` | `app/(main)/products/[slug]/page.js` (lines 183-191) | **Implemented** |
| Short Description | `product.summary` | `app/(main)/products/[slug]/page.js` (line 277) | **Implemented** |
| Color Variants | Built-in with images swap | `app/(main)/products/[slug]/page.js` (lines 281-319) | **Implemented** |
| Quantity Selector | Built-in | `app/(main)/products/[slug]/page.js` (lines 323-339) | **Implemented** |
| **CTA: Add to Cart** | `handleAddToCart()` | `app/(main)/products/[slug]/page.js` (lines 150-162) | **Implemented** |
| **CTA: Buy Now (WhatsApp)** | `handleBuyNow()` | `app/(main)/products/[slug]/page.js` (lines 164-168) | **Implemented** |
| **CTA: Add to Wishlist** | `handleWishlistToggle()` | `app/(main)/products/[slug]/page.js` (lines 142-148) | **Implemented** |
| **CTA: Share** | `navigator.share()` | `app/(main)/products/[slug]/page.js` (lines 379-392) | **Implemented** |
| **Tab: Description** | Built-in | `app/(main)/products/[slug]/page.js` (lines 432-450) | **Implemented** |
| **Tab: Specifications** | Built-in table | `app/(main)/products/[slug]/page.js` (lines 453-470) | **Implemented** |
| Tab: Enquiry | - | - | **Missing** (uses Buy Now WhatsApp) |
| Tab: Reviews | - | - | **Missing** |
| Tab: Shipping | - | - | **Removed** (per user request) |
| Related Products | Built-in | `app/(main)/products/[slug]/page.js` (lines 486-494) | **Implemented** |
| AI Assistant | `AiAssistant` | `components/AiAssistant.jsx` | **Implemented** |
| Key Facts Block | - | - | **Missing** (features shown in Description tab) |
| SKU Display | `product.sku` | Available in model, not displayed | **Partial** |

---

## 6. Enquiry/RFQ Flow Summary

### Storage & Flow
| Aspect | Details | File Path |
|--------|---------|-----------|
| **Cart Storage** | `localStorage` (`regal_cart`) | `context/AppContext.jsx` line 26 |
| **Wishlist Storage** | `localStorage` (`regal_wishlist`) | `context/AppContext.jsx` line 24 |
| **Cart State** | React Context (`cart`, `addToCart`, etc.) | `context/AppContext.jsx` lines 173-311 |
| **Enquiry Page** | `/enquiry` | `app/(main)/enquiry/page.js` |
| **API Endpoint** | `POST /api/enquiries` | `app/api/enquiries/route.js` |
| **WhatsApp Integration** | Opens WhatsApp with pre-filled message | `lib/utils/whatsapp.js` |

### Cart Item Structure
```javascript
// Cart item (stored in localStorage)
{
  productId: string,
  quantity: number,
  selectedColor: {
    colorName: string,
    colorHex: string,
    images: string[]
  } | null,
  price: number | null
}
```

### Enquiry Payload (POST /api/enquiries)
```javascript
{
  name: string,           // Required
  email: string,          // Required  
  phone: string,          // Required
  company: string,        // Optional
  state: string,          // Optional (required in whom-we-serve form)
  categories: string[],   // Optional, multi-select
  message: string,        // Optional
  cartItems: [            // Optional (from cart)
    {
      productId: string,
      productName: string,
      quantity: number
    }
  ]
}
```

### Submission Flow
1. User fills form at `/enquiry` or `/whom-we-serve/[slug]`
2. Form validates required fields (name, email, phone)
3. `POST /api/enquiries` saves to MongoDB:
   - Links/creates Customer record
   - Creates Enquiry with CRM fields (status, priority, etc.)
   - Creates EnquiryItem records for cart products
4. Opens WhatsApp Business with formatted message
5. Toast notification shown

### Validation Rules
- Name, Email, Phone: **Required**
- Email format: Regex validation in Enquiry model
- Cart items: Optional, automatically included if present
- Message: Optional

### Success/Failure Handling
- Success: Toast "Enquiry submitted successfully!", opens WhatsApp, resets form
- Failure: Toast with error message, form preserved

---

## 7. Forms/SEO/Analytics Summary

### Contact Form
| Aspect | Status | Details |
|--------|--------|---------|
| Route | **Missing** | No `/contact` page exists |
| Component | **Missing** | - |
| Submit Destination | - | - |

### Newsletter/Register
| Aspect | Status | Details |
|--------|--------|---------|
| Newsletter signup | **Missing** | Not implemented |
| User registration | **Missing** | No `/register` page |

### WhatsApp CTA
| Aspect | Details | File Path |
|--------|---------|-----------|
| Configuration | Environment variable | `NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER` |
| Default Number | `917893960311` | `lib/utils/whatsapp.js` line 12 |
| Link Generator | `getWhatsAppBusinessLink(message)` | `lib/utils/whatsapp.js` |
| Usage | Product page "Buy Now", Enquiry form submission | Multiple pages |

### Analytics
| Item | Status | Details |
|------|--------|---------|
| Google Analytics | **Missing** | No GA/gtag implementation found |
| Meta/Facebook Pixel | **Missing** | No pixel implementation found |
| Custom Events | **Missing** | No event tracking |
| Cookie Consent | **Missing** | No consent banner |

### SEO
| Item | Status | File Path/Details |
|------|--------|-------------------|
| Metadata | **Basic** | `app/layout.js` - title, description only |
| OG Tags | **Missing** | No Open Graph tags |
| sitemap.xml | **Missing** | No sitemap file |
| robots.txt | **Missing** | No robots file |
| Canonical URLs | **Missing** | Not implemented |
| Schema Markup | **Missing** | No JSON-LD structured data |
| Dynamic Meta | **Missing** | Product pages use static metadata |

### Performance
| Item | Status | File Path/Details |
|------|--------|-------------------|
| Image Optimization | **Implemented** | `next/image`, Sharp, AVIF/WebP formats |
| Lazy Loading | **Implemented** | Next.js Image default behavior |
| Image Remote Patterns | **Implemented** | `next.config.js` (lines 13-34) |
| API Caching | **Implemented** | Cache-Control headers in API routes |
| Standalone Output | **Implemented** | `next.config.js` line 75 |

---

## 8. Theme Tokens

### Colors (from `tailwind.config.js`)

| Token Name | HEX Value | Usage |
|------------|-----------|-------|
| `white` | `#FFFFFF` | Backgrounds, text |
| `black` | `#000000` | Primary text, borders |
| `accent` | `#EE4023` | **Primary brand color** - CTAs, highlights, hover states |
| `primary` | `#000000` | Alias for black (legacy) |
| `primary-700` | `#000000` | Alias for black (legacy) |
| `secondary` | `#000000` | Alias for black (legacy) |
| `medium` | `#e5e5e5` | Borders, dividers |
| `light` | `#f5f5f5` | Light backgrounds |
| `brand-orange` | `#EE4023` | Alias for accent |
| `regal-orange` | `#EE4023` | Alias for accent |
| `regal-black` | `#000000` | Alias for black |

### Additional Colors (from CSS/Components)

| Color | HEX/Class | Usage Location |
|-------|-----------|----------------|
| Green (WhatsApp) | `green-500` (#22c55e) | WhatsApp buttons |
| Blue (Cart dropdown) | `blue-50`, `blue-200` | Cart/Enquiry dropdowns |
| Brown (Whom We Serve) | `#3D2314` | Inactive button background |
| Gray text | `black/60`, `black/70` | Secondary text |

### Usage Examples
```javascript
// Buttons (accent)
"bg-accent text-white hover:bg-accent/90"
"border-accent text-accent hover:bg-accent/5"

// Headers/Text (black)
"text-black font-bold"
"text-black/70" // 70% opacity black

// Backgrounds
"bg-white"
"bg-black" // Footer
"bg-light" // Light sections
```

---

## 9. Deployment & Env Vars

### Build Scripts (`package.json`)
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

### Hosting Configuration
| Aspect | Value | Source |
|--------|-------|--------|
| Output Mode | **Standalone** | `next.config.js` line 75 |
| Recommended Host | **Vercel** | `README.md`, `DEPLOYMENT.md` |
| Alternative Hosts | Netlify, Railway, AWS Amplify | `DEPLOYMENT.md` |

### Environment Variables (KEYS only)
```env
# Required
MONGODB_URI                         # MongoDB connection string
R2_ACCOUNT_ID                       # Cloudflare R2 account
R2_ACCESS_KEY_ID                    # R2 access key
R2_SECRET_ACCESS_KEY                # R2 secret
R2_BUCKET_NAME                      # R2 bucket name
R2_PUBLIC_URL                       # R2 public URL
R2_ENDPOINT                         # R2 endpoint URL
ADMIN_EMAIL                         # Admin login email
ADMIN_PASSWORD                      # Admin login password
JWT_SECRET                          # JWT signing secret
NEXT_PUBLIC_APP_URL                 # Application base URL
NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER # WhatsApp number

# Optional
GOOGLE_GENERATIVE_AI_API_KEY        # For AI descriptions
```

### Security Headers (`next.config.js`)
- X-DNS-Prefetch-Control: on
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- Referrer-Policy: origin-when-cross-origin

---

## 10. Top 20 Gaps/TODOs

*Ranked by Risk/Impact (High → Low)*

| # | Gap | Category | Risk | Impact | Notes |
|---|-----|----------|------|--------|-------|
| 1 | **sitemap.xml missing** | SEO | 🔴 High | SEO crawling severely impacted | Critical for Google indexing |
| 2 | **robots.txt missing** | SEO | 🔴 High | Search engines can't understand site structure | Easy fix |
| 3 | **Contact page missing** | Pages | 🔴 High | No way to contact company | Basic business requirement |
| 4 | **Google Analytics missing** | Analytics | 🔴 High | No traffic/conversion tracking | Business intelligence gap |
| 5 | **OG/Meta tags missing** | SEO | 🟠 Medium | Poor social sharing appearance | Affects social traffic |
| 6 | **FAQ page missing** | Pages | 🟠 Medium | Listed in nav, returns 404 | User experience issue |
| 7 | **Dynamic product metadata** | SEO | 🟠 Medium | All products share same title/description | SEO ranking impact |
| 8 | **Schema markup (JSON-LD)** | SEO | 🟠 Medium | No rich snippets in search results | Competitive disadvantage |
| 9 | **Brands page missing** | Pages | 🟠 Medium | Brand taxonomy exists but no listing page | Feature incomplete |
| 10 | **Cookie consent missing** | Legal | 🟠 Medium | GDPR/privacy compliance risk | Legal requirement |
| 11 | **Services page missing** | Pages | 🟡 Low | Part of typical HoReCa site | Content gap |
| 12 | **Projects/Portfolio page** | Pages | 🟡 Low | Common for B2B businesses | Trust building |
| 13 | **Testimonials page** | Pages | 🟡 Low | Social proof missing | Conversion optimization |
| 14 | **News/Blog section** | Pages | 🟡 Low | Content marketing opportunity | SEO content gap |
| 15 | **User registration/login** | Features | 🟡 Low | No customer accounts | Repeat customer experience |
| 16 | **Resources/Downloads** | Pages | 🟡 Low | No catalogs/brochures section | B2B standard feature |
| 17 | **Careers page missing** | Pages | 🟡 Low | Employer branding | HR requirement |
| 18 | **Franchise page missing** | Pages | 🟡 Low | Business expansion | Growth opportunity |
| 19 | **Product reviews system** | Features | 🟡 Low | No customer reviews | Trust/SEO impact |
| 20 | **Admin authentication** | Security | 🟡 Low | Currently disabled (public access) | Security concern |

### Quick Wins (Can implement in < 1 day each)
1. Add `sitemap.xml` generation
2. Add `robots.txt`
3. Add basic metadata to product pages
4. Add Google Analytics script
5. Create Contact page with form
6. Create FAQ page with accordion

### Medium Effort (1-3 days each)
1. Implement OG tags with dynamic images
2. Add JSON-LD schema markup
3. Create Brands listing page
4. Add cookie consent banner
5. Create Services page

### Larger Initiatives (> 1 week)
1. Blog/News system with CMS
2. User registration and accounts
3. Full reviews/ratings system
4. Careers portal with applications

---

## Summary

### What's Working Well ✅
- Core e-commerce catalog functionality
- Product filtering and search
- Cart and wishlist (localStorage)
- Enquiry/RFQ flow with WhatsApp integration
- Admin dashboard for CRUD operations
- Responsive design with Tailwind
- Image optimization with R2/Cloudflare
- Hierarchical category taxonomy
- Business type segmentation ("Whom We Serve")

### Critical Gaps 🔴
- SEO fundamentals (sitemap, robots, meta tags, schema)
- Analytics integration
- Missing key pages (Contact, FAQ, Brands)
- Cookie consent for compliance

### Architecture Strengths
- Clean Next.js 14 App Router structure
- Proper separation of concerns
- MongoDB with well-indexed schemas
- Reusable component library
- URL-synced filter state

---

*Report generated from repository analysis. No external documentation consulted.*

