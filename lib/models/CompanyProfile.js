/**
 * CompanyProfile
 *
 * Stores the active business/company profile PDF uploaded by super admin.
 * Only one record should be active at a time; older uploads are kept for audit.
 */

import mongoose from 'mongoose';

const CompanyProfileSchema = new mongoose.Schema(
  {
    fileKey: {
      type: String,
      required: true,
      trim: true,
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    originalFileName: {
      type: String,
      trim: true,
      default: '',
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

CompanyProfileSchema.index({ isActive: 1, createdAt: -1 });

const CompanyProfile =
  mongoose.models.CompanyProfile || mongoose.model('CompanyProfile', CompanyProfileSchema);

export default CompanyProfile;
