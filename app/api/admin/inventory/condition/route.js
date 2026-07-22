import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Legacy mutable condition endpoint removed.
 * Condition is the product-wide dead-stock TAG (InventoryRule.deadStockMarked):
 * HAS_DEAD_STOCK | NORMAL. Sales may still sell tagged products.
 */
export async function PATCH() {
  return NextResponse.json(
    {
      error:
        'Manual condition updates are no longer supported. Condition is the product dead-stock tag (HAS_DEAD_STOCK | NORMAL).',
    },
    { status: 410 }
  );
}
