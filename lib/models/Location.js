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
    /** Hierarchy level. Active stock uses branch → floor → rack only. */
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
    /** Floor-plan coordinates — rack level only; null until placed on locator canvas. */
    position: {
      type: {
        x: { type: Number, default: null },
        y: { type: Number, default: null },
        width: { type: Number, default: null },
        height: { type: Number, default: null },
        rotation: { type: Number, default: 0 },
        zoneId: { type: String, default: null },
        isPlaced: { type: Boolean, default: true },
        xRatio: { type: Number, default: null },
        yRatio: { type: Number, default: null },
        widthRatio: { type: Number, default: null },
        heightRatio: { type: Number, default: null },
      },
      default: null,
    },
    /** Optional historical field — not used by Locator operational UI (no fill %). */
    capacity: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  { timestamps: true }
);

LocationSchema.index({ code: 1, parentLocationId: 1 }, { unique: true });
LocationSchema.index({ parentLocationId: 1, level: 1 });
LocationSchema.index({ level: 1, isActive: 1 });

if (mongoose.models.Location) {
  delete mongoose.models.Location;
}

const Location = mongoose.model('Location', LocationSchema);

export default Location;
