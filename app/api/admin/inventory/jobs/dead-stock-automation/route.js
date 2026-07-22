import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { runDeadStockAutomationJob } from '@/lib/server/inventory/deadStockAutomationService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/inventory/jobs/dead-stock-automation
 *
 * Evaluates InventoryRule velocity thresholds and updates deadStockMarked.
 * Body: { dryRun?: boolean }
 *
 * Permissions: inventory:write
 *
 * Schedule externally (cron / Vercel cron) by calling this endpoint with a secret
 * or by running: node scripts/runDeadStockAutomation.mjs
 */
export async function POST(request) {
  const auth = await requireAuth(request, { permission: 'inventory:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json().catch(() => ({}));
    const dryRun = Boolean(body?.dryRun);

    const result = await runDeadStockAutomationJob({
      dryRun,
      userId: auth.session.userId,
      actorRole: auth.session.role || '',
      request,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Dead stock automation failed:', error);
    return NextResponse.json(
      { error: error.message || 'Dead stock automation failed' },
      { status: 500 }
    );
  }
}
