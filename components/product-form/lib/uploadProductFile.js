/**
 * Uploads a product file to Cloudflare R2.
 * Images over 1.5MB are compressed client-side; files over 15MB are rejected.
 * Compression is dynamically imported so the add/edit bundle stays smaller.
 */

import { adminFetch } from '@/lib/client/adminFetch';

export async function uploadProductFile(file, options = {}) {
  const { allowedTypes = 'image', folder = 'products' } = options;
  const imageCompression = (await import('browser-image-compression')).default;

  const MAX_INPUT_SIZE = 15 * 1024 * 1024;
  const MAX_OUTPUT_SIZE = 1.5 * 1024 * 1024;

  if (file.size > MAX_INPUT_SIZE) {
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(
      `File size (${fileSizeMB}MB) exceeds the maximum allowed size of 15MB. Please choose a smaller image.`
    );
  }

  const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const validDocumentTypes = ['application/pdf'];
  const allowedMimeTypes = allowedTypes === 'document' ? validDocumentTypes : validImageTypes;
  if (!allowedMimeTypes.includes(file.type)) {
    throw new Error(
      allowedTypes === 'document'
        ? 'Invalid file type. Only PDF files are allowed.'
        : 'Invalid file type. Only images (JPEG, PNG, GIF, WebP) are allowed.'
    );
  }

  let fileToUpload = file;

  if (allowedTypes !== 'document' && file.size > MAX_OUTPUT_SIZE) {
    try {
      const compressionOptions = {
        maxSizeMB: 1.5,
        useWebWorker: true,
        fileType: file.type,
        preserveExif: false,
      };

      fileToUpload = await imageCompression(file, compressionOptions);

      if (fileToUpload.size > MAX_OUTPUT_SIZE * 1.1) {
        const compressedSizeMB = (fileToUpload.size / (1024 * 1024)).toFixed(2);
        throw new Error(
          `Compression failed: Image is still ${compressedSizeMB}MB after compression. Please try a smaller image.`
        );
      }
    } catch (compressionError) {
      if (compressionError.message.includes('Compression failed')) {
        throw compressionError;
      }
      throw new Error(
        `Image compression failed: ${compressionError.message}. Please try a different image.`
      );
    }
  }

  const formData = new FormData();
  formData.append('file', fileToUpload, file.name);

  const response = await adminFetch(`/api/upload?folder=${encodeURIComponent(folder)}`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    const errorMessage = data.error || 'Upload failed';
    const errorDetails = data.details ? `: ${data.details}` : '';
    throw new Error(`${errorMessage}${errorDetails}`);
  }

  return data.url;
}
