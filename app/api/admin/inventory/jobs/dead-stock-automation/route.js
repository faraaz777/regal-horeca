import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { runDeadStockAutomationJob } from '@/lib/server/inventory/deadStockAutomationService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Dead-stock velocity job.
 *
 * Auth (either):
 * - Logged-in inventory:write
 * - Cron: Authorization Bearer CRON_SECRET (or ?secret=)
 *
 * Schedule via Vercel cron (vercel.json) or: npm run job:dead-stock
 */

function cronAuthorized(request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const querySecret = new URL(request.url).searchParams.get('secret') || '';
  return bearer === expected || querySecret === expected;
}

async function runJob(request, { dryRun = false, userId = null, actorRole = 'system' } = {}) {
  await connectToDatabase();
  return runDeadStockAutomationJob({
    dryRun,
    userId,
    actorRole,
    request,
  });
}

export async function GET(request) {
  // Vercel Cron invokes GET. Require CRON_SECRET in production schedules.
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dryRun = new URL(request.url).searchParams.get('dryRun') === 'true';
    const result = await runJob(request, { dryRun, actorRole: 'system' });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Dead stock automation failed:', error);
    return NextResponse.json(
      { error: error.message || 'Dead stock automation failed' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const dryRun = Boolean(body?.dryRun);

  if (cronAuthorized(request)) {
    try {
      const result = await runJob(request, { dryRun, actorRole: 'system' });
      return NextResponse.json(result);
    } catch (error) {
      console.error('Dead stock automation failed:', error);
      return NextResponse.json(
        { error: error.message || 'Dead stock automation failed' },
        { status: 500 }
      );
    }
  }

  const auth = await requireAuth(request, { permission: 'inventory:write' });
  if (auth.error) return auth.error;

  try {
    const result = await runJob(request, {
      dryRun,
      userId: auth.session.userId,
      actorRole: auth.session.role || '',
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
