import 'server-only';

import mongoose from 'mongoose';
import StockLedger from '@/lib/models/StockLedger';
import Stock from '@/lib/models/Stock';
import Product from '@/lib/models/Product';
import User from '@/lib/server/models/User';
import { LEDGER_TYPE_FILTER_MAP, MOVEMENT_REASON_LABELS, OPENING_REASON_LABELS } from '@/lib/shared/inventoryConstants';
import {
  addIsoDays,
  formatIsoDayLabel,
  inclusiveIsoDays,
  istTodayIso,
  ledgerDayEnd,
  ledgerDayStart,
  monthStartIso,
  normalizeLedgerDateInputs,
  weekdayLabel,
  weekStartIso,
  LEDGER_TIME_ZONE,
} from '@/lib/shared/ledgerCalendar';
import { resolveMovementProductClause } from '@/lib/server/inventory/movementProductSearch';
import { branchName, branchOf, ledgerLocationClause } from '@/lib/server/inventory/ledgerLocationScope';

/**
 * Insights count events. They do not add pieces, kilograms, and cartons together.
 *
 * Opening is type `opening` only. Stock in is `adjustment_add` only.
 * A transfer is one event: the `transfer_out` leg. `transfer_in` is the destination
 * half and is not a second company-level receipt.
 * Manual adjustments are the recorded reason enum, never text in the remark.
 */

const CATEGORIES = [
  { id: 'opening', label: 'Opening', types: ['opening'] },
  { id: 'add', label: 'Add', types: ['adjustment_add'] },
  { id: 'minus', label: 'Minus', types: ['adjustment_minus'] },
  { id: 'transfer', label: 'Transfer', types: ['transfer_out'] },
  { id: 'sold', label: 'Sold', types: ['sale_fulfill'] },
];

const LEGACY_TYPES = ['condition_change', 'reservation_hold'];
const MANUAL_REASONS = ['manual_adjustment', 'custom_add', 'custom_minus'];
const OUTBOUND_TYPES = ['adjustment_minus', 'sale_fulfill', 'transfer_out'];
const REASON_LABELS = { ...OPENING_REASON_LABELS, ...MOVEMENT_REASON_LABELS, transfer: 'Transfer' };

function reasonLabel(reason) {
  return REASON_LABELS[reason] || reason || 'Unspecified reason';
}

function percentChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function emptySentence() {
  return 'Nothing in this range.';
}

function resolveWindow(dateFrom, dateTo) {
  const range = normalizeLedgerDateInputs(dateFrom, dateTo);
  if (!range.dateFrom && !range.dateTo) {
    const to = istTodayIso();
    const from = addIsoDays(to, -29);
    return { from, to, label: 'Last 30 days', assumed: true };
  }
  const from = range.dateFrom || range.dateTo;
  const to = range.dateTo || range.dateFrom;
  return {
    from,
    to,
    label: `${formatIsoDayLabel(from)} – ${formatIsoDayLabel(to)}`,
    assumed: false,
  };
}

function previousWindow(from, to) {
  const days = inclusiveIsoDays(from, to).length || 1;
  const prevTo = addIsoDays(from, -1);
  const prevFrom = addIsoDays(prevTo, -(days - 1));
  return { from: prevFrom, to: prevTo };
}

function allowedBuckets(dayCount) {
  const options = ['day'];
  if (dayCount > 31) options.push('week');
  if (dayCount > 90) options.push('month');
  return options;
}

function defaultBucket(dayCount) {
  if (dayCount > 90) return 'month';
  if (dayCount > 31) return 'week';
  return 'day';
}

