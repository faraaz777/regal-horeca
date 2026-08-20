import 'server-only';

import mongoose from 'mongoose';
import StockLedger from '@/lib/models/StockLedger';
import Product from '@/lib/models/Product';

/**
 * My Sales
 *
 * Totals and today's lines for the salesman who is logged in.
 *
 * Reads only `sale_fulfill` rows credited to them. That is stock that has
 * actually left — request fulfil and walk-in Sold both write that row.
 * Draft quotes and open requests never appear here.
 *
 * Dates are calendar days in Asia/Kolkata, matching the rest of admin.
 */

const TZ = 'Asia/Kolkata';
const MAX_TODAY_LINES = 50;

/** `YYYY-MM-DD` for `date` in IST. */
function istYmd(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Instant of 00:00 IST on the given `YYYY-MM-DD`. */
function istMidnight(ymd) {
  return new Date(`${ymd}T00:00:00+05:30`);
}

function absQty(qty) {
  return Math.abs(Number(qty) || 0);
}

export async function getMySales(session) {
  const now = new Date();
  const todayYmd = istYmd(now);
  const todayStart = istMidnight(todayYmd);
  const monthStart = istMidnight(`${todayYmd.slice(0, 7)}-01`);

  const userId = new mongoose.Types.ObjectId(String(session.userId));

  const match = {
    soldForUserId: userId,
    type: 'sale_fulfill',
    createdAt: { $gte: monthStart },
  };

  const [totalsAgg, todayRows] = await Promise.all([
    StockLedger.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          monthQty: { $sum: { $abs: '$qty' } },
          todayQty: {
            $sum: {
              $cond: [{ $gte: ['$createdAt', todayStart] }, { $abs: '$qty' }, 0],
            },
          },
        },
      },
    ]),
    StockLedger.find({
      ...match,
      createdAt: { $gte: todayStart },
    })
      .select('productId qty createdAt ref')
      .sort({ createdAt: -1 })
      .limit(MAX_TODAY_LINES)
      .lean(),
  ]);

  const totals = totalsAgg[0] || { monthQty: 0, todayQty: 0 };

  const productIds = [...new Set(todayRows.map((row) => String(row.productId)))];
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } })
        .select('title sku')
        .lean()
    : [];
  const productById = new Map(products.map((p) => [String(p._id), p]));

  return {
    todayQty: totals.todayQty || 0,
    monthQty: totals.monthQty || 0,
    today: todayRows.map((row) => {
      const product = productById.get(String(row.productId));
      return {
        id: String(row._id),
        productTitle: product?.title || '—',
        productSku: product?.sku || '',
        qty: absQty(row.qty),
        ref: row.ref || '',
        createdAt: row.createdAt,
      };
    }),
  };
}
