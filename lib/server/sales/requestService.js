import 'server-only';

import InventoryRequest from '@/lib/models/InventoryRequest';
import SalesBucket from '@/lib/models/SalesBucket';
import SalesSession from '@/lib/models/SalesSession';
import Customer from '@/lib/models/Customer';
import InventoryRequestActivity from '@/lib/server/models/InventoryRequestActivity';
import { getProductStockSummary } from '@/lib/server/inventory/inventoryService';
import { getBatchProductStockSummaries } from '@/lib/server/sales/batchStockService';
import { assertBucketAccess } from '@/lib/server/sales/sessionService';
import { buildSalesOwnerQuery, assertOwnsResource } from '@/lib/server/sales/salesAccess';
import { reserveLineStock, fulfillLineStock } from '@/lib/server/sales/stockReservation';
import { writeAuditLog } from '@/lib/server/audit/writeAuditLog';
import { normalizePhone } from '@/lib/utils/phone';

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
      maxDiscountPercent: line.maxDiscountPercent,
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
    request: inventoryRequest.toObject(),
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
  if (doc.phone) {
    const customer = await Customer.findOrCreate({
      name: doc.customerName || 'Walk-in Customer',
      phone: normalizePhone(doc.phone),
      email: doc.email || undefined,
    });
    customerId = customer?._id || null;
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

  return { bucket: bucket.toObject(), sourceRequestNumber: doc.requestNumber };
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRequestsListQuery(session, { status, supervisor = false, q = '', days } = {}) {
  const query = supervisor ? {} : buildSalesOwnerQuery(session);
  if (status) query.status = status;

  if (days && days > 0) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);
    query.createdAt = { $gte: since };
  }

  const term = String(q || '').trim();
  if (term) {
    const regex = new RegExp(escapeRegex(term), 'i');
    query.$and = [
      ...(query.$and || []),
      {
        $or: [
          { requestNumber: regex },
          { customerName: regex },
          { phone: regex },
          { 'lines.productTitle': regex },
          { 'lines.sku': regex },
        ],
      },
    ];
  }

  return query;
}

export async function listRequests(
  session,
  { status, page = 1, limit = 20, supervisor = false, q = '', days } = {}
) {
  const query = buildRequestsListQuery(session, { status, supervisor, q, days });

  const skip = (page - 1) * limit;
  const [items, total, statusAgg] = await Promise.all([
    InventoryRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    InventoryRequest.countDocuments(query),
    InventoryRequest.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const byStatus = {};
  for (const row of statusAgg) {
    byStatus[row._id] = row.count;
  }

  return {
    requests: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    summary: { total, byStatus },
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

  return { request: doc, activities };
}

function resolveApprovedQty(line, overrideMap) {
  const lineId = String(line._id);
  if (overrideMap.has(lineId)) {
    return Math.min(overrideMap.get(lineId), line.requestedQty);
  }
  return line.requestedQty;
}

export async function reviewRequest(session, requestId, { action, comment, lines }, httpRequest) {
  const doc = await InventoryRequest.findById(requestId);
  if (!doc) return { error: 'not_found' };

  const beforeStatus = doc.status;

  if (action === 'cancel') {
    if (!assertOwnsResource(session, doc) && session.role !== 'super_admin') {
      return { error: 'forbidden' };
    }
    if (!['submitted', 'approved', 'partially_approved'].includes(doc.status)) {
      return { error: 'invalid_transition' };
    }
    doc.status = 'cancelled';
    await doc.save();
    await logRequestActivity({
      requestId: doc._id,
      session,
      action: 'cancelled',
      before: { status: beforeStatus },
      after: { status: 'cancelled' },
    });
    return { request: doc.toObject() };
  }

  if (action === 'reject') {
    if (!comment?.trim()) return { error: 'comment_required' };
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
      request: httpRequest,
    });

    return { request: doc.toObject() };
  }

  if (action === 'approve') {
    if (doc.status !== 'submitted') return { error: 'invalid_transition' };

    const overrideMap = new Map(
      (lines || []).map((l) => [String(l.lineId), Number(l.approvedQty)])
    );

    let anyPartial = false;
    let anyApproved = false;

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

        try {
          await reserveLineStock({
            productId: line.productId,
            qty: approvedQty,
            userId: session.userId,
            requestNumber: doc.requestNumber,
          });
        } catch (err) {
          return {
            error: 'reservation_failed',
            message: `${line.productTitle}: ${err.message}`,
            productId: String(line.productId),
          };
        }
      } else {
        anyPartial = true;
      }
    }

    if (!anyApproved) {
      return { error: 'nothing_to_approve' };
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

    return { request: doc.toObject() };
  }

  if (action === 'fulfill') {
    if (!['approved', 'partially_approved'].includes(doc.status)) {
      return { error: 'invalid_transition' };
    }

    for (const line of doc.lines) {
      const qty = line.approvedQty ?? 0;
      if (qty <= 0) continue;
      try {
        await fulfillLineStock({
          productId: line.productId,
          qty,
          userId: session.userId,
          requestNumber: doc.requestNumber,
        });
      } catch (err) {
        return {
          error: 'fulfill_failed',
          message: `${line.productTitle}: ${err.message}`,
        };
      }
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

    return { request: doc.toObject() };
  }

  return { error: 'invalid_action' };
}
