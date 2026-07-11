# Inventory Locator — Floor-Plan & Zones Upgrade Plan

> Phase 1 assessment (completed). Extends the existing locator; does **not** replace it.

## Existing Architecture Assessment

### What exists today

| Layer | Current state |
|-------|---------------|
| **Page** | `app/admin/inventory/locator/page.js` — permission gate + `LocatorCanvas` |
| **Canvas** | `LocatorCanvas.jsx` (~640 lines) — orchestration, branch/floor select, edit mode, zoom/pan, marquee, DnD |
| **Canvas library** | `@dnd-kit/core` only — HTML/CSS absolute positioning, **not** Konva |
| **Logical canvas** | Implicit **2400×1600** (documented in `docs/inventory-locator.md`; not stored in DB) |
| **Rack position** | `Location.position = { x, y, width, height }` on rack-level documents |
| **Layout API** | `GET .../locations/:floorId/layout` → `getFloorLayout()` |
| **Position APIs** | `PATCH .../position`, `PATCH .../positions/bulk` |
| **Search** | `LocatorSearchBar` → `GET /api/admin/inventory/search` → highlight racks |
| **Detail** | `RackDetailDrawer` → `GET .../locator-detail` |
| **Export** | `LocatorExportButton` — `html-to-image` + jsPDF on DOM canvas |
| **Permissions** | View: `inventory:read`; Edit layout: `locations:write` |
| **Stock** | Bulk `Stock` snapshot in `getFloorLayout()` — **no per-rack N+1** |
| **Audit** | Rack position updates **not** audited yet (documented as deferred) |
| **Upload** | R2 via `lib/utils/r2Upload.js` + `/api/upload` (products folder; needs locator folder) |
| **State** | Local React state in `LocatorCanvas` — **no Zustand** |
| **Tests** | **No test runner / test files** in project today |

### Gaps vs target feature

- No floor-plan background image storage
- No zones / sections on canvas
- No stable logical coordinate system persisted per floor
- No ratio-based normalisation for responsive scaling
- No `zoneId` on rack positions
- No draft/publish layout versioning
- No undo/redo, autosave, or layout conflict detection
- Canvas is HTML + dnd-kit — insufficient for zone draw/resize/transform at scale without Konva (or similar) for spatial layer only

---

## Extension Strategy (not rebuild)

```text
LocatorCanvas (orchestrator — stays thin)
├── useFloorLayout          ← layout DTO + save/publish
├── useCanvasViewport       ← pan/zoom/fit (extract from LocatorCanvas)
├── useCanvasSelection      ← rack/zone/marquee selection
├── useZoneEditor           ← zone CRUD + drag/resize
├── useRackPlacement        ← zone containment + drop rules
├── useLayoutHistory        ← undo/redo snapshots
├── useLayoutAutosave       ← debounced PATCH layout
├── useFloorPlanUpload      ← R2 upload + preview
├── useKeyboardShortcuts
│
├── CanvasToolbar / ZoneToolbar / CanvasLayersPanel
├── FloorPlanBackground     ← image layer (HTML img or Konva Image)
├── ZoneLayer + ZoneUnit      ← Konva Rect + labels recommended
├── RackUnit                  ← existing status colours preserved
├── UnplacedRacksTray         ← existing, extended drop targets
├── ZonePropertiesPanel       ← right panel when zone selected
├── FloorPlanUploadDialog
├── LocatorSearchBar          ← unchanged API, enhanced highlight
├── RackDetailDrawer          ← add zone name to display
└── LocatorExportButton       ← include background + zones
```

**Canvas library decision:** Migrate **only the spatial viewport** to `react-konva` + `konva`. Keep drawers, search, properties panels, and page shell as HTML. Preserve `@dnd-kit` for unplaced tray → canvas drop initially, then unify on Konva drag if needed.

---

## Files: Reuse / Extend / New

### Reuse (unchanged behaviour)

- `app/admin/inventory/locator/page.js`
- `LocatorSearchBar.jsx` (extend highlight logic)
- `RackUnit.jsx` (adapt props for Konva or wrapper)
- `UnplacedRacksTray.jsx`
- `RackDetailDrawer.jsx` (display zone; capacity edit unchanged)
- `locatorUtils.js` (rack status + heatmap)
- `locationCascadeApi.js`
- `permissions.js`
- `locationSelectService.js`, `inventoryService.js`, `Stock`, `StockLedger`

### Extend

| File | Changes |
|------|---------|
| `LocatorCanvas.jsx` | Slim orchestrator; delegate to hooks + subcomponents |
| `locationLayoutService.js` | Merge `FloorLayout` into DTO; normalise positions; zone summaries |
| `Location.js` | Optional extended `position` subfields (backward compatible) |
| `schemas.js` | `floorLayoutUpdateSchema`, extended `rackPositionSchema` |
| `LocatorExportButton.jsx` | Export background + zones from Konva stage |
| `docs/inventory-locator.md` | Coordinate system + zones |

### New

**Models**

- `lib/models/FloorLayout.js` — one doc per floor (recommended over overloading `Location`)

**Server**

- `lib/server/inventory/locationZoneService.js`
- `lib/server/inventory/floorPlanImageService.js`

**API**

- `PATCH /api/admin/inventory/locations/:floorId/layout`
- `POST /api/admin/inventory/locations/:floorId/layout/background`
- `DELETE /api/admin/inventory/locations/:floorId/layout/background`
- `POST /api/admin/inventory/locations/:floorId/layout/publish`

