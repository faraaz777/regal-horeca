import { formatRackDisplayName } from '@/lib/shared/locationDisplay';

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
  return (racks || []).map((r) => ({
    value: String(r._id),
    label: formatRackDisplayName(r),
    searchText: locationSearchText(r),
    meta: r.code && r.name && r.code !== r.name ? r.code : undefined,
  }));
}
