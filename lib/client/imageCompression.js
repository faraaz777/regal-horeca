'use client';

/**
 * Client-only image compression before upload (dynamic import keeps initial bundle small).
 * @param {File} file
 * @param {import('browser-image-compression').Options} options
 */
export async function compressImageFile(file, options) {
  const imageCompression = (await import('browser-image-compression')).default;
  return imageCompression(file, options);
}
