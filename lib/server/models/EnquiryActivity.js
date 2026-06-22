/**
 * Enquiry activity timeline — status, assignment, priority changes.
 */

import mongoose from 'mongoose';

const EnquiryActivitySchema = new mongoose.Schema(
  {
    enquiryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Enquiry',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    userName: {
      type: String,
      trim: true,
      default: '',
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

EnquiryActivitySchema.index({ enquiryId: 1, createdAt: -1 });

if (mongoose.models.EnquiryActivity) {
  delete mongoose.models.EnquiryActivity;
}

const EnquiryActivity = mongoose.model('EnquiryActivity', EnquiryActivitySchema);

export default EnquiryActivity;
