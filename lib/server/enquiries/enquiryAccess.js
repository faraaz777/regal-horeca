import 'server-only';

import mongoose from 'mongoose';
import User from '@/lib/server/models/User';
import Enquiry from '@/lib/models/Enquiry';
import EnquiryActivity from '@/lib/server/models/EnquiryActivity';
import { writeAuditLog } from '@/lib/server/audit/writeAuditLog';

export function buildEnquiryListQuery(session, baseQuery = {}) {
  const query = { ...baseQuery };

  if (session.role === 'sales' && mongoose.Types.ObjectId.isValid(session.userId)) {
    query.$or = [
      { assignedToUserId: new mongoose.Types.ObjectId(session.userId) },
      { assignedToUserId: null },
      { assignedToUserId: { $exists: false } },
    ];
  }

  return query;
}

export async function canAccessEnquiry(session, enquiry) {
  if (!enquiry) return false;
  if (session.role === 'super_admin' || session.role === 'data_entry') return true;
  if (session.role === 'viewer') return true;

  if (session.role === 'sales') {
    const assignedId = enquiry.assignedToUserId?.toString?.() || enquiry.assignedToUserId;
    if (!assignedId) return true;
    return assignedId === String(session.userId);
  }

  return false;
}

export async function resolveAssignee(assignedToUserId) {
  if (!assignedToUserId) {
    return { assignedToUserId: null, assignedToName: '', assignedTo: '' };
  }

  const user = await User.findById(assignedToUserId).select('name email role isActive').lean();
  if (!user || !user.isActive) {
    throw new Error('Invalid assignee user');
  }

  return {
    assignedToUserId: user._id,
    assignedToName: user.name,
    assignedTo: user.email,
  };
}

export async function logEnquiryActivity({ enquiryId, userId, userName, action, before, after }) {
  await EnquiryActivity.create({
    enquiryId,
    userId,
    userName,
    action,
    before,
    after,
  });
}

export async function applyEnquiryUpdate({ enquiryId, session, body, request }) {
  const existing = await Enquiry.findById(enquiryId).lean();
  if (!existing) return { error: 'not_found' };

  const allowed = await canAccessEnquiry(session, existing);
  if (!allowed) return { error: 'forbidden' };

  const updateData = {};
  const { status, priority, notes, phone, userType, assignedToUserId } = body;

  if (status !== undefined) updateData.status = status;
  if (priority !== undefined) updateData.priority = priority;
  if (notes !== undefined) updateData.notes = notes;
  if (phone !== undefined) updateData.phone = phone;
  if (userType !== undefined) updateData.userType = userType;

  if (assignedToUserId !== undefined) {
    if (session.role === 'sales') {
      const targetId = assignedToUserId ? String(assignedToUserId) : null;
      if (targetId && targetId !== String(session.userId)) {
        return { error: 'forbidden_assign' };
      }
    }

    try {
      const assignee = await resolveAssignee(assignedToUserId || null);
      Object.assign(updateData, assignee);
    } catch (e) {
      return { error: 'invalid_assignee', message: e.message };
    }
  }

  const enquiry = await Enquiry.findByIdAndUpdate(
    enquiryId,
    { $set: updateData },
    { new: true, runValidators: true }
  )
    .populate('customerId')
    .populate('assignedToUserId', 'name email role')
    .lean();

  if (assignedToUserId !== undefined && String(existing.assignedToUserId || '') !== String(updateData.assignedToUserId || '')) {
    await logEnquiryActivity({
      enquiryId,
      userId: session.userId,
      userName: session.name,
      action: 'assigned',
      before: { assignedToUserId: existing.assignedToUserId, assignedToName: existing.assignedToName },
      after: { assignedToUserId: updateData.assignedToUserId, assignedToName: updateData.assignedToName },
    });
  }

  if (status !== undefined && status !== existing.status) {
    await logEnquiryActivity({
      enquiryId,
      userId: session.userId,
      userName: session.name,
      action: 'status_changed',
      before: { status: existing.status },
      after: { status },
    });
  }

  await writeAuditLog({
    userId: session.userId,
    action: 'enquiry.updated',
    entityType: 'Enquiry',
    entityId: enquiryId,
    before: { status: existing.status, assignedToUserId: existing.assignedToUserId },
    after: { status: enquiry?.status, assignedToUserId: enquiry?.assignedToUserId },
    request,
  });

  return { enquiry };
}
