import 'server-only';

import { SALES_COLLECTION_THUMBNAIL_FOLDER } from '@/lib/shared/salesConstants';
import { deleteFromR2 } from '@/lib/utils/r2Upload';

export function isAllowedSalesCollectionThumbnailUrl(url) {
  if (!url) return true;

  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
  if (!base) return false;

  const prefix = `${base}/${SALES_COLLECTION_THUMBNAIL_FOLDER}/`;
  return url.startsWith(prefix);
}

/** Best-effort R2 cleanup when thumbnail is replaced or collection deleted. */
export async function deleteSalesCollectionThumbnail(url) {
  if (!url || !isAllowedSalesCollectionThumbnailUrl(url)) return;
  await deleteFromR2(url);
}
