/**
 * POST /api/admin/inventory/brand-report/export
 *
 * format=json returns the filtered rows (capped) for preview and PDF.
 * format=xlsx returns the workbook. rowIds limits the export to ticked rows.
 * columns limits Excel to the same visible fields as the on-screen table.
 * An empty selection exports the filtered set up to the cap.
 *
 * Permissions: inventory:read
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import {
  buildBrandReportWorkbook,
  flattenBrandReportRows,
  queryBrandReport,
} from '@/lib/server/inventory/brandReportService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const format = String(body.format || 'json').toLowerCase();
    const report = await queryBrandReport(body, {
      forExport: true,
      rowIds: Array.isArray(body.rowIds) ? body.rowIds : [],
    });
    if (report.needsFilter) {
      return NextResponse.json(
        { error: 'Choose a filter, or search with at least two characters.' },
        { status: 400 }
      );
    }

    const rows = flattenBrandReportRows(report.groups);

    if (format === 'xlsx' || format === 'excel') {
      const workbook = await buildBrandReportWorkbook(rows, body.columns);
      const buffer = await workbook.xlsx.writeBuffer();
      const stamp = new Date().toISOString().slice(0, 10);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="brand-report-${stamp}.xlsx"`,
          'X-Export-Capped': report.exportCapped || report.scanCapped ? '1' : '0',
        },
      });
    }

    return NextResponse.json({
      success: true,
      rows,
      totals: {
        families: report.totals.families,
        variants: rows.length,
        qty: rows.reduce((sum, row) => sum + row.totalQuantity, 0),
      },
      scanCapped: report.scanCapped,
      exportCapped: report.exportCapped || rows.length >= report.exportCap,
      exportCap: report.exportCap,
      generatedAt: report.generatedAt,
      needsFilter: report.needsFilter,
    });
  } catch (error) {
    console.error('Brand report export error:', error);
    return NextResponse.json({ error: error.message || 'Export failed' }, { status: 500 });
  }
}
