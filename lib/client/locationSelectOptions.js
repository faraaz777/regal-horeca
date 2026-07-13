import { formatRackDisplayName } from '@/lib/shared/locationDisplay';
import { MAX_PRODUCTS_PER_RACK } from '@/lib/shared/inventoryConstants';

function locationLabel(loc) {
  return loc?.name?.trim() || loc?.code?.trim() || '';
}

function locationSearchText(loc) {
  return [loc?.name, loc?.code].filter(Boolean).join(' ');
}

export function toBranchOptions(branches) {
  return (branches || []).map((b) => ({
    value: String(b._id),
    label: locationLabel(b),
    searchText: locationSearchText(b),
    meta: b.code && b.name && b.code !== b.name ? b.code : undefined,
  }));
}

export function toFloorOptions(floors) {
  return (floors || []).map((f) => ({
    value: String(f._id),
    label: locationLabel(f),
    searchText: locationSearchText(f),
    meta: f.code && f.name && f.code !== f.name ? f.code : undefined,
  }));
}

export function toRackOptions(racks) {
  return (racks || []).map((r) => {
    const count = r.productCount ?? 0;
    const capacity = r.capacity ?? MAX_PRODUCTS_PER_RACK;
    const fullLabel = r.isFull ? ' · Full' : '';
    return {
      value: String(r._id),
      label: formatRackDisplayName(r),
      searchText: locationSearchText(r),
      meta: `${count}/${capacity} products${fullLabel}`,
    };
  });
}
