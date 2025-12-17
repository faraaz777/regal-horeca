/**
 * Image Optimization Utility
 * 
 * Optimizes images before upload to R2 to reduce storage costs and bandwidth.
 * Ensures images are compressed and resized to meet size requirements.
 */

import sharp from 'sharp';

const MAX_SIZE_KB = 550; // 550KB limit
const MAX_WIDTH = 1920;
const QUALITY_START = 85;
const QUALITY_MIN = 60;

/**
 * Optimizes an image buffer to meet size requirements
 * @param {Buffer} buffer - Original image buffer
 * @param {number} maxWidth - Maximum width in pixels (default: 1920)
 * @returns {Promise<Buffer>} Optimized image buffer
 */
export async function optimizeImage(buffer, maxWidth = MAX_WIDTH) {
  try {
    let image = sharp(buffer);
    const metadata = await image.metadata();
    
    // Determine if we should convert to WebP (better compression)
    const format = metadata.format;
    const shouldConvertToWebP = ['jpeg', 'jpg', 'png'].includes(format?.toLowerCase());
    
    // Resize if image is too wide
    if (metadata.width && metadata.width > maxWidth) {
      image = image.resize(maxWidth, null, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    }
    
    // Try optimizing with different quality levels to meet size limit
    let quality = QUALITY_START;
    let optimizedBuffer;
    
    while (quality >= QUALITY_MIN) {
      if (shouldConvertToWebP) {
        optimizedBuffer = await image
          .webp({ quality })
          .toBuffer();
      } else {
        // Keep original format but compress
        if (format === 'jpeg' || format === 'jpg') {
          optimizedBuffer = await image
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();
        } else if (format === 'png') {
          optimizedBuffer = await image
            .png({ quality, compressionLevel: 9 })
            .toBuffer();
        } else {
          // For other formats, just resize if needed
          optimizedBuffer = await image.toBuffer();
        }
      }
      
      const sizeKB = optimizedBuffer.length / 1024;
      
      // If size is acceptable, return
      if (sizeKB <= MAX_SIZE_KB) {
        return optimizedBuffer;
      }
      
      // If still too large and we can reduce quality more, try again
      if (quality > QUALITY_MIN) {
        quality -= 10;
        // Recreate image from original buffer
        image = sharp(buffer);
        if (metadata.width && metadata.width > maxWidth) {
          image = image.resize(maxWidth, null, {
            withoutEnlargement: true,
            fit: 'inside',
          });
        }
      } else {
        // If minimum quality reached and still too large, resize more aggressively
        const currentWidth = metadata.width || maxWidth;
        const targetWidth = Math.floor(currentWidth * 0.8);
        
        image = sharp(buffer).resize(targetWidth, null, {
          withoutEnlargement: true,
          fit: 'inside',
        });
        
        if (shouldConvertToWebP) {
          optimizedBuffer = await image.webp({ quality: QUALITY_MIN }).toBuffer();
        } else if (format === 'jpeg' || format === 'jpg') {
          optimizedBuffer = await image.jpeg({ quality: QUALITY_MIN, mozjpeg: true }).toBuffer();
        } else {
          optimizedBuffer = await image.toBuffer();
        }
        
        // If still too large, we'll return it anyway (it's the best we can do)
        return optimizedBuffer;
      }
    }
    
    return optimizedBuffer;
  } catch (error) {
    console.error('Error optimizing image:', error);
    // Return original buffer if optimization fails
    return buffer;
  }
}

