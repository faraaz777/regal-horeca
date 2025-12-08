/**
 * Cloudflare R2 Upload Utility
 * 
 * Handles file uploads to Cloudflare R2 storage.
 * R2 is S3-compatible, so we use AWS SDK for S3.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// Create S3 client function - creates client when needed to ensure env vars are loaded
function getS3Client() {
  return new S3Client({
    region: 'auto', // R2 uses 'auto' as the region
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  });
}

/**
 * Uploads a file to Cloudflare R2
 * 
 * @param {Buffer|Uint8Array} fileBuffer - The file buffer to upload
 * @param {string} originalFileName - Original filename for extension detection
 * @param {string} folder - Optional folder path in R2 (e.g., 'products', 'categories')
 * @returns {Promise<string>} Public URL of the uploaded file
 */
export async function uploadToR2(fileBuffer, originalFileName, folder = 'uploads') {
  try {
    // Validate environment variables
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;
    
    // Debug: Log what we're getting (without sensitive data)
    console.log('R2 Config Check:', {
      hasBucketName: !!bucketName,
      hasPublicUrl: !!publicUrl,
      hasAccessKeyId: !!accessKeyId,
      hasSecretAccessKey: !!secretAccessKey,
      hasEndpoint: !!endpoint,
      endpointValue: endpoint ? endpoint.substring(0, 30) + '...' : 'undefined'
    });
    
    // Check which variables are missing and provide helpful error message
    const missing = [];
    if (!bucketName) missing.push('R2_BUCKET_NAME');
    if (!publicUrl) missing.push('R2_PUBLIC_URL');
    if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
    if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
    if (!endpoint) missing.push('R2_ENDPOINT');
    
    if (missing.length > 0) {
      throw new Error(`R2 credentials not configured. Missing: ${missing.join(', ')}. Please check your .env.local file.`);
    }

    // Get file extension from original filename
    const fileExtension = originalFileName.split('.').pop()?.toLowerCase() || 'jpg';
    
    // Generate unique filename using UUID
    const fileName = `${uuidv4()}.${fileExtension}`;
    const uniqueFileName = folder ? `${folder}/${fileName}` : fileName;
    
    // Determine content type based on file extension
    const contentType = getContentType(fileExtension);
    
    // Upload to R2
    const s3Client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueFileName,
      Body: fileBuffer,
      ContentType: contentType,
    });
    
    await s3Client.send(command);
    
    // Construct public URL
    const imageUrl = `${publicUrl}/${uniqueFileName}`;
    
    return imageUrl;
  } catch (error) {
    console.error('Error uploading to R2:', error);
    throw new Error(`Failed to upload file to R2: ${error.message}`);
  }
}

/**
 * Deletes a file from Cloudflare R2
 * 
 * @param {string} fileUrl - The public URL of the file to delete
 * @returns {Promise<void>}
 */
export async function deleteFromR2(fileUrl) {
  try {
    // Extract the key from the URL
    // URL format: https://pub-{account-id}.r2.dev/{folder}/{filename}
    // or: https://{custom-domain}/{folder}/{filename}
    const urlParts = fileUrl.split('/');
    const key = urlParts.slice(3).join('/'); // Remove protocol and domain parts
    
    const s3Client = getS3Client();
    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });
    
    await s3Client.send(command);
  } catch (error) {
    console.error('Error deleting from R2:', error);
    // Don't throw error - file might not exist or already be deleted
    console.warn(`Failed to delete file from R2: ${fileUrl}`);
  }
}

/**
 * Gets the MIME content type based on file extension
 * 
 * @param {string} extension - File extension (without dot)
 * @returns {string} MIME content type
 */
function getContentType(extension) {
  const contentTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
  };
  
  return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Uploads multiple files to R2
 * 
 * @param {Array<{buffer: Buffer, originalName: string}>} files - Array of files to upload
 * @param {string} folder - Optional folder path in R2
 * @returns {Promise<string[]>} Array of public URLs
 */
export async function uploadMultipleToR2(files, folder = 'uploads') {
  try {
    const uploadPromises = files.map(file => 
      uploadToR2(file.buffer, file.originalName, folder)
    );
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading multiple files to R2:', error);
    throw error;
  }
}

