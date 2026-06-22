/**
 * POST /api/admin/products/check-barcodes
 * Body: { barcodes: string[], excludeProductIds?: string[] }
 * Returns conflicts with existing catalog barcodes (for client-side pre-save validation).
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { assertProductWrite } from '@/lib/server/auth/adminApiGuard';
import { findBarcodeConflicts, normalizeBarcode } from '@/lib/server/products/barcodeValidation';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const authError = await assertProductWrite(request);
  if (authError) return authError;

  try {
    await connectToDatabase();
    const body = await request.json();
    const barcodes = Array.isArray(body?.barcodes) ? body.barcodes : [];
    const excludeProductIds = Array.isArray(body?.excludeProductIds)
      ? body.excludeProductIds.map(String).filter(Boolean)
      : [];
    const excludeParentEmbeddedId = body?.excludeParentEmbeddedId
      ? String(body.excludeParentEmbeddedId)
      : '';
    const excludeEmbeddedLegacyVariantIds = Array.isArray(body?.excludeEmbeddedLegacyVariantIds)
      ? body.excludeEmbeddedLegacyVariantIds.map(String).filter(Boolean)
      : [];

    const normalized = barcodes.map(normalizeBarcode).filter(Boolean);
    const conflicts = await findBarcodeConflicts(normalized, {
      excludeProductIds,
      excludeParentEmbeddedId,
      excludeEmbeddedLegacyVariantIds,
    });

    return NextResponse.json({
      success: true,
      ok: conflicts.length === 0,
      conflicts,
    });
  } catch (error) {
    console.error('check-barcodes error:', error);
    return NextResponse.json(
      { error: 'Failed to check barcodes', details: error.message },
      { status: 500 }
    );
  }
}
