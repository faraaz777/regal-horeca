/**
 * GET /api/admin/products/import/template
 *
 * Downloads the blank product-entry workbook.
 * Does not write catalog data.
 *
 * Permissions: products:write
 */

import { NextResponse } from 'next/server';
import { assertProductWrite } from '@/lib/server/auth/adminApiGuard';
import { buildProductImportTemplate } from '@/lib/server/products/import/buildProductImportTemplate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const authError = await assertProductWrite(request);
  if (authError) return authError;

  try {
    const workbook = await buildProductImportTemplate();
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `regal-product-import-template.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Product import template error:', error);
    return NextResponse.json({ error: 'Could not build the import template' }, { status: 500 });
  }
}
