import 'server-only';

import InventoryRequest from '@/lib/models/InventoryRequest';
import SalesBucket from '@/lib/models/SalesBucket';
import SalesSession from '@/lib/models/SalesSession';
import Customer from '@/lib/models/Customer';
import Product from '@/lib/models/Product';
import InventoryRequestActivity from '@/lib/server/models/InventoryRequestActivity';
import { getProductStockSummary } from '@/lib/server/inventory/inventoryService';
import { getBatchProductStockSummaries } from '@/lib/server/sales/batchStockService';
import { assertBucketAccess } from '@/lib/server/sales/sessionService';
import { buildSalesOwnerQuery, assertOwnsResource } from '@/lib/server/sales/salesAccess';
import {
  reserveRequestLines,
  fulfillRequestLines,
  releaseRequestReservations,
  getFulfilmentRackPlan,
} from '@/lib/server/sales/stockReservation';
import { writeAuditLog } from '@/lib/server/audit/writeAuditLog';
import { presentSalesBucket, presentSalesRequest } from '@/lib/server/sales/presentSalesPayload';
import { normalizeCustomerIdentity } from '@/lib/shared/customerIdentity';

async function generateRequestNumber() {
  const year = new Date().getFullYear();
  const prefix = `SR-${year}-`;
  const last = await InventoryRequest.findOne({
    requestNumber: { $regex: `^${prefix}` },
  })
    .sort({ requestNumber: -1 })
    .select('requestNumber')
    .lean();

  const seq = last ? parseInt(last.requestNumber.split('-')[2], 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function logRequestActivity({ requestId, session, action, before, after }) {
  await InventoryRequestActivity.create({
    requestId,
    userId: session.userId,
    userName: session.name || '',
    action,
    before,
    after,
  });
}

/** Approve has already taken these requests out of sellable stock. */
const RESERVED_STATUSES = ['approved', 'partially_approved'];

/** A request can still be cancelled or rejected from these statuses. */
const OPEN_STATUSES = ['submitted', 'approved', 'partially_approved'];

/**
 * Hand back stock when an approved request ends without fulfilment.
 *
 * Called before the status changes, so a failed release leaves the request
 * approved and retryable. Flipping the status first would leave a cancelled
 * request whose stock is still missing from sellable, with nothing to
 * indicate the release never ran.
 */
async function releaseIfReserved(doc, session) {
  if (!RESERVED_STATUSES.includes(doc.status)) return { released: [] };

  return releaseRequestReservations({
    requestNumber: doc.requestNumber,
    userId: session.userId,
  });
}

export async function submitBucketAsRequest(session, bucketId, request) {
  const bucket = await SalesBucket.findById(bucketId);
  const access = await assertBucketAccess(session, bucket);
  if (access.error) return access;

  if (bucket.status !== 'draft') return { error: 'already_submitted' };
  if (!bucket.lines?.length) return { error: 'empty_bucket' };

  const productIds = bucket.lines.map((l) => l.productId);
  const stockMap = await getBatchProductStockSummaries(productIds);

  const lines = [];
  const stockWarnings = [];

  for (const line of bucket.lines) {
    const stock = stockMap.get(String(line.productId)) || { sellableQty: 0 };
    if (line.quantity > stock.sellableQty) {
      stockWarnings.push({
        productId: String(line.productId),
        productTitle: line.productTitle,
        requested: line.quantity,
        available: stock.sellableQty,
      });
    }

    lines.push({
      productId: line.productId,
      productTitle: line.productTitle,
      sku: line.sku,
      requestedQty: line.quantity,
      approvedQty: null,
      offeredRatePaise: line.offeredRatePaise,
      discountPercent: line.discountPercent,
      listPricePaise: line.listPricePaise,
      maxDiscountPercent: line.maxDiscountPercent ?? 0,
      minOfferPricePaise: line.minOfferPricePaise ?? 0,
      notes: line.notes,
      stockAtSubmit: stock.sellableQty,
    });
  }

  let requestNumber;
  let inventoryRequest;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    requestNumber = await generateRequestNumber();
    try {
      inventoryRequest = await InventoryRequest.create({
        requestNumber,
        bucketId: bucket._id,
        sessionId: bucket.sessionId,
        salesUserId: bucket.salesUserId,
        salesUserName: session.name || '',
        customerId: bucket.customerId,
        customerName: bucket.customerName,
        phone: bucket.phone,
        email: bucket.email,
        status: 'submitted',
        lines,
        submittedAt: new Date(),
      });
      break;
    } catch (err) {
      if (err?.code === 11000 && attempt < 2) continue;
      throw err;
    }
  }

  bucket.status = 'submitted';
  bucket.submittedAt = new Date();
  bucket.inventoryRequestId = inventoryRequest._id;
  await bucket.save();

  await logRequestActivity({
    requestId: inventoryRequest._id,
    session,
    action: 'submitted',
    after: { status: 'submitted', requestNumber },
  });

  await writeAuditLog({
    userId: session.userId,
    action: 'sales.request.submitted',
    entityType: 'InventoryRequest',
    entityId: inventoryRequest._id,
    after: { requestNumber, lineCount: lines.length },
    request,
  });

  return {
    request: presentSalesRequest(inventoryRequest),
    stockWarnings,
  };
}

const CLONEABLE_REQUEST_STATUSES = [
  'rejected',
  'approved',
  'partially_approved',
  'fulfilled',
  'cancelled',
];

/**
 * Clone an immutable InventoryRequest into a new draft bucket.
 * Never mutates the original request — audit-safe resubmission.
 */
export async function cloneRequestToBucket(session, requestId, httpRequest) {
  const doc = await InventoryRequest.findById(requestId).lean();
  if (!doc) return { error: 'not_found' };

  if (!assertOwnsResource(session, doc)) {
    return { error: 'forbidden' };
  }

  if (!CLONEABLE_REQUEST_STATUSES.includes(doc.status)) {
    return { error: 'not_cloneable', message: 'Only resolved requests can be cloned' };
  }

  let activeSession = await SalesSession.findOne({
    salesUserId: session.userId,
    status: 'active',
  });

  if (!activeSession) {
    activeSession = await SalesSession.create({
      salesUserId: session.userId,
      status: 'active',
      nextDisplayNumber: 1,
    });
  }

  const displayNumber = activeSession.nextDisplayNumber;

  let customerId = doc.customerId;
  const identity = normalizeCustomerIdentity({
    name: doc.customerName,
    phone: doc.phone,
    email: doc.email,
  });
  if (identity.hasIdentity) {
    const customer = await Customer.findOrCreate(identity);
    customerId = customer?._id || doc.customerId || null;
  }

  const lines = (doc.lines || []).map((line) => ({
    productId: line.productId,
    productTitle: line.productTitle,
    sku: line.sku || '',
    quantity: line.requestedQty,
    offeredRatePaise: line.offeredRatePaise,
    discountPercent: line.discountPercent ?? 0,
    listPricePaise: line.listPricePaise ?? 0,
    maxDiscountPercent: line.maxDiscountPercent ?? 0,
    minOfferPricePaise: line.minOfferPricePaise ?? 0,
    notes: line.notes || '',
  }));

  const bucket = await SalesBucket.create({
    sessionId: activeSession._id,
    salesUserId: session.userId,
    displayNumber,
    customerId,
    customerName: doc.customerName,
    phone: doc.phone,
    email: doc.email,
    notes: '',
    lines,
    status: 'draft',
  });

  await SalesSession.updateOne(
    { _id: activeSession._id },
    { $inc: { nextDisplayNumber: 1 } }
  );

  await writeAuditLog({
    userId: session.userId,
    action: 'sales.request.cloned',
    entityType: 'InventoryRequest',
    entityId: doc._id,
    after: { newBucketId: bucket._id, requestNumber: doc.requestNumber },
    request: httpRequest,
  });

  return { bucket: presentSalesBucket(bucket), sourceRequestNumber: doc.requestNumber };
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRequestsListQuery(session, { status, supervisor = false, q = '', days } = {}) {
  const query = supervisor ? {} : buildSalesOwnerQuery(session);
  if (status === 'needs_action') {
    query.status = { $in: OPEN_STATUSES };
  } else if (status) {
    query.status = status;
  }

  if (days && days > 0) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);
    query.createdAt = { $gte: since };
  }

  const term = String(q || '').trim();
  if (term) {
    const regex = new RegExp(escapeRegex(term), 'i');
    const fields = [
      { requestNumber: regex },
      { customerName: regex },
      { phone: regex },
      { salesUserName: regex },
      { 'lines.productTitle': regex },
      { 'lines.sku': regex },
    ];
    query.$and = [...(query.$and || []), { $or: fields }];
  }

  return query;
}

