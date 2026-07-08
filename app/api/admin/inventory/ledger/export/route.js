import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { canReadStockLedger } from '@/lib/shared/permissions';
import {
  listStockLedgerEntries,
  ledgerRowsToCsv,
} from '@/lib/server/inventory/ledgerListService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/inventory/ledger/export
 *
 * Export stock movement ledger as CSV or Excel.
 */
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  if (!canReadStockLedger(auth.session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'csv').toLowerCase();

    const filters = {
      productId: searchParams.get('productId') || '',
      locationId: searchParams.get('locationId') || '',
      type: searchParams.get('type') || '',
      dateFrom: searchParams.get('dateFrom') || '',
      dateTo: searchParams.get('dateTo') || '',
      search: searchParams.get('search') || '',
      page: 1,
      limit: 5000,
    };

    const data = await listStockLedgerEntries(filters);
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'xlsx' || format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Regal Admin';
      const ws = workbook.addWorksheet('Stock movements');
      ws.columns = [
        { header: 'Timestamp', key: 'ts', width: 22 },
        { header: 'Product', key: 'product', width: 36 },
        { header: 'SKU', key: 'sku', width: 16 },
        { header: 'Type', key: 'type', width: 14 },
        { header: 'Change', key: 'change', width: 28 },
        { header: 'Reason', key: 'reason', width: 18 },
        { header: 'Remark', key: 'remark', width: 24 },
        { header: 'Ref', key: 'ref', width: 16 },
        { header: 'Location', key: 'location', width: 28 },
        { header: 'User', key: 'user', width: 20 },
        { header: 'Qty', key: 'qty', width: 8 },
      ];

      for (const row of data.items) {
        ws.addRow({
          ts: row.createdAt ? new Date(row.createdAt).toLocaleString('en-IN') : '',
          product: row.productTitle || '',
          sku: row.productSku || '',
          type: row.typeLabel || '',
          change: row.changeDisplay || '',
          reason: row.reasonLabel || '',
          remark: row.remark || '',
          ref: row.ref || '',
          location: row.locationDisplayPath || row.locationId?.path || '',
          user: row.performedBy?.name || row.performedBy?.email || '',
          qty: row.qty ?? '',
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="stock-movements-${stamp}.xlsx"`,
        },
      });
    }

    const csv = ledgerRowsToCsv(data.items);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="stock-movements-${stamp}.csv"`,
      },
    });
  } catch (error) {
    console.error('Ledger export error:', error);
    return NextResponse.json({ error: error.message || 'Export failed' }, { status: 500 });
  }
}
