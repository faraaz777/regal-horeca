# Inventory Location Hierarchy Search — Future Specification

**Status:** Planned (not implemented)  
**Created:** 2026-07-11  
**Scope:** Upgrade existing Branch → Floor → Rack selector into a hierarchy-aware universal location search  
**Constraint:** Extend existing implementation safely and modularly. Do **not** replace location hierarchy, APIs, permission model, or locator business logic.

---

## 1. Existing Architecture Assessment

### Current hierarchy

```
Branch → Floor → Rack
```

Stock remains ledger-based at rack level. Layout stores spatial metadata only (zones, canvas positions).

### Current UI (as of spec date)

| Component | Role |
|-----------|------|
| `LocationSelector.jsx` | Three-field cascade with `SearchableSelect` per field |
| `SearchableSelect.jsx` | Client-side filter on loaded cascade options |
| `locationCascadeApi.js` | `fetchCascadeBranches`, `fetchCascadeFloors`, `fetchCascadeRacks`, `resolveCascadeLocation` |
| `locationSelectService.js` | Server cascade list APIs |
| `LocatorCanvas.jsx` | Floor layout, rack highlight, rack detail drawer |
| `formatRackDisplayName()` | Rack-only label helper in `locationDisplay.js` |

### Gaps vs target

- Search is **local only** (options already loaded for current branch/floor)
- No cross-hierarchy search from Branch field (e.g. typing `R012` in Branch)
- No product/SKU/barcode → rack resolution
- No unified search API or ranking
- Three loosely coupled field states (branchId, floorId, rackId) without central hierarchy controller
- No automatic floor layout load + rack focus on cross-field selection

### What must be preserved

- Existing branch/floor cascade APIs where still used
- Locator layout API (`GET/PATCH .../locations/:floorId/layout`)
- Permission model (`inventory:read`, location write for layout edits)
- Rack detail drawer, stock ledger logic
- Zone assignment, unplaced rack tray, manage-racks flow
- Existing rack highlighting behaviour in locator

### Extension points

- New unified search endpoint alongside cascade APIs
- New client hook `useLocationHierarchySearch` + combobox components
- Refactor `LocationSelector` → `HierarchySearchSelector` (or wrap existing)
- Locator integration via `onHierarchyChange` callback with rack focus props

---

## 2. Search Interaction Design

### Three visible searchable combobox fields

1. **Branch**
2. **Floor**
3. **Rack**

Each field works as a **normal cascading dropdown** when opened without a search term, and as an **intelligent cross-hierarchy search** when the user types.

### Core requirement

A user must be able to **start searching from any of the three fields**.

**Example — user types in Branch field:**

```
R012
```

**Result:**

```
[RACK] R012
Hyderabad Main Branch → Floor 2 → Rack R012
```

**On select:**

| Field | Value |
|-------|-------|
| `branchId` | Hyderabad Main Branch ID |
| `floorId` | Floor 2 ID |
| `rackId` | R012 ID |

Then: load selected floor layout and highlight/focus Rack R012.

**Critical:** Do not derive hierarchy by parsing the result label. API must return rack ID, floor ID, branch ID, names, codes, and complete ancestry.

---

## 3. Field Behaviour

### Branch field

**Opened without search term:**

- Show branches only
- Respect branch permissions
- Active branches by default

**When user types, search:**

- Branches
- Floors
- Racks
- Rack shelf names
- Optionally: products, SKU, barcode, category, brand, colour, tags → rack

**Selection outcomes:**

| Result type | Actions |
|-------------|---------|
| Branch | Set `branchId`; clear `floorId`, `rackId`, rack highlight; load floors |
| Floor | Set parent `branchId`, `floorId`; clear `rackId`; load floor layout |
| Rack | Set `branchId`, `floorId`, `rackId`; load floor layout; highlight/focus rack (or show in unplaced list) |

### Floor field

**Opened without search term:**

- Floors for selected branch
- If no branch: all authorised floors grouped by branch, or prompt to select/search

**When user types:**

- Search floors and racks
- Prioritise selected branch
- Optionally show other branches in labelled section

**Selection outcomes:**

| Result type | Actions |
|-------------|---------|
| Floor | Set parent branch, `floorId`; clear `rackId`; load layout |
| Rack | Set branch, floor, rack; load and focus layout |

### Rack field

**Opened without search term:**

- Racks for selected floor
- If branch only: racks grouped by floor
- If neither: authorised global rack search

**When user types:**

- Rack name, code, shelf name, zone name
- Product name, SKU, barcode, brand, category, colour, tags
- Prioritise current floor
- Other floors → group **"Other floors"**

**On rack select:**

- Validate latest hierarchy
- Set branchId, floorId, rackId
- Load layout; highlight/focus rack

---

## 4. Search Result Design

### Groups

- **Branches**
- **Floors**
- **Racks**

### Type badges

`BRANCH` | `FLOOR` | `RACK`

### Examples