export async function listRequests(
  session,
  { status, page = 1, limit = 20, supervisor = false, q = '', days } = {}
) {
  const listQuery = buildRequestsListQuery(session, { status, supervisor, q, days });
  /**
   * Chip counts ignore the status filter so "Needs action" still shows a
   * number while you are looking at fulfilled history. Search and date still
   * apply — otherwise the chips would disagree with what you typed.
   */
  const summaryQuery = supervisor
    ? buildRequestsListQuery(session, { supervisor, q, days })
    : listQuery;

  const skip = (page - 1) * limit;
  const [items, total, statusAgg] = await Promise.all([
    InventoryRequest.find(listQuery).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    InventoryRequest.countDocuments(listQuery),
    InventoryRequest.aggregate([
      { $match: summaryQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const byStatus = {};
  for (const row of statusAgg) {
    byStatus[row._id] = row.count;
  }

  return {
    requests: supervisor ? items : items.map(presentSalesRequest),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    summary: { total: supervisor ? Object.values(byStatus).reduce((s, n) => s + n, 0) : total, byStatus },
  };
}

export async function getRequestById(session, requestId, { supervisor = false } = {}) {
  const doc = await InventoryRequest.findById(requestId).lean();
  if (!doc) return { error: 'not_found' };

  if (!supervisor && !assertOwnsResource(session, doc)) {
    return { error: 'forbidden' };
  }

  const activities = await InventoryRequestActivity.find({ requestId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  /**
   * The rack picture is only needed by the supervisor's fulfilment screen, and
   * only while the request is still holding reserved stock. Skipping it
   * elsewhere keeps the sales-side detail call cheap.
   */
  const fulfilmentPlan =
    supervisor && RESERVED_STATUSES.includes(doc.status)
      ? await getFulfilmentRackPlan({
          requestNumber: doc.requestNumber,
          lines: (doc.lines || []).map((line) => ({
            lineId: line._id,
            productId: line.productId,
            productTitle: line.productTitle,
            approvedQty: line.approvedQty ?? 0,
          })),
        })
      : null;

  /**
   * Live sellable qty on open requests so the manager can compare what was
   * asked against what is on the racks now — not the snapshot from submit.
   */
  let liveStock = null;
  if (supervisor && OPEN_STATUSES.includes(doc.status) && doc.lines?.length) {
    const stockMap = await getBatchProductStockSummaries(doc.lines.map((l) => l.productId));
    liveStock = {};
    for (const line of doc.lines) {
      liveStock[String(line.productId)] = stockMap.get(String(line.productId))?.sellableQty ?? 0;
    }
  }

  return {
    request: supervisor ? doc : presentSalesRequest(doc),
    activities,
    fulfilmentPlan,
    liveStock,
  };
}

/**
 * Charge sheet for a fulfilled request — offered rates and barcodes so the
 * counter can bill what actually left. Not a tax invoice.
 */
export async function getFulfilmentSlip(session, requestId) {
  const result = await getRequestById(session, requestId, {
    supervisor: session.role === 'super_admin' || session.role === 'inventory_manager',
  });
  if (result.error) return result;

  const request = result.request;
  if (request.status !== 'fulfilled') {
    return { error: 'not_fulfilled' };
  }

  const productIds = (request.lines || []).map((l) => l.productId).filter(Boolean);
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } })
        .select('sku barcode heroImage parentProductId')
        .populate('parentProductId', 'heroImage')
        .lean()
    : [];
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const lines = (request.lines || []).map((line) => {
    const product = byId.get(String(line.productId));
    const qty = line.approvedQty ?? line.requestedQty ?? 0;
    const ratePaise = Number(line.offeredRatePaise) || 0;
    const barcode = String(product?.barcode || '').trim();
    const sku = String(line.sku || product?.sku || '').trim();
    return {
      _id: line._id,
      productTitle: line.productTitle,
      sku,
      barcode: barcode || sku,
      qty,
      ratePaise,
      lineTotalPaise: qty * ratePaise,
    };
  });

  const totalPaise = lines.reduce((sum, line) => sum + line.lineTotalPaise, 0);

  return {
    slip: {
      requestNumber: request.requestNumber,
      customerName: request.customerName || '',
      phone: request.phone || '',
      salesUserName: request.salesUserName || '',
      fulfilledAt: request.fulfilledAt || request.updatedAt,
      lines,
      totalPaise,
    },
  };
}

function resolveApprovedQty(line, overrideMap) {
  const lineId = String(line._id);
  if (overrideMap.has(lineId)) {
    return Math.min(overrideMap.get(lineId), line.requestedQty);
  }
  return line.requestedQty;
}

export async function reviewRequest(
  session,
  requestId,
  { action, comment, lines, allocations },
  httpRequest
) {
  const doc = await InventoryRequest.findById(requestId);
  if (!doc) return { error: 'not_found' };

  const beforeStatus = doc.status;

  if (action === 'cancel') {
    if (!assertOwnsResource(session, doc) && session.role !== 'super_admin') {
      return { error: 'forbidden' };
    }
    if (!OPEN_STATUSES.includes(doc.status)) {
      return { error: 'invalid_transition' };
    }

    let release;
    try {
      release = await releaseIfReserved(doc, session);
    } catch (err) {
      return { error: 'release_failed', message: err.message };
    }

    doc.status = 'cancelled';
    await doc.save();
    await logRequestActivity({
      requestId: doc._id,
      session,
      action: 'cancelled',
      before: { status: beforeStatus },
      after: { status: 'cancelled', releasedLines: release.released.length },
    });

    await writeAuditLog({
      userId: session.userId,
      action: 'sales.request.cancelled',
      entityType: 'InventoryRequest',
      entityId: doc._id,
      before: { status: beforeStatus },
      after: { status: 'cancelled' },
      metadata: { released: release.released },
      request: httpRequest,
    });

    return { request: presentSalesRequest(doc) };
  }

  if (action === 'reject') {
    /**
     * Reject previously ran from any status, so an already fulfilled request
     * could be rewritten as rejected while its sold history stayed on the
     * ledger. Rejecting an approved request must also give the stock back.
     */
    if (!OPEN_STATUSES.includes(doc.status)) {
      return { error: 'invalid_transition' };
    }
    if (!comment?.trim()) return { error: 'comment_required' };

    let release;
    try {
      release = await releaseIfReserved(doc, session);
    } catch (err) {
      return { error: 'release_failed', message: err.message };
    }

    doc.status = 'rejected';
    doc.supervisorComment = comment.trim();
    doc.reviewedByUserId = session.userId;
    doc.reviewedByName = session.name || '';
    doc.reviewedAt = new Date();
    await doc.save();

    await logRequestActivity({
      requestId: doc._id,
      session,
      action: 'rejected',
      before: { status: beforeStatus },
      after: { status: 'rejected', comment: doc.supervisorComment },
    });

    await writeAuditLog({
      userId: session.userId,
      action: 'inventory.request.rejected',
      entityType: 'InventoryRequest',
      entityId: doc._id,
      before: { status: beforeStatus },
      after: { status: 'rejected' },
      metadata: { released: release.released },
      request: httpRequest,
    });

    return { request: presentSalesRequest(doc) };
  }

  if (action === 'approve') {
    if (doc.status !== 'submitted') return { error: 'invalid_transition' };

    const overrideMap = new Map(
      (lines || []).map((l) => [String(l.lineId), Number(l.approvedQty)])
    );

    /**
     * Settle every quantity before any stock moves. Reserving inside this
     * loop is what let a later line's failure leave the earlier lines already
     * deducted while the request stayed submitted — approving again then
     * deducted those lines twice.
     */
    let anyPartial = false;
    let anyApproved = false;
    const toReserve = [];

    for (const line of doc.lines) {
      let approvedQty = resolveApprovedQty(line, overrideMap);
      const stock = await getProductStockSummary(line.productId);
      if (approvedQty > stock.sellableQty) {
        approvedQty = stock.sellableQty;
      }
      line.approvedQty = approvedQty;

      if (approvedQty > 0) {
        anyApproved = true;
        if (approvedQty < line.requestedQty) anyPartial = true;
        toReserve.push({
          productId: line.productId,
          qty: approvedQty,
          productTitle: line.productTitle,
        });
      } else {
        anyPartial = true;
      }
    }

    if (!anyApproved) {
      return { error: 'nothing_to_approve' };
    }

    try {
      await reserveRequestLines({
        requestNumber: doc.requestNumber,
        userId: session.userId,
        lines: toReserve,
      });
    } catch (err) {
      return {
        error: 'reservation_failed',
        message: err.message,
        productId: err.productId || null,
      };
    }

    doc.status = anyPartial ? 'partially_approved' : 'approved';
    doc.supervisorComment = comment?.trim() || '';
    doc.reviewedByUserId = session.userId;
    doc.reviewedByName = session.name || '';
    doc.reviewedAt = new Date();
    await doc.save();

    await logRequestActivity({
      requestId: doc._id,
      session,
      action: doc.status,
      before: { status: beforeStatus },
      after: { status: doc.status },
    });

    await writeAuditLog({
      userId: session.userId,
      action: 'inventory.request.approved',
      entityType: 'InventoryRequest',
      entityId: doc._id,
      before: { status: beforeStatus },
      after: { status: doc.status },
      request: httpRequest,
    });

    return { request: presentSalesRequest(doc) };
  }

  if (action === 'fulfill') {
    if (!RESERVED_STATUSES.includes(doc.status)) {
      return { error: 'invalid_transition' };
    }

    const allocationByLine = new Map(
      (allocations || []).map((entry) => [String(entry.lineId), entry.locations || []])
    );

    const toFulfill = [];
    for (const line of doc.lines) {
      const qty = line.approvedQty ?? 0;
      if (qty <= 0) continue;

      const locations = (allocationByLine.get(String(line._id)) || []).filter(
        (loc) => Number(loc.qty) > 0
      );

      /**
       * A confirmed rack split has to add up to the approved quantity, or the
       * sale would be recorded for a different amount than was approved.
       */
      if (locations.length > 0) {
        const total = locations.reduce((sum, loc) => sum + Number(loc.qty), 0);
        if (total !== qty) {
          return {
            error: 'allocation_mismatch',
            message: `${line.productTitle}: racks add up to ${total}, but ${qty} was approved`,
          };
        }
      }

      toFulfill.push({
        productId: line.productId,
        qty,
        productTitle: line.productTitle,
        locations,
      });
    }

    try {
      await fulfillRequestLines({
        requestNumber: doc.requestNumber,
        userId: session.userId,
        lines: toFulfill,
        /**
         * The sale belongs to the salesman who raised the request, not the
         * inventory staff fulfilling it. The name is stored alongside the id
         * so the row still reads correctly if he is later renamed or leaves.
         */
        soldFor: { userId: doc.salesUserId, name: doc.salesUserName || '' },
      });
    } catch (err) {
      return { error: 'fulfill_failed', message: err.message };
    }

    doc.status = 'fulfilled';
    doc.fulfilledAt = new Date();
    await doc.save();

    await logRequestActivity({
      requestId: doc._id,
      session,
      action: 'fulfilled',
      before: { status: beforeStatus },
      after: { status: 'fulfilled' },
    });

    /**
     * Fulfilment is the moment goods actually leave the building, so it
     * belongs in the audit log alongside approve and reject.
     */
    await writeAuditLog({
      userId: session.userId,
      action: 'inventory.request.fulfilled',
      entityType: 'InventoryRequest',
      entityId: doc._id,
      before: { status: beforeStatus },
      after: { status: 'fulfilled', fulfilledAt: doc.fulfilledAt },
      metadata: {
        soldForUserId: doc.salesUserId,
        soldForName: doc.salesUserName || '',
      },
      request: httpRequest,
    });

    return { request: presentSalesRequest(doc) };
  }

  return { error: 'invalid_action' };
}
