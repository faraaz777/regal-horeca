# Inventory Locator

2D floor-plan view for rack positions under **Branch › Floor › Rack**.

## Coordinate system

- Origin **(0, 0)** is the **top-left** of the canvas (2400×1600 logical units).
- **X** increases to the right; **Y** increases downward.
- Rack `position` is stored on `Location` documents where `level: 'rack'` only:
  ```js
  { x, y, width, height }
  ```
- Defaults when placing from the unplaced tray: **120×80** (`DEFAULT_RACK_WIDTH` / `DEFAULT_RACK_HEIGHT`).

## Unplaced racks

Racks with no `position` (or missing `x`/`y`) appear in the **Unplaced racks** sidebar. In **Edit layout** mode (`locations:write`), drag them onto the canvas to set their first position. After drop, position is persisted via bulk PATCH.

## APIs

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/admin/inventory/locations/:floorId/layout` | `inventory:read` |
| PATCH | `/api/admin/inventory/locations/:id/position` | `locations:write` |
| PATCH | `/api/admin/inventory/locations/positions/bulk` | `locations:write` |
| GET | `/api/admin/inventory/locations/:rackId/locator-detail` | `inventory:read` |

## Heatmap

Racks have an optional **`capacity`** field (max units) on the `Location` document.

- When a rack has a capacity, the heatmap shows **true fill %** = `totalQty ÷ capacity`.
- Racks **without** a capacity fall back to **relative total qty** on the current floor.
- Set/clear capacity in the **rack detail drawer** (requires `locations:write`).

## Audit logging

**Deferred.** Rack position updates are **not** written to `/admin/audit` in this release. When audit integration is extended, use action `inventory.rack_position_update` with before/after coordinates — do not invent a separate logging table.

## UI entry

`/admin/inventory/locator` (sidebar: Inventory → Locator)
