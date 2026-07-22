import 'server-only';

import InventoryRule from '@/lib/models/InventoryRule';
import Stock from '@/lib/models/Stock';
import StockLedger from '@/lib/models/StockLedger';
import { logAudit } from '@/lib/server/audit/logAudit';
import {
  buildDeadStockVelocityReason,
  logDeadStockTagChange,
} from '@/lib/server/inventory/deadStockAudit';

/**
 * Dead-stock velocity automation
 *
 * Uses InventoryRule thresholds (not qty buckets):
 * - deadStockPeriod: lookback window
 * - deadStockQty: minimum units that should sell in that window
 *
 * If sold qty in the period is below the target AND the product still has
 * sellable stock, set deadStockMarked = true.
 * If sold qty meets/exceeds the target, clear the tag.
 *
 * Brand-new rules (created within the period) are skipped so intake
 * does not instantly mark every product as dead stock.
 */

const MS_DAY = 24 * 60 * 60 * 1000;

export function deadStockPeriodMs(period) {
  switch (period) {
    case 'day':
      return 1 * MS_DAY;
    case 'week':
      return 7 * MS_DAY;
    case 'month':
      return 30 * MS_DAY;
    case '3month':
      return 90 * MS_DAY;
    case '6month':
      return 180 * MS_DAY;
    default:
      return 30 * MS_DAY;
  }
}

/**
 * Sold qty in [from, to] from ledger (sale fulfill + sold movements).
 * Ledger sold qty is typically negative — we sum absolute values.
 */
export async function getSoldQtyInPeriod(productId, from, to) {
  const rows = await StockLedger.aggregate([
    {
      $match: {
        productId,
        createdAt: { $gte: from, $lte: to },
        $or: [{ type: 'sale_fulfill' }, { reason: 'sold', statusBucket: 'sold' }],
      },
    },
    {
      $group: {
        _id: null,
        qty: { $sum: { $abs: '$qty' } },
      },
    },
  ]);
  return rows[0]?.qty || 0;
}

async function getSellableQty(productId) {
  const rows = await Stock.find({
    productId,
    statusBucket: 'sellable',
    qty: { $gt: 0 },
  })
    .select('qty')
    .lean();
  return rows.reduce((s, r) => s + (r.qty || 0), 0);
}

/**
 * Evaluate one product rule. Returns change summary.
 * When the tag flips (and not dry-run), writes a per-product AuditLog entry.
 */
export async function evaluateDeadStockRule(
  rule,
  { now = new Date(), dryRun = false, userId = null, actorRole = '', request = null } = {}
) {
  const productId = rule.productId;
  const periodMs = deadStockPeriodMs(rule.deadStockPeriod);
  const createdAt = rule.createdAt ? new Date(rule.createdAt) : null;

  /**
   * Wait until a full period has elapsed since the rule was created.
   * Avoids marking brand-new intake as dead stock with zero sales history.
   */
  if (createdAt && now.getTime() - createdAt.getTime() < periodMs) {
    return {
      productId: String(productId),
      action: 'skipped_too_new',
      soldQty: null,
      targetQty: rule.deadStockQty,
      sellableQty: null,
      deadStockMarked: Boolean(rule.deadStockMarked),
    };
  }

  const from = new Date(now.getTime() - periodMs);
  const [soldQty, sellableQty] = await Promise.all([
    getSoldQtyInPeriod(productId, from, now),
    getSellableQty(productId),
  ]);

  const targetQty = Number(rule.deadStockQty) || 0;
  const currentlyMarked = Boolean(rule.deadStockMarked);

  /**
   * Mark when under sales target and still holding stock.
   * Clear when sales meet/exceed target (velocity recovered).
   * Zero sellable + under target → leave tag as-is (no stock to push).
   */
  let nextMarked = currentlyMarked;
  if (soldQty >= targetQty) {
    nextMarked = false;
  } else if (sellableQty > 0) {
    nextMarked = true;
  }

  if (nextMarked === currentlyMarked) {
    return {
      productId: String(productId),
      action: 'unchanged',
      soldQty,
      targetQty,
      sellableQty,
      deadStockMarked: currentlyMarked,
    };
  }

  const reason = buildDeadStockVelocityReason({
    period: rule.deadStockPeriod,
    soldQty,
    targetQty,
    cleared: !nextMarked,
  });

  if (!dryRun) {
    await InventoryRule.updateOne(
      { _id: rule._id },
      { $set: { deadStockMarked: nextMarked } }
    );

    await logDeadStockTagChange({
      productId,
      previousMarked: currentlyMarked,
      nextMarked,
      source: 'automation',
      reason,
      userId,
      actorRole: actorRole || 'system',
      request,
      metadata: {
        soldQty,
        targetQty,
        sellableQty,
        deadStockPeriod: rule.deadStockPeriod,
      },
    });
  }

  return {
    productId: String(productId),
    action: nextMarked ? 'marked' : 'cleared',
    soldQty,
    targetQty,
    sellableQty,
    deadStockMarked: nextMarked,
    previousMarked: currentlyMarked,
    reason,
  };
}

/**
 * Run dead-stock velocity evaluation for all InventoryRule rows.
 */
export async function runDeadStockAutomationJob({
  dryRun = false,
  userId = null,
  actorRole = '',
  request = null,
  now = new Date(),
} = {}) {
  const rules = await InventoryRule.find({})
    .select('productId deadStockPeriod deadStockQty deadStockMarked createdAt')
    .lean();

  const results = {
    evaluated: 0,
    marked: 0,
    cleared: 0,
    unchanged: 0,
    skippedTooNew: 0,
    changes: [],
  };

  for (const rule of rules) {
    const outcome = await evaluateDeadStockRule(rule, {
      now,
      dryRun,
      userId,
      actorRole,
      request,
    });
    results.evaluated += 1;

    if (outcome.action === 'marked') {
      results.marked += 1;
      results.changes.push(outcome);
    } else if (outcome.action === 'cleared') {
      results.cleared += 1;
      results.changes.push(outcome);
    } else if (outcome.action === 'skipped_too_new') {
      results.skippedTooNew += 1;
    } else {
      results.unchanged += 1;
    }
  }

  /** Job-level summary — per-product history is written in evaluateDeadStockRule. */
  if (!dryRun && (results.marked > 0 || results.cleared > 0)) {
    await logAudit({
      actorId: userId,
      actorRole: actorRole || 'system',
      action: 'inventory.dead_stock_automation',
      entityType: 'InventoryRule',
      entityId: null,
      before: null,
      after: {
        evaluated: results.evaluated,
        marked: results.marked,
        cleared: results.cleared,
        skippedTooNew: results.skippedTooNew,
      },
      metadata: { dryRun: false, changeCount: results.changes.length },
      request,
    });
  }

  return {
    success: true,
    dryRun,
    ranAt: now.toISOString(),
    ...results,
  };
}