**Branch:**

```
[BRANCH] Hyderabad Main Branch
Code: HYD-MAIN
```

**Floor:**

```
[FLOOR] Floor 2
Hyderabad Main Branch → Floor 2
```

**Rack:**

```
[RACK] R012
Hyderabad Main Branch → Floor 2 → R012
```

**Product match:**

```
[RACK] R012
Matched product: Blue Dinner Plate
Hyderabad Main Branch → Floor 2 → R012
```

### Optional rack badges

`Placed` · `Unplaced` · `Assigned to Zone A` · `Inactive` · `Locked` · `Low stock` · `Empty`

### Rack result metadata (optional display)

- Rack status
- Zone assignment
- Total quantity
- Distinct product count
- Canvas placement status
- Active/inactive state

---

## 5. Search Ranking

Priority order (highest first):

1. Exact rack, floor, or branch **code** match
2. Exact **name** match
3. **Prefix** match
4. Partial text match
5. **Barcode** match
6. **SKU** match
7. Product metadata match

**Rule:** Product matches must **not** rank above an exact rack code match.

---

## 6. API Specification

### Endpoint

```
GET /api/admin/inventory/locations/search
```

### Query parameters

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search query |
| `contextField` | `branch` \| `floor` \| `rack` | Which combobox initiated search |
| `branchId` | string? | Current branch context |
| `floorId` | string? | Current floor context |
| `includeInventoryMatches` | boolean | Product/SKU/barcode search |
| `page` | number | Pagination |
| `limit` | number | Page size |

### Example response

```json
{
  "groups": {
    "branches": [],
    "floors": [],
    "racks": []
  },
  "items": [
    {
      "type": "rack",
      "id": "rackId",
      "name": "Rack R012",
      "code": "R012",
      "branch": {
        "id": "branchId",
        "name": "Hyderabad Main Branch",
        "code": "HYD-MAIN"
      },
      "floor": {
        "id": "floorId",
        "name": "Floor 2",
        "code": "F2"
      },
      "zone": {
        "id": "zoneId",
        "name": "Zone A"
      },
      "matchedBy": "rack_code",
      "matchedText": "R012",
      "isPlaced": true,
      "isActive": true,
      "isLocked": false,
      "totalQty": 245,
      "distinctProductCount": 18
    }
  ]
}
```

### Ancestry rules

- **Floor results:** always include branch ancestry
- **Rack results:** always include branch + floor ancestry
- **No extra client requests** to discover parent branch/floor after selection

### Permissions

- Filter on server: unauthorised branches, floors, racks, restricted stock
- `inventory:read` for search/selection
- Location write permission only for layout modification, not search

---

## 7. Component Structure

### New / updated client components

```
components/admin/inventory/location-search/
├── HierarchySearchSelector.jsx      # Replaces or wraps LocationSelector
├── LocationSearchCombobox.jsx       # Shared combobox
├── BranchCombobox.jsx
├── FloorCombobox.jsx
├── RackCombobox.jsx
├── LocationSearchResult.jsx
└── LocationTypeBadge.jsx

hooks/
├── useLocationHierarchySearch.js    # Debounced API search + AbortController
└── useLocationSelection.js          # Central hierarchy state
```

### LocationSearchCombobox props

```typescript
{
  fieldType: 'branch' | 'floor' | 'rack';
  selectedBranchId: string | null;
  selectedFloorId: string | null;
  selectedRackId: string | null;
  onHierarchyChange: (payload) => void;
  disabled?: boolean;
  required?: boolean;
  allowGlobalSearch?: boolean;
  includeInventoryMatches?: boolean;
  permissions?: object;
}
```

### onHierarchyChange payload

```typescript
{
  branchId: string | null;
  floorId: string | null;
  rackId: string | null;
  selectedType: 'branch' | 'floor' | 'rack';
  selectedItem: SearchResultItem;
}
```

---

## 8. Central Hierarchy Selection State

Single source of truth:

```typescript
{
  branchId: string | null;
  floorId: string | null;
  rackId: string | null;
}
```

### Selection logic

| Action | branchId | floorId | rackId |
|--------|----------|---------|--------|
| Select branch | set | clear | clear |
| Select floor | set parent | set | clear |
| Select rack | set parent | set parent | set |
| Manual branch change | set | clear | clear |
| Manual floor change | keep/set branch | set | clear |

Do **not** maintain three unrelated states that can drift.

---

## 9. Search Performance

| Requirement | Value / approach |
|-------------|------------------|
| Debounce | 250–350 ms |
| Stale requests | AbortController + ignore non-latest request ID |
| Min query length | 2 chars for global text (except barcode scanner — immediate) |
| Pagination | Server-side |
| Client | Do not load every rack into browser |
| Stock | Bulk aggregate; avoid one query per rack |

### Suggested indexes

**Location:**

- `code`
- `name`
- `level`
- `parentLocationId`
- `isActive`

**Product:**

