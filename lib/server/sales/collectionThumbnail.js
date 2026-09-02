import 'server-only';

import {
  SALES_COLLECTION_SCENE_FOLDER,
  SALES_COLLECTION_THUMBNAIL_FOLDER,
} from '@/lib/shared/salesConstants';
import { deleteFromR2 } from '@/lib/utils/r2Upload';

function isAllowedR2FolderUrl(url, folder) {
  if (!url) return true;

  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
  if (!base) return false;

  return url.startsWith(`${base}/${folder}/`);
}

export function isAllowedSalesCollectionThumbnailUrl(url) {
  return isAllowedR2FolderUrl(url, SALES_COLLECTION_THUMBNAIL_FOLDER);
}

export function isAllowedSalesCollectionSceneUrl(url) {
  return isAllowedR2FolderUrl(url, SALES_COLLECTION_SCENE_FOLDER);
}

/** Best-effort R2 cleanup when thumbnail is replaced or collection deleted. */
export async function deleteSalesCollectionThumbnail(url) {
  if (!url || !isAllowedSalesCollectionThumbnailUrl(url)) return;
  await deleteFromR2(url);
}

/** Best-effort R2 cleanup when the presentation-set photo is replaced or removed. */
export async function deleteSalesCollectionScene(url) {
  if (!url || !isAllowedSalesCollectionSceneUrl(url)) return;
  await deleteFromR2(url);
}

export async function deleteSalesCollectionScenes(urls = []) {
  const unique = [...new Set((urls || []).filter(Boolean))];
  await Promise.all(unique.map((url) => deleteSalesCollectionScene(url)));
}