async function baseMatch(filters, window) {
  const match = {};
  const productFilter = await resolveMovementProductClause({
    productId: filters.productId,
    search: filters.search,
  });
  if (productFilter.clause) Object.assign(match, productFilter.clause);

  const location = await ledgerLocationClause({
    locationId: filters.locationId,
    branchId: filters.branchId,
  });
  if (location.clause) Object.assign(match, location.clause);

  const types = filters.type ? LEDGER_TYPE_FILTER_MAP[filters.type] : null;
  if (types?.length) match.type = { $in: types };

  const from = ledgerDayStart(window.from);
  const to = ledgerDayEnd(window.to);
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = from;
    if (to) match.createdAt.$lte = to;
  }

  if (filters.userId && mongoose.Types.ObjectId.isValid(String(filters.userId))) {
    match.performedBy = new mongoose.Types.ObjectId(String(filters.userId));
  }

  return { match, byId: location.byId, truncated: Boolean(productFilter.truncated) };
}

function countCategories(row) {
  return CATEGORIES.reduce((sum, category) => sum + (Number(row?.[category.id]) || 0), 0);
}

async function categoryCounts(match) {
  const [row] = await StockLedger.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        opening: { $sum: { $cond: [{ $eq: ['$type', 'opening'] }, 1, 0] } },
        add: { $sum: { $cond: [{ $eq: ['$type', 'adjustment_add'] }, 1, 0] } },
        minus: { $sum: { $cond: [{ $eq: ['$type', 'adjustment_minus'] }, 1, 0] } },
        transfer: { $sum: { $cond: [{ $eq: ['$type', 'transfer_out'] }, 1, 0] } },
        sold: { $sum: { $cond: [{ $eq: ['$type', 'sale_fulfill'] }, 1, 0] } },
        legacy: { $sum: { $cond: [{ $in: ['$type', LEGACY_TYPES] }, 1, 0] } },
        manual: { $sum: { $cond: [{ $in: ['$reason', MANUAL_REASONS] }, 1, 0] } },
        stockOut: {
          $sum: { $cond: [{ $in: ['$type', ['adjustment_minus', 'sale_fulfill']] }, 1, 0] },
        },
      },
    },
  ]);
  return row || {};
}

async function dailyRows(match) {
  return StockLedger.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: LEDGER_TIME_ZONE },
        },
        opening: { $sum: { $cond: [{ $eq: ['$type', 'opening'] }, 1, 0] } },
        add: { $sum: { $cond: [{ $eq: ['$type', 'adjustment_add'] }, 1, 0] } },
        minus: { $sum: { $cond: [{ $eq: ['$type', 'adjustment_minus'] }, 1, 0] } },
        transfer: { $sum: { $cond: [{ $eq: ['$type', 'transfer_out'] }, 1, 0] } },
        sold: { $sum: { $cond: [{ $eq: ['$type', 'sale_fulfill'] }, 1, 0] } },
      },
    },
  ]);
}

function bucketEnd(date, bucket) {
  if (bucket === 'week') return addIsoDays(date, 6);
  if (bucket === 'month') return addIsoDays(`${addIsoDays(date, 32).slice(0, 7)}-01`, -1);
  return date;
}

function bucketSeries(days, bucket) {
  const groups = new Map();
  for (const day of days) {
    const key = bucket === 'month' ? monthStartIso(day.date) : bucket === 'week' ? weekStartIso(day.date) : day.date;
    if (!groups.has(key)) {
      groups.set(key, { date: key, opening: 0, add: 0, minus: 0, transfer: 0, sold: 0 });
    }
    const group = groups.get(key);
    for (const category of CATEGORIES) group[category.id] += day[category.id];
  }
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date)).map((group) => {
    const dateTo = bucketEnd(group.date, bucket);
    return {
      ...group,
      dateTo,
      label: bucket === 'day' ? formatIsoDayLabel(group.date) : `${formatIsoDayLabel(group.date)} – ${formatIsoDayLabel(dateTo)}`,
      total: countCategories(group),
    };
  });
}

function withTypes(match, types) {
  const next = { ...match };
  if (next.type?.$in) {
    const allowed = new Set(next.type.$in);
    const intersection = types.filter((type) => allowed.has(type));
    if (!intersection.length) return null;
    next.type = { $in: intersection };
    return next;
  }
  next.type = { $in: types };
  return next;
}

