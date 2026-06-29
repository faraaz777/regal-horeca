import 'server-only';

import SalesSession from '@/lib/models/SalesSession';
import SalesBucket from '@/lib/models/SalesBucket';
import Customer from '@/lib/models/Customer';
import { normalizePhone } from '@/lib/utils/phone';
import {
  loadProductForSales,
  getListPricePaise,
  validateOfferedRate,
} from '@/lib/server/sales/pricing';
import { getOrCreateActiveSession, assertBucketAccess } from '@/lib/server/sales/sessionService';
import { writeAuditLog } from '@/lib/server/audit/writeAuditLog';

async function linkCustomer({ customerName, phone, email }) {
  const trimmedPhone = phone ? normalizePhone(phone) : '';
  if (!trimmedPhone && !email) return null;

  const customer = await Customer.findOrCreate({
    name: customerName || 'Walk-in Customer',
    phone: trimmedPhone || '0000000000',
    email: email || undefined,
    companyName: '',
  });
  return customer?._id || null;
}

export async function createBucket(session, { customerName, phone, email, notes } = {}) {
  const salesSession = await getOrCreateActiveSession(session);

  const displayNumber = salesSession.nextDisplayNumber;
  const customerId = await linkCustomer({ customerName, phone, email });

  const bucket = await SalesBucket.create({
    sessionId: salesSession._id,
    salesUserId: session.userId,
    displayNumber,
    customerName: customerName || `Customer ${displayNumber}`,
    phone: phone ? normalizePhone(phone) : '',
    email: email?.trim().toLowerCase() || '',
    notes: notes || '',
    customerId,
    lines: [],
    status: 'draft',
  });

  await SalesSession.updateOne(
    { _id: salesSession._id },
    { $inc: { nextDisplayNumber: 1 } }
  );

  return bucket.toObject();
}

export async function updateBucket(session, bucketId, patch, request) {
  const bucket = await SalesBucket.findById(bucketId);
  const access = await assertBucketAccess(session, bucket);
  if (access.error) return access;
  if (bucket.status !== 'draft') return { error: 'not_editable' };

  if (patch.customerName !== undefined) bucket.customerName = String(patch.customerName).trim();
  if (patch.phone !== undefined) bucket.phone = patch.phone ? normalizePhone(patch.phone) : '';
  if (patch.email !== undefined) bucket.email = String(patch.email).trim().toLowerCase();
  if (patch.notes !== undefined) bucket.notes = String(patch.notes).trim();

  if (patch.customerName !== undefined || patch.phone !== undefined || patch.email !== undefined) {
    bucket.customerId = await linkCustomer({
      customerName: bucket.customerName,
      phone: bucket.phone,
      email: bucket.email,
    });
  }

  await bucket.save();

  await writeAuditLog({
    userId: session.userId,
    action: 'sales.bucket.updated',
    entityType: 'SalesBucket',
    entityId: bucket._id,
    after: { customerName: bucket.customerName, lineCount: bucket.lines.length },
    request,
  });

  return { bucket: bucket.toObject() };
}

export async function deleteBucket(session, bucketId, request) {
  const bucket = await SalesBucket.findById(bucketId);
  const access = await assertBucketAccess(session, bucket);
  if (access.error) return access;
  if (bucket.status !== 'draft') return { error: 'not_deletable' };

  await SalesBucket.deleteOne({ _id: bucket._id });

  await writeAuditLog({
    userId: session.userId,
    action: 'sales.bucket.deleted',
    entityType: 'SalesBucket',
    entityId: bucketId,
    request,
  });

  return { success: true };
}

export async function setBucketLines(session, bucketId, incomingLines, request) {
  const bucket = await SalesBucket.findById(bucketId);
  const access = await assertBucketAccess(session, bucket);
  if (access.error) return access;
  if (bucket.status !== 'draft') return { error: 'not_editable' };

  const built = [];
  for (const line of incomingLines) {
    const product = await loadProductForSales(line.productId);
    if (!product) {
      return { error: 'invalid_product', productId: line.productId };
    }

    const listPricePaise = getListPricePaise(product);
    const maxDiscountPercent = product.maxDiscountPercent ?? 0;
    const offeredRatePaise =
      line.offeredRatePaise != null ? line.offeredRatePaise : listPricePaise;

    const validation = validateOfferedRate({
      listPricePaise,
      maxDiscountPercent,
      offeredRatePaise,
    });
    if (!validation.ok) {
      return { error: 'invalid_pricing', message: validation.error, productId: line.productId };
    }

    built.push({
      productId: product._id,
      productTitle: product.title,
      sku: product.sku || '',
      quantity: line.quantity,
      offeredRatePaise,
      discountPercent: validation.discountPercent ?? 0,
      listPricePaise,
      maxDiscountPercent,
      notes: line.notes || '',
    });
  }

  bucket.lines = built;
  await bucket.save();

  await writeAuditLog({
    userId: session.userId,
    action: 'sales.bucket.lines_updated',
    entityType: 'SalesBucket',
    entityId: bucket._id,
    after: { lineCount: built.length },
    request,
  });

  return { bucket: bucket.toObject() };
}

