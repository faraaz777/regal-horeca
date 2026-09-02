# Taxonomy Menu Builder — Internal Architecture

## Purpose

Shopify-style menu builder for **Categories** (4 levels) and **Brands** (3 levels), with a **Classic** toggle so legacy UI can be removed later without scattered conditionals.

## Entry points

| Route | Page | Config |
|-------|------|--------|
| `/admin/categories` | `app/admin/categories/page.js` | `CATEGORY_TAXONOMY_CONFIG` |
| `/admin/brands` | `app/admin/brands/page.js` | `BRAND_TAXONOMY_CONFIG` |

Toggle key: `localStorage['regal.admin.taxonomy.ui']` → `classic` | `menu-builder` (default: `menu-builder`)

## Module map

```
lib/taxonomy/
  taxonomyConfig.js      — per-entity config (levels, APIs, fields)
  taxonomyTreeUtils.js   — O(n) tree build, flatten, search, slugify
  taxonomyValidation.js  — parent/level validation on reorder

components/admin/taxonomy/
  TaxonomyMenuBuilder.jsx   — main UI (search, DnD, inline add)
  TaxonomyMenuRow.jsx       — single sortable row
  TaxonomyEditPanel.jsx     — slide-over edit
  TaxonomyUiToggle.jsx      — classic / menu-builder switch
  hooks/useTaxonomyData.js  — fetch + optimistic CRUD + reorder
  hooks/useTaxonomyUiMode.js
  legacy/LegacyCategoriesView.jsx  — old table UI (deletable)
  legacy/LegacyBrandsView.jsx

app/api/admin/
  categories/route.js     — uncached flat/tree list
  brands/route.js         — uncached flat/tree list
  taxonomy/reorder/route.js — POST sibling reorder, PATCH batch move
```

## Data flow

1. **Load**: `GET /api/admin/{categories|brands}` → flat list → `buildTaxonomyMaps` → tree
2. **Create**: contextual parent/level → `POST /api/{categories|brands}` → optimistic upsert
3. **Edit**: slide-over → `PUT /api/{categories|brands}/:id`
4. **Delete**: `DELETE` + block if children exist
5. **Reorder**: drag among siblings or nest → `POST /api/admin/taxonomy/reorder` with `{ type, parentId, orderedIds }`

## Schema addition

`sortOrder: Number` on Category and Brand. Siblings sort by `sortOrder` then `name`. Existing rows default to `0`.

## Removing legacy (Phase 4)

1. Delete `components/admin/taxonomy/legacy/*`
2. Remove toggle from `page.js` — render `TaxonomyMenuBuilder` only
3. Delete `TaxonomyUiToggle.jsx` and `useTaxonomyUiMode.js`
4. Remove `TAXONOMY_UI_STORAGE_KEY` from config

## Not in scope yet

- ProductForm cascade → searchable `TaxonomyPicker` (Phase 3)
- Business Types (flat list, separate page)
