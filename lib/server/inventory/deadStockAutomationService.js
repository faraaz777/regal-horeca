import mongoose from 'mongoose';
import InventoryRule from '@/lib/models/InventoryRule';
import InventoryRequest from '@/lib/models/InventoryRequest';
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
 * Thresholds on InventoryRule (not qty buckets):
 * - deadStockPeriod / deadStockQty: rolling lookback + minimum velocity
 * - Open approved reserves count toward velocity (avoid false marks mid-sale)
 * - deadStockManualClear: sticky user clear until velocity recovers
 * - deadStockArmedAt: grace after threshold edits
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
 * Fulfilled sales in [from, to] (sale_fulfill + sold-bucket sold movements).
 * Does not include approve-time sellable deductions — those are open reserves.
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

/**
 * Qty already reserved on open approved requests (stock left sellable at approve,
 * but sale_fulfill has not been written yet). Counts toward velocity so mid-flight
 * sales do not false-mark the product as dead.
 */
export async function getOpenReservedQty(productId) {
  let pid = productId;
  try {
    if (!(pid instanceof mongoose.Types.ObjectId)) {
      pid = new mongoose.Types.ObjectId(String(productId));
    }
  } catch {
    return 0;
  }

  const rows = await InventoryRequest.aggregate([
    {
      $match: {
        status: { $in: ['approved', 'partially_approved'] },
        'lines.productId': pid,
      },
    },
    { $unwind: '$lines' },
    {
      $match: {
        'lines.productId': pid,
        'lines.approvedQty': { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        qty: { $sum: '$lines.approvedQty' },
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

function graceAnchorDate(rule) {
  if (rule.deadStockArmedAt) return new Date(rule.deadStockArmedAt);
  if (rule.createdAt) return new Date(rule.createdAt);
  return null;
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
  const armedAt = graceAnchorDate(rule);

  if (armedAt && now.getTime() - armedAt.getTime() < periodMs) {
    return {
      productId: String(productId),
      action: 'skipped_too_new',
      soldQty: null,
      reservedQty: null,
      velocityQty: null,
      targetQty: rule.deadStockQty,
      sellableQty: null,
      deadStockMarked: Boolean(rule.deadStockMarked),
    };
  }

  const from = new Date(now.getTime() - periodMs);
  const [soldQty, reservedQty, sellableQty] = await Promise.all([
    getSoldQtyInPeriod(productId, from, now),
    getOpenReservedQty(productId),
    getSellableQty(productId),
  ]);

  const velocityQty = soldQty + reservedQty;
  const targetQty = Number(rule.deadStockQty) || 0;
  const currentlyMarked = Boolean(rule.deadStockMarked);
  const manualClear = Boolean(rule.deadStockManualClear);

  /**
   * Priority:
   * 1) Velocity met → clear tag + clear manual hold
   * 2) No sellable stock → clear tag (nothing left to push)
   * 3) Manual clear hold → stay unmarked
   * 4) Else under target with stock → mark
   */
  let nextMarked = currentlyMarked;
  let nextManualClear = manualClear;

  if (velocityQty >= targetQty) {
    nextMarked = false;
    nextManualClear = false;
  } else if (sellableQty <= 0) {
    nextMarked = false;
  } else if (manualClear) {
    nextMarked = false;
  } else {
    nextMarked = true;
  }

  const tagUnchanged = nextMarked === currentlyMarked;
  const holdUnchanged = nextManualClear === manualClear;
  const needsMarkedAtBackfill =
    nextMarked && !rule.deadStockMarkedAt && !dryRun;

  if (tagUnchanged && holdUnchanged && !needsMarkedAtBackfill) {
    return {
      productId: String(productId),
      action: 'unchanged',
      soldQty,
      reservedQty,
      velocityQty,
      targetQty,
      sellableQty,
      deadStockMarked: currentlyMarked,
    };
  }

  const reason = buildDeadStockVelocityReason({
    period: rule.deadStockPeriod,
    soldQty: velocityQty,
    targetQty,
    cleared: !nextMarked,
  });

  let nextMarkedAt = rule.deadStockMarkedAt || null;
  if (nextMarked && !currentlyMarked) {
    nextMarkedAt = now;
  } else if (nextMarked && !nextMarkedAt) {
    nextMarkedAt = rule.updatedAt ? new Date(rule.updatedAt) : now;
  } else if (!nextMarked) {
    nextMarkedAt = null;
  }

  if (!dryRun) {
    await InventoryRule.updateOne(
      { _id: rule._id },
      {
        $set: {
          deadStockMarked: nextMarked,
          deadStockManualClear: nextManualClear,
          deadStockMarkedAt: nextMarkedAt,
        },
      }
    );

    if (!tagUnchanged) {
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
          reservedQty,
          velocityQty,
          targetQty,
          sellableQty,
          deadStockPeriod: rule.deadStockPeriod,
          manualClear: nextManualClear,
        },
      });
    }
  }

  return {
    productId: String(productId),
    action: tagUnchanged ? 'unchanged' : nextMarked ? 'marked' : 'cleared',
    soldQty,
    reservedQty,
    velocityQty,
    targetQty,
    sellableQty,
    deadStockMarked: nextMarked,
    previousMarked: currentlyMarked,
    reason,
  };
}

/**
 * Evaluate a single product by id (after rule save or sale). No-op if no rule.
 */
export async function evaluateDeadStockForProduct(
  productId,
  { dryRun = false, userId = null, actorRole = '', request = null, now = new Date() } = {}
) {
  const rule = await InventoryRule.findOne({ productId })
    .select(
      'productId deadStockPeriod deadStockQty deadStockMarked deadStockManualClear deadStockArmedAt deadStockMarkedAt createdAt updatedAt'
    )
    .lean();
  if (!rule) return null;
  return evaluateDeadStockRule(rule, { now, dryRun, userId, actorRole, request });
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
    .select(
      'productId deadStockPeriod deadStockQty deadStockMarked deadStockManualClear deadStockArmedAt deadStockMarkedAt createdAt updatedAt'
    )
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
