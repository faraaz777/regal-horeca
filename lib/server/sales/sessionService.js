import 'server-only';

import SalesSession from '@/lib/models/SalesSession';
import SalesBucket from '@/lib/models/SalesBucket';
import InventoryRequest from '@/lib/models/InventoryRequest';
import Product from '@/lib/models/Product';
import { ACTIVE_BUCKET_STATUSES } from '@/lib/shared/salesConstants';
import { assertOwnsResource } from '@/lib/server/sales/salesAccess';
import { presentSalesBucket } from '@/lib/server/sales/presentSalesPayload';
import { resolveSalesHeroImage } from '@/lib/server/sales/pricing';

export async function getOrCreateActiveSession(session) {
  const userId = session.userId;

  let active = await SalesSession.findOne({ salesUserId: userId, status: 'active' }).lean();
  if (active) return active;

  const created = await SalesSession.create({
    salesUserId: userId,
    status: 'active',
    nextDisplayNumber: 1,
  });
  return created.toObject();
}

export async function getActiveSession(session) {
  return SalesSession.findOne({ salesUserId: session.userId, status: 'active' }).lean();
}

export async function closeActiveSession(session) {
  const active = await SalesSession.findOne({ salesUserId: session.userId, status: 'active' });
  if (!active) {
    return { error: 'no_active_session' };
  }

  const draftWithLines = await SalesBucket.countDocuments({
    sessionId: active._id,
    status: 'draft',
    'lines.0': { $exists: true },
  });

  if (draftWithLines > 0) {
    return { error: 'draft_buckets_remain', count: draftWithLines };
  }

  active.status = 'closed';
  active.closedAt = new Date();
  await active.save();

  return { session: active.toObject() };
}

/**
 * Lines added before heroImage was snapshotted still have an empty thumb.
 * Fill from Product (and parent) in one query — do not N+1.
 */
async function withLineHeroImages(buckets) {
  const missingIds = [];
  for (const bucket of buckets) {
    for (const line of bucket.lines || []) {
      if (!line.heroImage && line.productId) {
        missingIds.push(line.productId);
      }
    }
  }
  if (missingIds.length === 0) return buckets;

  const products = await Product.find({ _id: { $in: missingIds } })
    .select('heroImage gallery parentProductId')
    .populate('parentProductId', 'heroImage gallery')
    .lean();
  const imageById = new Map(
    products.map((p) => [String(p._id), resolveSalesHeroImage(p)])
  );

  return buckets.map((bucket) => ({
    ...bucket,
    lines: (bucket.lines || []).map((line) => ({
      ...line,
      heroImage: line.heroImage || imageById.get(String(line.productId)) || '',
    })),
  }));
}

export async function getSessionWorkspace(session) {
  const salesSession = await getOrCreateActiveSession(session);

  const buckets = await SalesBucket.find({
    sessionId: salesSession._id,
    status: { $in: ACTIVE_BUCKET_STATUSES },
  })
    .sort({ displayNumber: 1 })
    .lean();

  const bucketsWithImages = await withLineHeroImages(buckets);

  const requestIds = buckets
    .map((b) => b.inventoryRequestId)
    .filter(Boolean);

  let requestById = new Map();
  if (requestIds.length > 0) {
    const requests = await InventoryRequest.find({ _id: { $in: requestIds } })
      .select(
        'status supervisorComment requestNumber reviewedByName reviewedAt fulfilledAt submittedAt'
      )
      .lean();
    requestById = new Map(requests.map((r) => [String(r._id), r]));
  }

  const enrichedBuckets = bucketsWithImages.map((b) => {
    const linked = b.inventoryRequestId
      ? requestById.get(String(b.inventoryRequestId))
      : null;
    return presentSalesBucket({
      ...b,
      linkedRequest: linked
        ? {
            status: linked.status,
            requestNumber: linked.requestNumber,
            supervisorComment: linked.supervisorComment || '',
            reviewedByName: linked.reviewedByName || '',
            reviewedAt: linked.reviewedAt,
            submittedAt: linked.submittedAt,
            fulfilledAt: linked.fulfilledAt,
          }
        : null,
    });
  });

  return { session: salesSession, buckets: enrichedBuckets };
}

export async function assertBucketAccess(session, bucket) {
  if (!bucket) return { error: 'not_found' };
  if (!assertOwnsResource(session, bucket)) return { error: 'forbidden' };
  return { bucket };
}
