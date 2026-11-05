/**
 * Maintained means a stock rule exists and both floors are real numbers.
 * Zero, blank, or a missing rule means nobody set a planning policy.
 *
 * Reports and the inventory list must use this function. A stored flag
 * would drift the next time min or max is edited.
 */

export const ARTICLE_MAINTAINED = 'maintained';
export const ARTICLE_NON_MAINTAINED = 'non_maintained';

export const ARTICLE_STATUS_LABELS = {
  [ARTICLE_MAINTAINED]: 'Maintained',
  [ARTICLE_NON_MAINTAINED]: 'Non-maintained',
};

export function articleStatusFromRule(rule) {
  const min = Number(rule?.minStock);
  const max = Number(rule?.maxStock);
  if (Number.isFinite(min) && min > 0 && Number.isFinite(max) && max > 0) {
    return ARTICLE_MAINTAINED;
  }
  return ARTICLE_NON_MAINTAINED;
}

export const STOCK_LOW = 'low';
export const STOCK_OK = 'stock';
export const STOCK_OVER = 'overstock';
export const STOCK_DEAD = 'dead';

export const STOCK_STATUS_LABELS = {
  [STOCK_LOW]: 'Low stock',
  [STOCK_OK]: 'Stock',
  [STOCK_OVER]: 'Overstock',
  [STOCK_DEAD]: 'Dead stock',
};

function finiteQty(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Low, in range, and overstock apply only when min and max are both above 0.
 * Dead stock stays the product tag. It does not mean the mins are zero.
 * Reorder qty is the number saved on the rule, not maximum minus on-hand.
 */
export function classifyArticleStock(rule, qty) {
  const articleStatus = articleStatusFromRule(rule);
  const totalQuantity = Math.max(0, finiteQty(qty));
  const minQuantity = rule ? finiteQty(rule.minStock) : null;
  const maxQuantity = rule ? finiteQty(rule.maxStock) : null;

  if (rule?.deadStockMarked) {
    const reorder = Number(rule.reorderQty);
    return {
      articleStatus,
      stockStatus: STOCK_DEAD,
      reorderQty: Number.isFinite(reorder) && reorder >= 0 ? reorder : null,
      minQuantity,
      maxQuantity,
      totalQuantity,
    };
  }

  if (articleStatus !== ARTICLE_MAINTAINED) {
    return { articleStatus, stockStatus: '', reorderQty: null, minQuantity, maxQuantity, totalQuantity };
  }

  let stockStatus = STOCK_OK;
  if (totalQuantity < minQuantity) stockStatus = STOCK_LOW;
  else if (totalQuantity > maxQuantity) stockStatus = STOCK_OVER;

  const reorder = Number(rule.reorderQty);
  return {
    articleStatus,
    stockStatus,
    reorderQty: Number.isFinite(reorder) && reorder >= 0 ? reorder : 0,
    minQuantity,
    maxQuantity,
    totalQuantity,
  };
}