**Client utils**

- `lib/client/canvasCoordinateUtils.js`
- `lib/client/zoneUtils.js`
- `lib/client/layoutValidationUtils.js`

**Hooks** (under `hooks/locator/`)

- `useFloorLayout.js`, `useCanvasViewport.js`, `useZoneEditor.js`, etc.

**Components** (under `components/admin/inventory/locator/`)

- `FloorPlanBackground.jsx`, `ZoneLayer.jsx`, `ZoneUnit.jsx`, `CanvasToolbar.jsx`, etc.

---

## Database Changes

### New collection: `FloorLayout`

One document per `floorId` (unique index).

```js
{
  branchId, floorId,
  backgroundImage: { url, storageKey, originalWidth, originalHeight, aspectRatio, opacity, visible, locked },
  canvas: { coordinateWidth, coordinateHeight, gridEnabled, gridSize, snapEnabled, guidesEnabled, rackPlacementRule },
  zones: [ FloorZone ],
  version: Number,
  status: 'draft' | 'published',
  createdBy, updatedBy, publishedBy,
  timestamps
}
```

### Extend `Location.position` (rack only)

```js
{
  x, y, width, height,           // existing — required for compat
  rotation?, zoneId?, isPlaced?,
  xRatio?, yRatio?, widthRatio?, heightRatio?
}
```

Old records with `{ x, y, width, height }` only → normalised in `buildRackDto()` using floor `canvas.coordinateWidth/Height` (default 2400×1600 when no layout).

### Migration

- **No mandatory migration script** — lazy create default `FloorLayout` on first `getFloorLayout()` if missing
- Existing floors: blank canvas 2400×1600, no zones, racks render as today
- Background upload optional

---

## API Contracts

### GET `.../locations/:floorId/layout` (extended response)

```json
{
  "floor": { "_id", "code", "name", "displayPath" },
  "branch": { "_id", "code", "name" },
  "layout": {
    "backgroundImage": { "url", "originalWidth", "originalHeight", "aspectRatio", "opacity", "visible", "locked" },
    "canvas": { "coordinateWidth", "coordinateHeight", "gridEnabled", "gridSize", "snapEnabled", "guidesEnabled", "rackPlacementRule" },
    "zones": [],
    "version": 1,
    "status": "draft"
  },
  "racks": [],
  "unplacedRacks": [],
  "maxTotalQty": 1,
  "hasCapacityData": false,
  "heatmapNote": "...",
  "summary": { "rackCount", "placedRackCount", "unplacedRackCount", "zoneCount", "totalQty", "totalCapacity", "utilisationPercent" }
}
```

### PATCH `.../locations/:floorId/layout`

Body: partial layout update (canvas settings, zones, metadata). Requires `expectedVersion` for optimistic concurrency.

### POST/DELETE background endpoints

Upload via multipart → R2 folder `inventory/floor-plans/{floorId}/` → store metadata on `FloorLayout`.

### PATCH rack position (extended)

Adds optional: `rotation`, `zoneId`, `xRatio`, `yRatio`, `widthRatio`, `heightRatio`. Server validates zone exists on floor and rack centre inside zone when `rackPlacementRule === 'must_be_inside_zone'`.

---

## Backward Compatibility

| Scenario | Behaviour |
|----------|-----------|
| No `FloorLayout` doc | Auto-create default; racks unchanged |
| No background | Grey grid canvas at logical size |
| No zones | Racks unzoned; `allow_unzoned` effective |
| Old position shape | Normalise ratios on read; persist extended fields on next save |
| Read-only users | Full view/search/heatmap/drawer — no edit tools |

---

## Implementation Phases

### Phase 2 — Foundation (backend + types) ✅ start here

- `FloorLayout` model
- Extend `getFloorLayout()` DTO
- Coordinate + zone validation utils (server)
- Extended Zod schemas
- `PATCH layout` + background upload/delete routes
- Audit hooks for layout changes

### Phase 3 — Canvas spatial layer

- Add `react-konva`
- Extract viewport + coordinate utils
- `FloorPlanBackground`, `ZoneLayer`, `ZoneUnit`
- Zone create/resize/select (edit mode)

### Phase 4 — Rack ↔ zone

- `zoneId` on position save
- Drop validation + containment
- Zone delete dialog (keep racks / unplace / cancel)
- Move zone with racks (bulk PATCH)

### Phase 5 — Editor UX

- Toolbar, layers panel, properties panel
- Undo/redo, autosave, conflict UI
- Keyboard shortcuts
- Upload dialog with replace options

### Phase 6 — Polish

- Enhanced search (next/prev, dim zones)
- Export with background + zones
- Rack drawer zone field
- Performance memoisation pass

### Phase 7 — Tests

- Introduce Vitest (or project-standard runner)
- Unit: coordinates, containment, validation, normalisation
- Integration: layout CRUD, bulk positions
- E2E: main workflow (Playwright if adopted)

---

## Permissions (unchanged + enforced server-side)

| Action | Permission |
|--------|------------|
| View locator, search, drawer | `inventory:read` |
| Upload background, zones, move racks, publish | `locations:write` |
| Edit rack capacity | `locations:write` (existing) |

---

## Non-negotiables

- **Never** mutate `Stock` / `StockLedger` from locator layout code
- **Never** store base64 images in MongoDB
- **Never** trust client `zoneId` without server containment check
- **Preserve** existing search, heatmap, status colours, unplaced tray flow
- **Bulk stock** remains in `getFloorLayout()` aggregation
