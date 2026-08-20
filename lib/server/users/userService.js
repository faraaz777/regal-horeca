import 'server-only';

import mongoose from 'mongoose';
import User from '@/lib/server/models/User';
import SalesCollection from '@/lib/models/SalesCollection';
import SalesBucket from '@/lib/models/SalesBucket';
import SalesSession from '@/lib/models/SalesSession';
import InventoryRequest from '@/lib/models/InventoryRequest';
import Enquiry from '@/lib/models/Enquiry';
import EnquiryMessage from '@/lib/models/EnquiryMessage';
import EnquiryActivity from '@/lib/server/models/EnquiryActivity';
import StockLedger from '@/lib/models/StockLedger';
import FloorLayout from '@/lib/models/FloorLayout';
import InventoryRule from '@/lib/models/InventoryRule';
import InventoryStockRule from '@/lib/models/InventoryStockRule';
import CompanyProfile from '@/lib/models/CompanyProfile';
import AuditLog from '@/lib/server/models/AuditLog';
import InventoryRequestActivity from '@/lib/server/models/InventoryRequestActivity';
import { getOrCreateActiveSession } from '@/lib/server/sales/sessionService';
import { resolveAssignee } from '@/lib/server/enquiries/enquiryAccess';
import { revokeAllRefreshTokens } from '@/lib/server/auth/refreshToken';
import {
  SALES_WORK_ROLES,
  ENQUIRY_ASSIGNEE_ROLES,
  SOLD_FOR_ROLES,
} from '@/lib/shared/roles';

export function sanitizeUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: Boolean(user.mustChangePassword),
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
  };
}

/** Active staff a sale can be credited to, for the Sold For picker. */
export async function listSoldForCandidates() {
  const users = await User.find({
    isActive: true,
    role: { $in: SOLD_FOR_ROLES },
  })
    .select('name email role')
    .sort({ name: 1 })
    .lean();

  return users.map((u) => ({
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
  }));
}

/**
 * Validate a Sold For choice and return the name to store on the ledger.
 *
 * The name is resolved here rather than taken from the client so a Sold row
 * can never be captioned with a name the user never had.
 */
export async function resolveSoldForUser(userId) {
  if (!userId) throw new Error('Select who this sale is for');
  if (!mongoose.Types.ObjectId.isValid(String(userId))) {
    throw new Error('Invalid user for this sale');
  }

  const user = await User.findById(userId).select('name email role isActive').lean();
  if (!user || !user.isActive) {
    throw new Error('That user is no longer active — pick someone else');
  }
  if (!SOLD_FOR_ROLES.includes(user.role)) {
    throw new Error('A sale cannot be credited to that role');
  }

  return { userId: user._id, name: user.name || user.email || '' };
}

export async function invalidateSessions(user) {
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await revokeAllRefreshTokens(user._id);
}

export async function getLiveOwnership(userId) {
  const id = new mongoose.Types.ObjectId(String(userId));
  const [collections, draftBuckets, assignedEnquiries, activeSession] = await Promise.all([
    SalesCollection.countDocuments({ salesUserId: id }),
    SalesBucket.countDocuments({ salesUserId: id, status: 'draft' }),
    Enquiry.countDocuments({ assignedToUserId: id }),
    SalesSession.countDocuments({ salesUserId: id, status: 'active' }),
  ]);

  return {
    collections,
    draftBuckets,
    assignedEnquiries,
    activeSession,
    needsTransfer: collections + draftBuckets + assignedEnquiries > 0,
  };
}

/**
 * Historical rows that must keep a User id. Presence of any of these
 * blocks hard delete.
 */
export async function getHistoricalActivityCount(userId) {
  const id = new mongoose.Types.ObjectId(String(userId));
  const counts = await Promise.all([
    SalesCollection.countDocuments({ salesUserId: id }),
    SalesBucket.countDocuments({ salesUserId: id }),
    SalesSession.countDocuments({ salesUserId: id }),
    InventoryRequest.countDocuments({
      $or: [{ salesUserId: id }, { reviewedByUserId: id }],
    }),
    Enquiry.countDocuments({ assignedToUserId: id }),
    EnquiryMessage.countDocuments({ createdByUserId: id }),
    EnquiryActivity.countDocuments({ userId: id }),
    InventoryRequestActivity.countDocuments({ userId: id }),
    StockLedger.countDocuments({ performedBy: id }),
    FloorLayout.countDocuments({
      $or: [{ createdBy: id }, { updatedBy: id }, { publishedBy: id }],
    }),
    InventoryRule.countDocuments({ createdBy: id }),
    InventoryStockRule.countDocuments({ updatedBy: id }),
    CompanyProfile.countDocuments({ uploadedBy: id }),
    AuditLog.countDocuments({ userId: id }),
    User.countDocuments({ createdBy: id }),
  ]);
  return counts.reduce((sum, n) => sum + n, 0);
}

export async function reassignLiveWork(fromUserId, toUserId) {
  const fromId = new mongoose.Types.ObjectId(String(fromUserId));
  const toUser = await User.findById(toUserId).select('name email role isActive').lean();
  if (!toUser || !toUser.isActive) {
    throw new Error('Transfer target must be an active user');
  }
  if (String(toUser._id) === String(fromUserId)) {
    throw new Error('Cannot transfer work to the same user');
  }

  const ownership = await getLiveOwnership(fromUserId);
  const hasSalesWork = ownership.collections + ownership.draftBuckets > 0;
  const hasEnquiries = ownership.assignedEnquiries > 0;

  if (hasSalesWork && !SALES_WORK_ROLES.includes(toUser.role)) {
    throw new Error('Collections and draft quotes can only transfer to a Sales user');
  }
  if (hasEnquiries && !ENQUIRY_ASSIGNEE_ROLES.includes(toUser.role)) {
    throw new Error('Enquiries can only transfer to Data Entry, Sales, or Super Admin');
  }

  if (hasSalesWork) {
    await SalesCollection.updateMany({ salesUserId: fromId }, { $set: { salesUserId: toUser._id } });

    const targetSession = await getOrCreateActiveSession({ userId: String(toUser._id) });
    const sessionDoc = await SalesSession.findById(targetSession._id);
    const drafts = await SalesBucket.find({ salesUserId: fromId, status: 'draft' });
    for (const bucket of drafts) {
      bucket.salesUserId = toUser._id;
      bucket.sessionId = sessionDoc._id;
      bucket.displayNumber = sessionDoc.nextDisplayNumber;
      sessionDoc.nextDisplayNumber += 1;
      await bucket.save();
    }
    await sessionDoc.save();
  }

  if (ownership.activeSession > 0) {
    await SalesSession.updateMany(
      { salesUserId: fromId, status: 'active' },
      { $set: { status: 'closed', closedAt: new Date() } }
    );
  }

  if (hasEnquiries) {
    const assignee = await resolveAssignee(String(toUser._id));
    await Enquiry.updateMany({ assignedToUserId: fromId }, { $set: assignee });
  }
}

export async function closeActiveSalesSession(userId) {
  await SalesSession.updateMany(
    { salesUserId: userId, status: 'active' },
    { $set: { status: 'closed', closedAt: new Date() } }
  );
}
