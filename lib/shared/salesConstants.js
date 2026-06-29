/** Sales portal statuses — safe for client + server. */

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
