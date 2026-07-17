import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Legacy mutable condition endpoint removed.
 * Inventory condition is now derived: HAS_DEAD_STOCK | NORMAL from dead_stock qty.
 */
export async function PATCH() {
  return NextResponse.json(
    {
      error:
        'Manual condition updates are no longer supported. Condition is derived from dead stock quantity (HAS_DEAD_STOCK | NORMAL).',
    },
    { status: 410 }
  );
}
