# Inventory Locator

2D floor-plan view for rack positions under **Branch › Floor › Rack**.

## Philosophy

Locator shows **facts**, not interpretations:

- Where is this rack?
- What products are on it?
- How many pieces / SKUs?

It does **not** invent physical fullness (fill %, capacity utilisation). Warehouse people decide density; software does not guess “73% full.”

Qty and SKU counts come from **Stock snapshots**. Ledger is for movements / audit / last movement only.

## Modes

- **View** (default): find products, highlight racks/zones, open rack detail. No layout editing chrome.
- **Arrange** (`locations:write`): zones, drag racks, grid, save/publish. Prevents warehouse users from accidentally moving layout.

## Find flow (Stock = truth)

```
Branch → Floor → Search product on this floor → Click → Highlight from Stock
```

Do **not** highlight from denormalized search-result location labels. Always:

`Product → Stock → locationId → floor racks → highlight`

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/admin/inventory/locations/:floorId/locate?q=` | `inventory:read` |
| GET | `/api/admin/inventory/locations/:floorId/locate?productId=` | `inventory:read` |

Search returns product / SKU / rack count / pcs **on this floor only**.
Locate returns rack codes, qty, and layout x/y/zoneId so the client does not recompute positions.

## Coordinate system

- Origin **(0, 0)** is the **top-left** of the canvas (2400×1600 logical units).
- **X** increases to the right; **Y** increases downward.
- Rack `position` is stored on `Location` documents where `level: 'rack'` only:
  ```js
  { x, y, width, height }
  ```
- Defaults when placing from the unplaced tray: **120×80** (`DEFAULT_RACK_WIDTH` / `DEFAULT_RACK_HEIGHT`).

## Unplaced racks

Racks with no `position` (or missing `x`/`y`) appear in the **Unplaced racks** tray under **Arrange** mode (`locations:write`). Drag them onto the canvas to set their first position. After drop, position is persisted via bulk PATCH.

## Rack visuals

- **Pale blue** = has stock
- **Light grey** = empty
- **Amber** = find / highlight
- **Solid blue** = selected
- Zone-assigned racks render as a **code-sorted auto-grid of boxes** inside the zone border (reference ZONE A/B look) — not a hover popup
- Unzoned racks use saved map `x/y`
- Tile shows **centered rack code**; click opens rack detail (SKU/pcs facts)

## APIs

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/admin/inventory/locations/:floorId/layout` | `inventory:read` |
| GET | `/api/admin/inventory/locations/:floorId/locate` | `inventory:read` |
| PATCH | `/api/admin/inventory/locations/:id/position` | `locations:write` |
| PATCH | `/api/admin/inventory/locations/positions/bulk` | `locations:write` |
| GET | `/api/admin/inventory/locations/:rackId/locator-detail` | `inventory:read` |

## Audit logging

Rack position updates are logged via `logAudit` where wired. Prefer action names consistent with inventory audit conventions.

## UI entry

`/admin/inventory/locator` (sidebar: Inventory → Locator)