function pairTransfers(legs) {
  const ins = legs.filter((leg) => leg.type === 'transfer_in');
  const used = new Set();
  const pairs = [];
  const unpaired = [];
  for (const out of legs.filter((leg) => leg.type === 'transfer_out')) {
    const index = ins.findIndex((inn, innIndex) => {
      if (used.has(innIndex)) return false;
      if (String(inn.productId) !== String(out.productId)) return false;
      if (Math.abs(Number(inn.qty)) !== Math.abs(Number(out.qty))) return false;
      const refOut = String(out.ref || '').trim();
      const refIn = String(inn.ref || '').trim();
      if (refOut && refIn) return refOut === refIn;
      if (refOut || refIn) return false;
      if (String(inn.performedBy) !== String(out.performedBy)) return false;
      return Math.abs(new Date(inn.createdAt) - new Date(out.createdAt)) <= 3000;
    });
    if (index < 0) {
      unpaired.push(out);
      continue;
    }
    used.add(index);
    pairs.push({ out, inn: ins[index] });
  }
  return { pairs, unpaired };
}

function agingBucket(days) {
  if (days == null) return 'unknown';
  if (days <= 30) return '0-30';
  if (days <= 45) return '31-45';
  if (days <= 60) return '46-60';
  if (days <= 90) return '61-90';
  return '90+';
}

/**
 * GET /api/admin/inventory/activity/insights
 *
 * Count-based inventory analytics for the selected Kolkata date window.
 */
