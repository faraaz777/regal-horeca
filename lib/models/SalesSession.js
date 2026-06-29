/**
 * Sales floor session — one active shift per salesman.
 */

import mongoose from 'mongoose';
import { SESSION_STATUSES } from '@/lib/shared/salesConstants';

const SalesSessionSchema = new mongoose.Schema(
  {
    salesUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: SESSION_STATUSES,
      default: 'active',
      index: true,
    },
    /** Next display number for new buckets in this session (1, 2, 3…). */
    nextDisplayNumber: {
      type: Number,
      default: 1,
      min: 1,
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

SalesSessionSchema.index(
  { salesUserId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

if (mongoose.models.SalesSession) {
  delete mongoose.models.SalesSession;
}

export default mongoose.model('SalesSession', SalesSessionSchema);
