/**
 * Revalidation API Route
 * 
 * Handles on-demand cache revalidation for Next.js server components.
 * Can be called externally (e.g., from webhooks) to trigger cache invalidation.
 * 
 * POST /api/revalidate
 * Body: { path: string, secret: string }
 */

import { NextResponse } from 'next/server';
import { revalidatePath as nextRevalidatePath } from 'next/cache';

export async function POST(request) {
  try {
    const body = await request.json();
    const { path, secret } = body;

    // Verify secret token for security
    const revalidateSecret = process.env.REVALIDATE_SECRET || 'your-revalidate-secret-change-in-production';
    
    if (!secret || secret !== revalidateSecret) {
      return NextResponse.json(
        { error: 'Invalid secret token' },
        { status: 401 }
      );
    }

    if (!path) {
      return NextResponse.json(
        { error: 'Path is required' },
        { status: 400 }
      );
    }

    // Revalidate the specified path
    nextRevalidatePath(path);

    return NextResponse.json({
      success: true,
      message: `Path ${path} revalidated successfully`,
      revalidatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json(
      { error: 'Failed to revalidate path', details: error.message },
      { status: 500 }
    );
  }
}

