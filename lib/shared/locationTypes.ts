/**
 * Active inventory location model: Branch → Floor → Rack.
 * Stock is stored as a single rack-level locationId on Stock / StockLedger.
 */

export type LocationLevel =
  | 'branch'
  | 'floor'
  | 'section'
  | 'zone'
  | 'rack'
  | 'shelf';

export interface Branch {
  _id: string;
  code: string;
  name: string;
  level: 'branch';
  path: string;
}

export interface Floor {
  _id: string;
  code: string;
  name: string;
  level: 'floor';
  parentLocationId: string;
  path: string;
}

export interface Rack {
  _id: string;
  code: string;
  name: string;
  level: 'rack';
  parentLocationId: string;
  path: string;
  displayPath: string;
  /** Distinct SKUs with sellable qty on this rack. */
  productCount?: number;
  productIds?: string[];
  /** Sellable units of all products on this rack (allocate “stored stock”). */
  totalQty?: number;
}

export interface LocationSelection {
  branchId: string | null;
  floorId: string | null;
  rackId: string | null;
  locationId: string | null;
  displayPath: string;
}

/** Location + opening quantity for multi-location intake. */
export interface LocationOpeningLine extends LocationSelection {
  qty: number | string;
}

export interface LocationSelectorProps {
  selectedBranchId?: string | null;
  selectedFloorId?: string | null;
  selectedRackId?: string | null;
  onChange: (selection: LocationSelection) => void;
  required?: boolean;
  disabled?: boolean;
  mode?: 'edit' | 'filter';
  layout?: 'vertical' | 'horizontal';
  allowedLocationIds?: string[];
  className?: string;
  labelClassName?: string;
}

export interface CascadeBranchesResponse {
  branches: Branch[];
}

export interface CascadeFloorsResponse {
  floors: Floor[];
  branchId: string;
}

export interface CascadeRacksResponse {
  racks: Rack[];
  floorId: string;
}

export interface CascadeResolveResponse {
  selection: LocationSelection;
}
