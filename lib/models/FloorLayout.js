/**
 * Per-floor spatial layout: background image, zones, canvas settings.
 * Rack coordinates remain on rack Location.position — not duplicated here.
 */

import mongoose from 'mongoose';
import {
  DEFAULT_COORDINATE_WIDTH,
  DEFAULT_COORDINATE_HEIGHT,
  DEFAULT_GRID_SIZE,
  FLOOR_LAYOUT_STATUSES,
  RACK_PLACEMENT_RULES,
} from '@/lib/shared/floorLayoutConstants';

const FloorZoneSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    rotation: { type: Number, default: 0 },
    xRatio: { type: Number, default: 0 },
    yRatio: { type: Number, default: 0 },
    widthRatio: { type: Number, default: 0 },
    heightRatio: { type: Number, default: 0 },
    fill: { type: String, default: 'rgba(59, 130, 246, 0.12)' },
    stroke: { type: String, default: 'rgba(37, 99, 235, 0.6)' },
    opacity: { type: Number, default: 1, min: 0, max: 1 },
    locked: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
    zIndex: { type: Number, default: 0 },
  },
  { _id: false, timestamps: true }
);

const FloorLayoutSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
      index: true,
    },
    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
      unique: true,
      index: true,
    },
    backgroundImage: {
      url: { type: String, default: null },
      storageKey: { type: String, default: null },
      originalWidth: { type: Number, default: null },
      originalHeight: { type: Number, default: null },
      aspectRatio: { type: Number, default: null },
      opacity: { type: Number, default: 1, min: 0, max: 1 },
      visible: { type: Boolean, default: true },
      locked: { type: Boolean, default: true },
    },
    canvas: {
      coordinateWidth: { type: Number, default: DEFAULT_COORDINATE_WIDTH },
      coordinateHeight: { type: Number, default: DEFAULT_COORDINATE_HEIGHT },
      gridEnabled: { type: Boolean, default: true },
      gridSize: { type: Number, default: DEFAULT_GRID_SIZE },
      snapEnabled: { type: Boolean, default: true },
      guidesEnabled: { type: Boolean, default: true },
      rackPlacementRule: {
        type: String,
        enum: RACK_PLACEMENT_RULES,
        default: 'allow_unzoned',
      },
    },
    zones: { type: [FloorZoneSchema], default: [] },
    version: { type: Number, default: 1 },
    status: {
      type: String,
      enum: FLOOR_LAYOUT_STATUSES,
      default: 'draft',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

if (mongoose.models.FloorLayout) delete mongoose.models.FloorLayout;

export default mongoose.model('FloorLayout', FloorLayoutSchema);
