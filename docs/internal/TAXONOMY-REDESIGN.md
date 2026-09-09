# Taxonomy Menu Builder

Shopify-style nested menu for **Categories** (4 levels) and **Brands** (3 levels). This is the only admin UI — the old table + modal (“Classic”) view has been removed.

## Entry points

| Route | Page | Config |
|-------|------|--------|
| `/admin/categories` | `app/admin/categories/page.js` | `CATEGORY_TAXONOMY_CONFIG` |
| `/admin/brands` | `app/admin/brands/page.js` | `BRAND_TAXONOMY_CONFIG` |

Both pages render `TaxonomyAdminPage`. Entity differences live in config, not in page JSX.

## Module map

```
lib/taxonomy/
  taxonomyConfig.js        — levels, APIs, fields per entity
  taxonomyTreeUtils.js     — tree build, flatten, search, sibling slots
  taxonomyValidation.js    — parent/level checks on reorder

components/admin/taxonomy/
  TaxonomyAdminPage.jsx    — page chrome (title + builder)
  TaxonomyMenuBuilder.jsx  — list composition
  TaxonomyToolbar.jsx      — search, expand/collapse
  TaxonomyMenuRow.jsx      — sortable row
  TaxonomySameLevelAddRow.jsx
  TaxonomyRootAdd.jsx      — add top-level department
  TaxonomyEditPanel.jsx    — slide-over edit
  TaxonomyAddContext.jsx
  TaxonomyLevelBadge.jsx
  TaxonomyRowShell.jsx
  TaxonomyTreeIndent.jsx
  taxonomyMenuLayout.js
  uploadTaxonomyImage.js
  hooks/
    useTaxonomyData.js         — fetch + optimistic CRUD + reorder
    useTaxonomySearch.js       — debounce, auto-expand, filter
    useTaxonomyDragReorder.js  — sibling reorder + nest-on-drop
    useTaxonomyPermissions.js  — super_admin delete only

app/api/admin/
  categories/route.js
  brands/route.js
  taxonomy/reorder/route.js
```

## Data flow

1. **Load**: `GET /api/admin/{categories|brands}` → flat list → tree
2. **Create**: contextual parent/level → `POST /api/{categories|brands}` → optimistic upsert
3. **Edit**: slide-over → `PUT /api/{categories|brands}/:id`
4. **Delete**: `DELETE` — Super Admin only; blocked if children exist
5. **Reorder**: drag among siblings or nest → `POST /api/admin/taxonomy/reorder`

## Schema

`sortOrder: Number` on Category and Brand. Siblings sort by `sortOrder` then `name`. Existing rows default to `0`. Drag-and-drop writes order to the DB.

## Not in scope

- ProductForm cascade → searchable `TaxonomyPicker`
- Business Types (flat list, separate page)
