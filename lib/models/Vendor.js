import mongoose from 'mongoose';

const VendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    code: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

if (mongoose.models.Vendor) delete mongoose.models.Vendor;

export default mongoose.model('Vendor', VendorSchema);
