/**
 * File Upload API Route
 * 
 * Handles image and PDF uploads to Cloudflare R2.
 * Only authenticated admins can upload files.
 * 
 * POST /api/upload
 * Body: FormData with 'file' field
 * Headers: Authorization: Bearer <token>
 */

import { NextResponse } from 'next/server';
import { uploadToR2 } from '@/lib/utils/r2Upload';
import { optimizeImage } from '@/lib/utils/imageOptimizer';

export async function POST(request) {
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (images + PDF)
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validDocumentTypes = ['application/pdf'];
    const validTypes = [...validImageTypes, ...validDocumentTypes];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images and PDF files are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Get folder from query parameter (default: 'products')
    const url = new URL(request.url);
    const folder = url.searchParams.get('folder') || 'products';

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Skip optimization if file is 1.5MB or less (preserve original quality)
    const SKIP_OPTIMIZATION_SIZE = 1.5 * 1024 * 1024; // 1.5MB
    let optimizedBuffer = buffer;
    
    const isImage = validImageTypes.includes(file.type);
    if (isImage && file.size > SKIP_OPTIMIZATION_SIZE) {
      // Optimize image before upload (550KB limit) only if larger than 1.5MB
      optimizedBuffer = await optimizeImage(buffer);
    }

    // Upload file to R2
    const publicUrl = await uploadToR2(optimizedBuffer, file.name, folder);

    return NextResponse.json({
      success: true,
      url: publicUrl,
    });
  } catch (error) {
    console.error('Upload error:', error);
    // Return the actual error message so the client can display it
    const errorMessage = error.message || 'Failed to upload file';
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        details: error.message || String(error)
      },
      { status: 500 }
    );
  }
}