- `title`
- `sku`
- `barcode`
- `brand`
- `tags`
- `colour`

**Stock:**

- `productId`
- `locationId`
- `statusBucket`

---

## 10. Locator Integration

When a rack is selected (from any field):

1. Set full hierarchy state
2. If `floorId` changed → fetch layout via existing layout API
3. If rack has canvas position → pan/zoom highlight (existing highlight mechanism)
4. If unplaced → indicate in unplaced rack list / toast
5. Optionally open rack detail drawer (product decision — default: highlight only)

### End-to-end test scenario

1. Open Branch field
2. Search `R012`
3. Select `[RACK] R012`
4. Verify branch auto-filled
5. Verify floor auto-filled
6. Verify rack selected
7. Verify correct floor layout loads
8. Verify rack highlighted on canvas

---

## 11. Edge Cases (must handle)

1. Duplicate rack names on different floors
2. Duplicate floor names across branches
3. Inactive branches, floors, racks
4. Rack assigned to a zone
5. Rack without canvas coordinates
6. Floor without locator layout
7. Product in multiple racks
8. Multiple matching products in same rack
9. Branch manually changed after rack selection
10. Floor manually changed after rack selection
11. Stale search responses
12. No search results
13. Search term shorter than minimum
14. Barcode scanner input (immediate, no min length)
15. Result from another floor
16. Result from another branch
17. Permission-restricted locations
18. Rack deleted after results loaded
19. Rack moved to different floor after search
20. Network errors
21. Broken/incomplete ancestry in DB
22. Selecting already-selected rack
23. Rack hidden from canvas but active
24. Archived floor/branch
25. Search matches both rack code and product SKU

**Rules:**

- Always show complete hierarchy path for ambiguous results
- Do **not** auto-select when multiple racks contain the same product

---

## 12. UI States

Each combobox must support:

- **Loading** — spinner in dropdown
- **Empty** — "No matches" / "Type at least 2 characters"
- **Error** — network/API failure with retry
- **Disabled** — cascade prerequisites not met
- **Grouped results** — Branches / Floors / Racks (+ "Other floors" / "Other branches" sections)

---

## 13. Service Layer (planned)

```
lib/server/inventory/
├── locationSearchService.js     # Unified search + ranking + permission filter
└── locationSearchSchemas.js     # Query validation (zod)
```

Extend existing services where possible:

- `locationSelectService.js` — cascade lists (keep for empty-state dropdowns)
- `locationLayoutService.js` — placement, zone, stock aggregates
- `inventoryService.js` — product lookup if inventory search exists

Do **not** create a second inventory search system if existing search can be extended.

---

## 14. Test Plan (future)

### Unit tests

- Ranking: exact code > exact name > prefix > partial > barcode > SKU > product
- Hierarchy state transitions
- Permission filtering
- Ancestry completeness on floor/rack results
- Debounce + abort stale responses

### Integration tests

- `GET /api/admin/inventory/locations/search` with various `contextField` values
- Product match returns rack with full ancestry
- Inactive locations excluded by default

### E2E tests

- Branch field → search rack → auto-fill hierarchy → layout load → highlight
- Floor field → search rack on other floor → "Other floors" group
- Rack field → product SKU search → multiple racks → no auto-select
- Barcode scan → immediate single-rack match

---

## 15. Migration / Rollout Strategy

1. **Phase 1:** Unified search API + service (no UI change)
2. **Phase 2:** `useLocationHierarchySearch` + `LocationSearchCombobox`
3. **Phase 3:** Replace `LocationSelector` in movements, add inventory, filters
4. **Phase 4:** Locator canvas integration (focus/highlight on cross-field rack select)
5. **Phase 5:** Product/inventory matches + indexes

Keep `LocationSelector` + `SearchableSelect` working until Phase 3 cutover.

---

## 16. Related Files (current codebase)

| Path | Notes |
|------|-------|
| `components/admin/inventory/LocationSelector.jsx` | Current cascade UI |
| `components/admin/inventory/SearchableSelect.jsx` | Client-only filter combobox |
| `lib/client/locationCascadeApi.js` | Cascade fetchers |
| `lib/client/locationSelectOptions.js` | Option mappers |
| `lib/server/inventory/locationSelectService.js` | Cascade server lists |
| `lib/shared/locationDisplay.js` | Path + rack label helpers |
| `components/admin/inventory/LocatorCanvas.jsx` | Layout + highlight |
| `docs/inventory-locator-floor-plan-upgrade.md` | Locator floor plan spec |

---

## 17. Open Product Decisions

- [ ] Default behaviour when selecting rack from search: highlight only vs open drawer
- [ ] Show inactive locations in search when `q` matches exactly?
- [ ] Global search without branch: show all authorised floors or require branch first?
- [ ] Include legacy shelf levels in search results?

---

*This document is the authoritative future spec for hierarchy-aware location search. Implementation should reference this file and update status sections as phases complete.*