export async function addProductToBucket(session, bucketId, lineInput, request) {
  const bucket = await SalesBucket.findById(bucketId);
  const access = await assertBucketAccess(session, bucket);
  if (access.error) return access;
  if (bucket.status !== 'draft') return { error: 'not_editable' };

  const product = await loadProductForSales(lineInput.productId);
  if (!product) return { error: 'invalid_product' };

  const listPricePaise = getListPricePaise(product);
  const maxDiscountPercent = product.maxDiscountPercent ?? 0;
  const offeredRatePaise =
    lineInput.offeredRatePaise != null ? lineInput.offeredRatePaise : listPricePaise;

  const validation = validateOfferedRate({
    listPricePaise,
    maxDiscountPercent,
    offeredRatePaise,
  });
  if (!validation.ok) {
    return { error: 'invalid_pricing', message: validation.error };
  }

  const existingIdx = bucket.lines.findIndex(
    (l) => String(l.productId) === String(product._id)
  );

  if (existingIdx >= 0) {
    bucket.lines[existingIdx].quantity += lineInput.quantity;
    bucket.lines[existingIdx].offeredRatePaise = offeredRatePaise;
    bucket.lines[existingIdx].discountPercent = validation.discountPercent ?? 0;
    if (lineInput.notes) bucket.lines[existingIdx].notes = lineInput.notes;
  } else {
    bucket.lines.push({
      productId: product._id,
      productTitle: product.title,
      sku: product.sku || '',
      quantity: lineInput.quantity,
      offeredRatePaise,
      discountPercent: validation.discountPercent ?? 0,
      listPricePaise,
      maxDiscountPercent,
      notes: lineInput.notes || '',
    });
  }

  await bucket.save();
  return { bucket: bucket.toObject() };
}

export async function completeBucket(session, bucketId, request) {
  const bucket = await SalesBucket.findById(bucketId);
  const access = await assertBucketAccess(session, bucket);
  if (access.error) return access;

  if (bucket.status === 'draft') {
    if (bucket.lines?.length > 0) {
      return { error: 'draft_has_lines' };
    }
    await SalesBucket.deleteOne({ _id: bucket._id });
    await writeAuditLog({
      userId: session.userId,
      action: 'sales.bucket.discarded',
      entityType: 'SalesBucket',
      entityId: bucketId,
      request,
    });
    return { success: true, removed: true };
  }

  if (bucket.status !== 'submitted') {
    return { error: 'not_completable' };
  }

  bucket.status = 'completed';
  await bucket.save();

  await writeAuditLog({
    userId: session.userId,
    action: 'sales.bucket.completed',
    entityType: 'SalesBucket',
    entityId: bucket._id,
    after: { inventoryRequestId: bucket.inventoryRequestId },
    request,
  });

  return { bucket: bucket.toObject() };
}

/**
 * Clone a submitted bucket into a new draft (audit-safe resubmission path).
 * Original bucket and InventoryRequest remain immutable.
 */
export async function cloneBucketToDraft(session, sourceBucketId, httpRequest) {
  const source = await SalesBucket.findById(sourceBucketId);
  const access = await assertBucketAccess(session, source);
  if (access.error) return access;

  if (source.status !== 'submitted' && source.status !== 'completed') {
    return { error: 'not_cloneable' };
  }

  const salesSession = await getOrCreateActiveSession(session);
  const displayNumber = salesSession.nextDisplayNumber;

  let customerId = source.customerId;
  if (source.phone) {
    customerId = await linkCustomer({
      customerName: source.customerName,
      phone: source.phone,
      email: source.email,
    });
  }

  const lines = (source.lines || []).map((line) => ({
    productId: line.productId,
    productTitle: line.productTitle,
    sku: line.sku,
    quantity: line.quantity,
    offeredRatePaise: line.offeredRatePaise,
    discountPercent: line.discountPercent ?? 0,
    listPricePaise: line.listPricePaise ?? 0,
    maxDiscountPercent: line.maxDiscountPercent ?? 0,
    notes: line.notes || '',
  }));

  const bucket = await SalesBucket.create({
    sessionId: salesSession._id,
    salesUserId: session.userId,
    displayNumber,
    customerId,
    customerName: source.customerName,
    phone: source.phone,
    email: source.email,
    notes: source.notes || '',
    lines,
    status: 'draft',
  });

  await SalesSession.updateOne(
    { _id: salesSession._id },
    { $inc: { nextDisplayNumber: 1 } }
  );

  await writeAuditLog({
    userId: session.userId,
    action: 'sales.bucket.cloned',
    entityType: 'SalesBucket',
    entityId: bucket._id,
    after: { sourceBucketId: source._id },
    request: httpRequest,
  });

  return { bucket: bucket.toObject() };
}
