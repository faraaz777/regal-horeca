# Cleanup Guide: Remove Old React/Vite Files

## ✅ Safe to Delete

The following files and folders are from the old React Router/Vite setup and are **NOT needed** in Next.js:

### 1. **`pages/` folder** ❌ DELETE
All pages have been migrated to Next.js App Router in `app/`:
- `pages/HomePage.tsx` → `app/(main)/page.js`
- `pages/CatalogPage.tsx` → `app/(main)/catalog/page.js`
- `pages/ProductDetailPage.tsx` → `app/(main)/products/[slug]/page.js`
- `pages/WishlistPage.tsx` → `app/(main)/wishlist/page.js`
- `pages/AdminLoginPage.tsx` → `app/admin/login/page.js`
- `pages/AdminDashboardPage.tsx` → `app/admin/dashboard/page.js`
- `pages/AdminProductsPage.tsx` → `app/admin/products/page.js`
- `pages/AdminAddProductPage.tsx` → `app/admin/products/add/page.js`
- `pages/AdminCategoriesPage.tsx` → `app/admin/categories/page.js`

### 2. **`App.tsx`** ❌ DELETE
- Old React Router entry point
- Next.js uses `app/layout.js` instead

### 3. **`index.tsx`** ❌ DELETE
- Old React entry point
- Next.js handles this automatically

### 4. **`index.html`** ❌ DELETE
- Old Vite HTML entry point
- Next.js generates HTML automatically

### 5. **`vite.config.ts`** ❌ DELETE
- Vite configuration
- Next.js uses `next.config.js` instead

## ✅ Keep These Files

- `app/` - Next.js App Router (all pages here)
- `components/` - React components (converted to JSX)
- `context/` - React Context providers
- `lib/` - Utilities, models, database
- `public/` - Static assets
- `package.json` - Dependencies (updated for Next.js)
- `next.config.js` - Next.js configuration
- `tailwind.config.js` - Tailwind CSS config
- `middleware.js` - Next.js middleware

## 🗑️ Quick Cleanup Command

You can delete these files/folders:

```bash
# Delete old pages folder
rm -rf pages/

# Delete old entry files
rm App.tsx
rm index.tsx
rm index.html
rm vite.config.ts
```

Or manually delete:
- `pages/` folder (entire folder)
- `App.tsx`
- `index.tsx`
- `index.html`
- `vite.config.ts`

## ✅ Verification

After deletion, your project structure should be:

```
├── app/                    # Next.js App Router ✅
├── components/             # React components ✅
├── context/                # Context providers ✅
├── lib/                    # Utilities & models ✅
├── public/                 # Static assets ✅
├── package.json            # Next.js dependencies ✅
├── next.config.js          # Next.js config ✅
└── ...other config files
```

## ⚠️ Note

- The `data/mockData.ts` file might still be referenced for initial data seeding, but it's not needed for runtime (data comes from MongoDB)
- All functionality now uses the Next.js App Router structure
- No files in `pages/` are being used anymore