export async function getMovementInsights(filters = {}) {
  const window = resolveWindow(filters.dateFrom, filters.dateTo);
  const previous = previousWindow(window.from, window.to);
  const dayCount = inclusiveIsoDays(window.from, window.to).length;
  const buckets = allowedBuckets(dayCount);
  const bucket = buckets.includes(filters.bucket) ? filters.bucket : defaultBucket(dayCount);

  const [{ match, byId, truncated }, previousBuilt] = await Promise.all([
    baseMatch(filters, window),
    baseMatch(filters, previous),
  ]);

  const outboundMatch = withTypes(match, OUTBOUND_TYPES);
  const transferMatch = withTypes(match, ['transfer_out', 'transfer_in']);
  const adjustmentMatch = withTypes(match, ['adjustment_add', 'adjustment_minus']);

  const [current, prior, daily, locationGroups, outbound, adjustmentReasons, adjustmentProducts, adjustmentOperators, transferLegs] = await Promise.all([
    categoryCounts(match),
    categoryCounts(previousBuilt.match),
    dailyRows(match),
    StockLedger.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$locationId',
          add: { $sum: { $cond: [{ $eq: ['$type', 'adjustment_add'] }, 1, 0] } },
          out: { $sum: { $cond: [{ $in: ['$type', ['adjustment_minus', 'sale_fulfill']] }, 1, 0] } },
          transfer: { $sum: { $cond: [{ $eq: ['$type', 'transfer_out'] }, 1, 0] } },
          manual: { $sum: { $cond: [{ $in: ['$reason', MANUAL_REASONS] }, 1, 0] } },
        },
      },
    ]),
    outboundMatch
      ? StockLedger.aggregate([
      { $match: outboundMatch },
      { $group: { _id: '$productId', count: { $sum: 1 }, qty: { $sum: { $abs: '$qty' } } } },
      { $sort: { count: -1 } },
      { $limit: 200 },
    ])
      : [],
    adjustmentMatch
      ? StockLedger.aggregate([
        { $match: adjustmentMatch },
        { $group: { _id: '$reason', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      : [],
    adjustmentMatch
      ? StockLedger.aggregate([
        { $match: adjustmentMatch },
        { $group: { _id: '$productId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ])
      : [],
    adjustmentMatch
      ? StockLedger.aggregate([
        { $match: adjustmentMatch },
        { $group: { _id: '$performedBy', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ])
      : [],
    transferMatch
      ? StockLedger.find(transferMatch)
        .select('type productId locationId qty ref performedBy createdAt')
        .lean()
      : [],
  ]);

  const byDate = new Map(daily.map((row) => [row._id, row]));
  const filledDays = inclusiveIsoDays(window.from, window.to).map((date) => {
    const row = byDate.get(date) || {};
    return {
      date,
      label: formatIsoDayLabel(date),
      opening: Number(row.opening) || 0,
      add: Number(row.add) || 0,
      minus: Number(row.minus) || 0,
      transfer: Number(row.transfer) || 0,
      sold: Number(row.sold) || 0,
    };
  });
  const trends = Object.fromEntries(buckets.map((name) => [name, bucketSeries(filledDays, name)]));
  const trend = trends[bucket] || bucketSeries(filledDays, bucket);

  const total = countCategories(current);
  const previousTotal = countCategories(prior);
  const kpis = [
    { id: 'total', title: 'Total movement events', value: total, previous: previousTotal, meaning: 'Opening, add, minus, sold, and one count per transfer. Older record types are separate.' },
    { id: 'in', title: 'Stock in events', value: Number(current.add) || 0, previous: Number(prior.add) || 0, meaning: 'Add movements only. Opening balances are not receipts.' },
    { id: 'out', title: 'Stock out events', value: Number(current.stockOut) || 0, previous: Number(prior.stockOut) || 0, meaning: 'Minus and sold events. Transfers are not treated as stock leaving the company.' },
    { id: 'transfer', title: 'Internal transfers', value: Number(current.transfer) || 0, previous: Number(prior.transfer) || 0, meaning: 'Each transfer is counted once, from the source rack.' },
    { id: 'manual', title: 'Manual adjustments', value: Number(current.manual) || 0, previous: Number(prior.manual) || 0, meaning: 'Rows recorded as manual adjustment, custom add, or custom minus.' },
  ].map((kpi) => ({
    ...kpi,
    changePct: percentChange(kpi.value, kpi.previous),
  }));

  const distribution = CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    count: Number(current[category.id]) || 0,
    pct: total ? Math.round(((Number(current[category.id]) || 0) / total) * 100) : 0,
  }));

  const productIds = [
    ...outbound.map((row) => row._id),
    ...adjustmentProducts.map((row) => row._id),
    ...transferLegs.map((row) => row.productId),
  ].filter(Boolean);
  const uniqueProductIds = [...new Set(productIds.map((id) => String(id)))];
  const products = uniqueProductIds.length
    ? await Product.find({ _id: { $in: uniqueProductIds } }).select('title sku stockUnit').lean()
    : [];
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const units = [...new Set(products.map((product) => product.stockUnit || 'Pcs'))].sort();
  const unit = filters.unit && units.includes(filters.unit) ? filters.unit : '';
  let ranked = outbound.map((row) => {
    const product = productMap.get(String(row._id));
    return {
      productId: String(row._id),
      title: product?.title || 'Unknown product',
      sku: product?.sku || '',
      unit: product?.stockUnit || 'Pcs',
      count: Number(row.count) || 0,
      qty: Number(row.qty) || 0,
    };
  });
  if (unit) {
    ranked = ranked.filter((row) => row.unit === unit).sort((a, b) => b.qty - a.qty);
  }
  const topProducts = ranked.slice(0, 10);
  const topCount = topProducts.reduce((sum, row) => sum + (unit ? row.qty : row.count), 0);

  const branchRollup = new Map();
  for (const row of locationGroups) {
    const branch = branchOf(row._id, byId);
    const key = branch ? String(branch._id) : 'unknown';
    if (!branchRollup.has(key)) {
      branchRollup.set(key, {
        branchId: branch ? String(branch._id) : '',
        name: branchName(branch),
        add: 0,
        out: 0,
        transfer: 0,
        manual: 0,
      });
    }
    const bucketRow = branchRollup.get(key);
    bucketRow.add += Number(row.add) || 0;
    bucketRow.out += Number(row.out) || 0;
    bucketRow.transfer += Number(row.transfer) || 0;
    bucketRow.manual += Number(row.manual) || 0;
  }
  const branches = [...branchRollup.values()]
    .map((row) => ({ ...row, total: row.add + row.out + row.transfer + row.manual }))
    .sort((a, b) => b.total - a.total);

  const operatorIds = adjustmentOperators.map((row) => row._id).filter(Boolean);
  const operators = operatorIds.length
    ? await User.find({ _id: { $in: operatorIds } }).select('name email').lean()
    : [];
  const operatorMap = new Map(operators.map((user) => [String(user._id), user]));

  const { pairs, unpaired } = pairTransfers(transferLegs);
  const routeMap = new Map();
  for (const pair of pairs) {
    const source = branchOf(pair.out.locationId, byId);
    const dest = branchOf(pair.inn.locationId, byId);
    const key = `${source ? String(source._id) : ''}>${dest ? String(dest._id) : ''}`;
    if (!routeMap.has(key)) {
      routeMap.set(key, {
        sourceBranchId: source ? String(source._id) : '',
        destinationBranchId: dest ? String(dest._id) : '',
        source: branchName(source),
        destination: branchName(dest),
        count: 0,
        qty: 0,
        units: new Set(),
        refs: [],
      });
    }
    const route = routeMap.get(key);
    const product = productMap.get(String(pair.out.productId));
    route.count += 1;
    route.qty += Math.abs(Number(pair.out.qty) || 0);
    route.units.add(product?.stockUnit || 'Pcs');
    const ref = String(pair.out.ref || '').trim();
    if (ref && route.refs.length < 50) route.refs.push(ref);
  }
  const routes = [...routeMap.values()]
    .map((route) => ({
      sourceBranchId: route.sourceBranchId,
      destinationBranchId: route.destinationBranchId,
      source: route.source,
      destination: route.destination,
      count: route.count,
      qty: route.units.size === 1 ? route.qty : null,
      unit: route.units.size === 1 ? [...route.units][0] : '',
      refs: [...new Set(route.refs)],
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const calendarMonth = monthStartIso(filters.calendarMonth || window.to);
  const calendarEnd = addIsoDays(addIsoDays(calendarMonth, 32).slice(0, 7) + '-01', -1);
  const calendarDays = inclusiveIsoDays(calendarMonth, calendarEnd).map((date) => {
    const inRange = date >= window.from && date <= window.to;
    const row = byDate.get(date);
    return {
      date,
      label: formatIsoDayLabel(date),
      count: inRange ? countCategories(row || {}) : null,
      inRange,
    };
  });

  const aging = await buildAging({
    filters,
    byId,
    productIds: productIdsFromClause(match),
  });

  const busiest = [...trend].sort((a, b) => b.total - a.total)[0];
  const dominant = [...distribution].sort((a, b) => b.count - a.count)[0];
  const topProduct = topProducts[0];
  const topBranch = branches[0];
  const topReason = adjustmentReasons[0];
  const busiestDay = [...filledDays].sort((a, b) => countCategories(b) - countCategories(a))[0];
  const manualShare = total ? (Number(current.manual) || 0) / total : 0;

  const sentences = {
    trend: !total || !busiest?.total
      ? emptySentence()
      : `${bucket === 'day' ? (weekdayLabel(busiest.date) || busiest.label) : busiest.label} had the most movement events (${busiest.total.toLocaleString()}).`,
    distribution: !total || !dominant?.count
      ? emptySentence()
      : `${dominant.label} accounts for ${dominant.pct}% of movement events in this range.${manualShare >= 0.25 ? ' Manual adjustments are a large share of the activity.' : ''}`,
    products: !topProduct
      ? emptySentence()
      : unit
        ? `${topProduct.title} has the highest outbound quantity among ${unit} products (${topProduct.qty.toLocaleString()} ${unit}). This is activity, not sales value.`
        : `${topProduct.title} has the most outbound events (${topProduct.count.toLocaleString()}${topCount ? `, ${Math.round((topProduct.count / topCount) * 100)}% of the top ${topProducts.length}` : ''}).`,
    branches: !topBranch
      ? emptySentence()
      : `${topBranch.name} has the highest inventory activity (${topBranch.total.toLocaleString()} events).`,
    adjustments: !topReason
      ? 'No adjustment rows in this range.'
      : `${reasonLabel(topReason._id)} is the most common recorded adjustment reason (${Number(topReason.count).toLocaleString()}).`,
    calendar: !busiestDay || !countCategories(busiestDay)
      ? emptySentence()
      : `${busiestDay.label} has the highest activity in this range (${countCategories(busiestDay).toLocaleString()} events).`,
    transfers: routes[0]
      ? `The busiest route is ${routes[0].source} to ${routes[0].destination} (${routes[0].count.toLocaleString()} transfers).${unpaired.length ? ` ${unpaired.length.toLocaleString()} transfer outs have no matching destination.` : ''}`
      : unpaired.length
        ? `${unpaired.length.toLocaleString()} transfer outs have no matching destination.`
        : 'No transfers in this range.',
    aging: !aging.stocked
      ? 'No sellable stock matches these filters.'
      : `${aging.past45.toLocaleString()} currently stocked ${aging.past45 === 1 ? 'row has' : 'rows have'} had no qualifying movement for more than 45 days.`,
  };

  kpis.push({
    id: 'exceptions',
    title: 'Exceptions requiring review',
    value: unpaired.length,
    previous: null,
    changePct: null,
    compare: false,
    meaning: 'Transfer outs with no matching transfer in. No destination is invented for these.',
  });

  return {
    definitions: {
      total: 'Opening + add + minus + sold + transfer out. Legacy types are excluded from this total.',
      stockIn: 'adjustment_add events. Opening is separate.',
      stockOut: 'adjustment_minus and sale_fulfill events.',
      transfers: 'transfer_out events. transfer_in is the other half of the same move.',
      manual: 'reason is manual_adjustment, custom_add, or custom_minus.',
      qualifyingMovement: 'Any ledger row except opening. Stock with no such row is Unknown, not 90+.',
      value: 'Inventory value is unavailable. Catalog cost is not a verified stock valuation.',
      warehouse: 'There is no warehouse level. Locations are branch, floor, and rack.',
    },
    range: window,
    previousRange: previous,
    bucket,
    bucketOptions: buckets,
    trends,
    legacyCount: Number(current.legacy) || 0,
    searchMeta: { truncated },
    kpis,
    trend,
    distribution,
    products: { metric: unit ? 'qty' : 'count', unit: unit || '', units, items: topProducts },
    branches,
    adjustments: {
      reasons: adjustmentReasons.map((row) => ({
        reason: row._id || '',
        label: reasonLabel(row._id),
        count: Number(row.count) || 0,
      })),
      products: adjustmentProducts.map((row) => {
        const product = productMap.get(String(row._id));
        return {
          productId: String(row._id),
          title: product?.title || 'Unknown product',
          sku: product?.sku || '',
          count: Number(row.count) || 0,
        };
      }),
      operators: adjustmentOperators.map((row) => {
        const user = operatorMap.get(String(row._id));
        return {
          userId: row._id ? String(row._id) : '',
          name: user?.name || 'Unknown',
          count: Number(row.count) || 0,
        };
      }),
      topBranch: [...branches].sort((a, b) => b.manual - a.manual)[0] || null,
    },
    calendar: { month: calendarMonth, label: formatIsoDayLabel(calendarMonth).replace(/^\d+\s/, ''), days: calendarDays },
    transfers: { routes, unpaired: unpaired.length },
    aging,
    sentences,
    unavailable: [
      { id: 'value', title: 'Inventory value', reason: 'No verified stock valuation is stored on the ledger.' },
      { id: 'warehouse', title: 'Warehouse filter', reason: 'Locations are branch, floor, and rack. There is no separate warehouse.' },
      { id: 'beforeAfter', title: 'Stock before and after', reason: 'Ledger rows do not store a before or after balance.' },
    ],
  };
}

function productIdsFromClause(match) {
  const value = match?.productId;
  if (!value) return null;
  if (Array.isArray(value.$in)) return value.$in;
  return [value];
}

async function buildAging({ filters, byId, productIds }) {
  const counts = { '0-30': 0, '31-45': 0, '46-60': 0, '61-90': 0, '90+': 0, unknown: 0 };
  const filter = filters.aging === '45' ? '45' : '';
  if (productIds && !productIds.length) {
    return { counts, past45: 0, items: [], truncated: false, stocked: 0, filter };
  }

  const stockMatch = { statusBucket: 'sellable', qty: { $gt: 0 } };
  if (filters.locationId && mongoose.Types.ObjectId.isValid(String(filters.locationId))) {
    stockMatch.locationId = new mongoose.Types.ObjectId(String(filters.locationId));
  } else if (filters.branchId && mongoose.Types.ObjectId.isValid(String(filters.branchId))) {
    stockMatch.branchId = new mongoose.Types.ObjectId(String(filters.branchId));
  }
  if (productIds?.length) {
    stockMatch.productId = { $in: productIds };
  }

  const stockRows = await Stock.find(stockMatch).select('productId locationId qty branchId').limit(5000).lean();
  if (!stockRows.length) {
    return { counts, past45: 0, items: [], truncated: false, stocked: 0, filter };
  }

  const stockProductIds = [...new Set(stockRows.map((row) => String(row.productId)))];
  const lastRows = await StockLedger.aggregate([
    {
      $match: {
        productId: { $in: stockProductIds.map((id) => new mongoose.Types.ObjectId(id)) },
        type: { $ne: 'opening' },
      },
    },
    { $group: { _id: { productId: '$productId', locationId: '$locationId' }, lastAt: { $max: '$createdAt' } } },
  ]);
  const lastMap = new Map(lastRows.map((row) => [`${row._id.productId}:${row._id.locationId}`, row.lastAt]));
  const products = await Product.find({ _id: { $in: stockProductIds } }).select('title sku stockUnit').lean();
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const today = istTodayIso();

  const items = stockRows.map((row) => {
    const lastAt = lastMap.get(`${row.productId}:${row.locationId}`) || null;
    const lastIso = lastAt
      ? new Intl.DateTimeFormat('en-CA', { timeZone: LEDGER_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(lastAt))
      : '';
    const days = lastIso ? Math.max(0, inclusiveIsoDays(lastIso, today).length - 1) : null;
    const bucket = agingBucket(days);
    counts[bucket] += 1;
    const product = productMap.get(String(row.productId));
    const branch = row.branchId ? byId.get(String(row.branchId)) : branchOf(row.locationId, byId);
    return {
      productId: String(row.productId),
      locationId: String(row.locationId || ''),
      title: product?.title || 'Unknown product',
      sku: product?.sku || '',
      unit: product?.stockUnit || 'Pcs',
      qty: Number(row.qty) || 0,
      lastAt: lastIso,
      lastLabel: lastIso ? formatIsoDayLabel(lastIso) : '',
      days,
      bucket,
      branch: branchName(branch),
    };
  });

  const past45 = counts['46-60'] + counts['61-90'] + counts['90+'];
  const wanted = filters.aging === '45' ? items.filter((row) => (row.days || 0) > 45) : items;
  wanted.sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
  return {
    counts,
    past45,
    items: wanted.slice(0, 40),
    truncated: wanted.length > 40 || stockRows.length === 5000,
    stocked: stockRows.length,
    filter,
  };
}
