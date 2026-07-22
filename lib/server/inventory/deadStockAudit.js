import 'server-only';

import { logAudit } from '@/lib/server/audit/logAudit';
import { DEAD_STOCK_PERIOD_LABELS } from '@/lib/shared/inventoryConstants';

/**
 * Per-product AuditLog history for dead-stock TAG changes.
 * Stock movements ledger stays qty-only — this answers "why is it dead stock?"
 *
 * Actions:
 * - inventory.dead_stock_marked
 * - inventory.dead_stock_cleared
 */

function conditionLabel(marked) {
  return marked ? 'HAS_DEAD_STOCK' : 'NORMAL';
}

export function buildDeadStockVelocityReason({
  period,
  soldQty,
  targetQty,
  cleared = false,
}) {
  const periodLabel = DEAD_STOCK_PERIOD_LABELS[period] || period || 'period';
  if (cleared) {
    return `Sales recovered: sold ${soldQty} / target ${targetQty} in ${periodLabel}`;
  }
  return `${periodLabel} sales rule failed: sold ${soldQty} / target ${targetQty}`;
}

/**
 * Write one AuditLog row when deadStockMarked flips.
 * No-op if before === after.
 */
export async function logDeadStockTagChange({
  productId,
  productTitle = '',
  previousMarked,
  nextMarked,
  source = 'manual',
  reason = '',
  userId = null,
  actorRole = '',
  request = null,
  metadata = {},
}) {
  const prev = Boolean(previousMarked);
  const next = Boolean(nextMarked);
  if (prev === next) return null;

  const action = next ? 'inventory.dead_stock_marked' : 'inventory.dead_stock_cleared';
  const defaultReason = next
    ? source === 'automation'
      ? 'Dead stock velocity rule failed'
      : source === 'opening'
        ? 'Marked at inventory opening'
        : 'Manually marked as dead stock'
    : source === 'automation'
      ? 'Dead stock velocity recovered'
      : source === 'opening'
        ? 'Cleared at inventory opening'
        : 'Manually cleared dead stock tag';

  await logAudit({
    actorId: userId,
    actorRole: actorRole || (source === 'automation' ? 'system' : ''),
    action,
    entityType: 'Product',
    entityId: productId,
    before: {
      condition: conditionLabel(prev),
      deadStockMarked: prev,
    },
    after: {
      condition: conditionLabel(next),
      deadStockMarked: next,
    },
    metadata: {
      source,
      reason: reason || defaultReason,
      productTitle: productTitle || '',
      ...metadata,
    },
    request,
  });

  return action;
}
