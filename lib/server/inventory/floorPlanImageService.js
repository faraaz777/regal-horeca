import 'server-only';

import sharp from 'sharp';
import { uploadToR2, deleteFromR2 } from '@/lib/utils/r2Upload';
import {
  FLOOR_PLAN_ALLOWED_MIME,
  FLOOR_PLAN_MAX_BYTES,
  FLOOR_PLAN_R2_FOLDER,
} from '@/lib/shared/floorLayoutConstants';

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function validateFloorPlanFile(file) {
  if (!file) throw new Error('No file provided');
  if (!FLOOR_PLAN_ALLOWED_MIME.includes(file.type)) {
    throw new Error('Unsupported file type. Use PNG, JPG, JPEG, or WebP.');
  }
  if (file.size > FLOOR_PLAN_MAX_BYTES) {
    throw new Error('File exceeds 15MB limit');
  }
  const ext = file.name?.split('.').pop()?.toLowerCase();
  const allowedExt = ['png', 'jpg', 'jpeg', 'webp'];
  if (ext && !allowedExt.includes(ext)) {
    throw new Error('Invalid file extension');
  }
}

export async function readFloorPlanDimensions(buffer) {
  const meta = await sharp(buffer).metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (!width || !height) throw new Error('Could not read image dimensions');
  return {
    originalWidth: width,
    originalHeight: height,
    aspectRatio: width / height,
  };
}

export async function uploadFloorPlanImage({ floorId, file, buffer }) {
  validateFloorPlanFile(file);
  const dims = await readFloorPlanDimensions(buffer);
  const ext = EXT_BY_MIME[file.type] || '.png';
  const fileName = `floor-${floorId}-${Date.now()}${ext}`;
  const folder = `${FLOOR_PLAN_R2_FOLDER}/${floorId}`;

  const url = await uploadToR2(buffer, fileName, folder, {
    contentType: file.type,
  });

  const storageKey = `${folder}/${fileName}`;

  return {
    url,
    storageKey,
    originalWidth: dims.originalWidth,
    originalHeight: dims.originalHeight,
    aspectRatio: dims.aspectRatio,
    opacity: 1,
    visible: true,
    locked: true,
  };
}

export async function removeFloorPlanFromStorage(backgroundImage) {
  if (backgroundImage?.url) {
    await deleteFromR2(backgroundImage.url);
  }
}
