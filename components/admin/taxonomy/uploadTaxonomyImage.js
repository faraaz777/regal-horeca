'use client';

import { compressImageFile } from '@/lib/client/imageCompression';
import { adminFetch } from '@/lib/client/adminFetch';

/**
 * Upload taxonomy image (categories) to R2 via admin API.
 */
export async function uploadTaxonomyImage(file, folder = 'categories') {
  const MAX_INPUT_SIZE = 15 * 1024 * 1024;
  const MAX_OUTPUT_SIZE = 1.5 * 1024 * 1024;

  if (file.size > MAX_INPUT_SIZE) {
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(`File size (${fileSizeMB}MB) exceeds the maximum allowed size of 15MB.`);
  }

  const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!validImageTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, GIF, WebP are allowed.');
  }

  let fileToUpload = file;
  if (file.size > MAX_OUTPUT_SIZE) {
    fileToUpload = await compressImageFile(file, {
      maxSizeMB: 1.5,
      useWebWorker: true,
      fileType: file.type,
      preserveExif: false,
    });
  }

  const formData = new FormData();
  formData.append('file', fileToUpload, file.name);

  const response = await adminFetch(`/api/upload?folder=${folder}`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Upload failed');
  }
  return data.url;
}
