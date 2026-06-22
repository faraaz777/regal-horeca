/**
 * Warehouse rack / shelf location for inventory placement.
 */

import mongoose from 'mongoose';

const LocationSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    parentLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    /** Denormalized display path, e.g. "Branch › Section › Rack › Shelf" */
    path: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    /** Hierarchy level for tree building. Leaf shelf rows are selectable for stock. */
    level: {
      type: String,
      enum: ['branch', 'floor', 'section', 'zone', 'rack', 'shelf'],
      default: 'shelf',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

LocationSchema.index({ code: 1, parentLocationId: 1 }, { unique: true });

if (mongoose.models.Location) {
  delete mongoose.models.Location;
}

const Location = mongoose.model('Location', LocationSchema);

export default Location;
