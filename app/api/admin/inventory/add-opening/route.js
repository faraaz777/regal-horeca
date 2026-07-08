import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import {
  addOpeningStockToExisting,
} from '@/lib/server/inventory/addToInventoryService';
import {
  addOpeningSchema,
  additionalOpeningSchema,
  formatZodError,
} from '@/lib/server/inventory/schemas';
import { productHasLedgerEntries } from '@/lib/server/inventory/stockLedgerService';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request, { permission: 'inventory:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();

    const hasLedger = body?.productId
      ? await productHasLedgerEntries(body.productId)
      : false;

    const parsed = hasLedger
      ? additionalOpeningSchema.safeParse(body)
      : addOpeningSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const opening = hasLedger
      ? {
          minStock: 0,
          maxStock: 0,
          reorderQty: 0,
          deadStockPeriod: 'month',
          deadStockQty: 1,
          locationEntries: parsed.data.locationEntries?.length
            ? parsed.data.locationEntries
            : parsed.data.locationIds?.length
              ? parsed.data.locationIds.map((locationId) => ({
                  locationId,
                  qty: parsed.data.openingQty,
                }))
              : parsed.data.locationId
                ? [{ locationId: parsed.data.locationId, qty: parsed.data.openingQty }]
                : [],
          openingStatusBucket: parsed.data.openingStatusBucket,
          openingReason: parsed.data.openingReason,
          openingRatePaise: parsed.data.openingRatePaise,
          remark: parsed.data.remark,
          markAsDeadStock: parsed.data.markAsDeadStock,
        }
      : parsed.data.opening;

    const product = await addOpeningStockToExisting({
      productId: hasLedger ? parsed.data.productId : parsed.data.productId,
      opening,
      session: auth.session,
      request,
    });

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('add-opening error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
