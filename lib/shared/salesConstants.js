/** Sales portal statuses — safe for client + server. */

/** R2 prefix for salesman collection cover images (not storefront). */
export const SALES_COLLECTION_THUMBNAIL_FOLDER = 'sales/collections/thumbnails';

/** R2 prefix for collection presentation-set photos (table setups). Not loaded on the list page. */
export const SALES_COLLECTION_SCENE_FOLDER = 'sales/collections/scenes';

/**
 * Hard caps so a collection document and the detail page stay small.
 * Eight table-setup photos is enough for a floor visit; pins stay per scene.
 */
export const MAX_PRESENTATION_SCENES = 8;
export const MAX_PRESENTATION_PINS_PER_SCENE = 40;

export const SESSION_STATUSES = ['active', 'closed'];

/** draft = editable cart; submitted = locked pending review; completed = hidden from workspace */
export const BUCKET_STATUSES = ['draft', 'submitted', 'completed'];

export const BUCKET_STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  completed: 'Completed',
};

export const ACTIVE_BUCKET_STATUSES = ['draft', 'submitted'];

export const REQUEST_STATUSES = [
  'submitted',
  'approved',
  'partially_approved',
  'rejected',
  'fulfilled',
  'cancelled',
];

export const REQUEST_STATUS_LABELS = {
  submitted: 'Pending review',
  approved: 'Approved',
  partially_approved: 'Partially approved',
  rejected: 'Rejected',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};
