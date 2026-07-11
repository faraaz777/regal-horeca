/** Default logical canvas when no floor-plan image is uploaded. */
export const DEFAULT_COORDINATE_WIDTH = 2400;
export const DEFAULT_COORDINATE_HEIGHT = 1600;

export const DEFAULT_GRID_SIZE = 20;

export const RACK_PLACEMENT_RULES = ['must_be_inside_zone', 'allow_unzoned'];

export const FLOOR_LAYOUT_STATUSES = ['draft', 'published'];

export const FLOOR_PLAN_ALLOWED_MIME = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

export const FLOOR_PLAN_MAX_BYTES = 15 * 1024 * 1024;

export const FLOOR_PLAN_R2_FOLDER = 'inventory/floor-plans';

export const DEFAULT_ZONE_FILL = 'rgba(59, 130, 246, 0.12)';
export const DEFAULT_ZONE_STROKE = 'rgba(37, 99, 235, 0.6)';
