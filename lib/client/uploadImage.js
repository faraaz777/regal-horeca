'use client';

import { adminFetch } from '@/lib/client/adminFetch';
import { compressImageFile } from '@/lib/client/imageCompression';
import { SALES_COLLECTION_THUMBNAIL_FOLDER } from '@/lib/shared/salesConstants';

const MAX_INPUT_SIZE = 15 * 1024 * 1024;
const COMPRESS_THRESHOLD = 1.5 * 1024 * 1024;
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Upload an image to R2 via /api/upload (client compresses large files first).
 * @param {File} file
 * @param {string} folder - R2 folder prefix, e.g. "categories"
 * @returns {Promise<string>} public URL
 */
export async function uploadAdminImage(file, folder) {
  if (file.size > MAX_INPUT_SIZE) {
    const mb = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(`File (${mb}MB) exceeds the 15MB limit.`);
  }

  if (!VALID_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Only JPEG, PNG, GIF, and WebP images are allowed.');
  }

  let fileToUpload = file;
  if (file.size > COMPRESS_THRESHOLD) {
    fileToUpload = await compressImageFile(file, {
      maxSizeMB: 1.5,
      useWebWorker: true,
      fileType: file.type,
      preserveExif: false,
    });
  }

  const formData = new FormData();
  formData.append('file', fileToUpload, file.name);

  const response = await adminFetch(`/api/upload?folder=${encodeURIComponent(folder)}`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Upload failed');
  }

  return data.url;
}

/** Upload a salesman collection cover image to the dedicated R2 folder. */
export function uploadSalesCollectionThumbnail(file) {
  return uploadAdminImage(file, SALES_COLLECTION_THUMBNAIL_FOLDER);
}
