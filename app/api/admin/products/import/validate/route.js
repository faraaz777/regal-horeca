/**
 * POST /api/admin/products/import/validate
 *
 * Multipart field `file` (.xlsx). Parses and validates against the live
 * brand/category trees and barcode catalog. No products are created.
 *
 * Permissions: products:write
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { assertProductWrite } from '@/lib/server/auth/adminApiGuard';
import { runProductImportValidate } from '@/lib/server/products/import/runProductImportValidate';
import { PRODUCT_IMPORT_MAX_FILE_BYTES } from '@/lib/server/products/import/productImportColumns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const authError = await assertProductWrite(request);
  if (authError) return authError;

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Choose an .xlsx file to import.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > PRODUCT_IMPORT_MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File is larger than 5 MB.' }, { status: 400 });
    }

    await connectToDatabase();
    const result = await runProductImportValidate(buffer, { originalName: file.name });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Product import validate error:', error);
    return NextResponse.json(
      { error: 'Could not validate this spreadsheet', details: error.message },
      { status: 500 }
    );
  }
}
