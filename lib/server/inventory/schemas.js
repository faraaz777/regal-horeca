import { z } from 'zod';
import {
  INTAKE_STATUS_BUCKETS,
  OPENING_REASONS,
  DEAD_STOCK_PERIODS,
} from '@/lib/shared/inventoryConstants';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const locationEntrySchema = z.object({
  locationId: objectId,
  qty: z.number().int().positive('Quantity must be at least 1'),
});

function refineOpeningAllocation(data, ctx) {
  if (!data.locationEntries?.length) {
    return;
  }

  const openingQty = data.openingQty;
  if (!openingQty || openingQty < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Opening quantity is required when allocating to racks',
      path: ['openingQty'],
    });
    return;
  }

  const ids = data.locationEntries.map((e) => e.locationId);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Duplicate rack in allocation',
      path: ['locationEntries'],
    });
  }

  const allocated = data.locationEntries.reduce((sum, e) => sum + e.qty, 0);
  if (allocated !== openingQty) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Allocated total (${allocated}) must equal opening quantity (${openingQty})`,
      path: ['locationEntries'],
    });
  }
}

function refineOpeningLocations(data, ctx) {
  if (data.locationEntries?.length) {
    refineOpeningAllocation(data, ctx);
    return;
  }
  const ids = data.locationIds?.length
    ? data.locationIds
    : data.locationId
      ? [data.locationId]
      : [];
  if (!ids.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Select at least one location',
      path: ['locationEntries'],
    });
    return;
  }
  if (!data.openingQty || data.openingQty < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Opening quantity must be at least 1',
      path: ['openingQty'],
    });
  }
}

export const openingGateSchema = z
  .object({
    minStock: z.number().int().min(0),
    maxStock: z.number().int().min(0),
    reorderQty: z.number().int().min(0).optional().default(0),
    deadStockPeriod: z.enum(DEAD_STOCK_PERIODS),
    deadStockQty: z.number().int().positive('Dead stock quantity must be at least 1'),
    locationId: objectId.optional(),
    locationIds: z.array(objectId).min(1).optional(),
    locationEntries: z.array(locationEntrySchema).min(1).optional(),
    openingQty: z.number().int().positive('Opening quantity must be at least 1').optional(),
    openingStatusBucket: z.enum(INTAKE_STATUS_BUCKETS).default('sellable'),
    markAsDeadStock: z.boolean().optional().default(false),
    openingReason: z.enum(OPENING_REASONS),
    openingRatePaise: z.number().int().min(0).optional().nullable(),
    remark: z.string().trim().optional().default(''),
  })
  .superRefine((data, ctx) => {
    refineOpeningLocations(data, ctx);
    if (data.openingReason === 'purchase') {
      if (data.openingRatePaise == null || data.openingRatePaise <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Opening rate (paise) is required when reason is Purchase',
          path: ['openingRatePaise'],
        });
      }
    }
  });

export const addOpeningSchema = z.object({
  productId: objectId,
  opening: openingGateSchema,
});

/** Additional intake at a new location when rules already exist. */
export const additionalOpeningSchema = z
  .object({
    productId: objectId,
    locationId: objectId.optional(),
    locationIds: z.array(objectId).min(1).optional(),
    locationEntries: z.array(locationEntrySchema).min(1).optional(),
    openingQty: z.number().int().positive().optional(),
    openingStatusBucket: z.enum(INTAKE_STATUS_BUCKETS).default('sellable'),
    markAsDeadStock: z.boolean().optional().default(false),
    openingReason: z.enum(OPENING_REASONS),
    openingRatePaise: z.number().int().min(0).optional().nullable(),
    remark: z.string().trim().optional().default(''),
  })
  .superRefine((data, ctx) => {
    refineOpeningLocations(data, ctx);
    if (data.openingReason === 'purchase') {
      if (data.openingRatePaise == null || data.openingRatePaise <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Opening rate (paise) is required when reason is Purchase',
          path: ['openingRatePaise'],
        });
      }
    }
  });

export const inventorySearchSchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(50),
});

export const inventoryRuleUpdateSchema = z
  .object({
    minStock: z.number().int().min(0),
    maxStock: z.number().int().min(0),
    reorderQty: z.number().int().min(0).optional().default(0),
    deadStockPeriod: z.enum(DEAD_STOCK_PERIODS),
    deadStockQty: z.number().int().positive('Dead stock quantity must be at least 1'),
    deadStockMarked: z.boolean().optional().default(false),
    gateRemark: z.string().trim().optional().default(''),
  })
  .superRefine((data, ctx) => {
    if (data.maxStock < data.minStock) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Max stock must be greater than or equal to min stock',
        path: ['maxStock'],
      });
    }
  });

export const bulkRackPositionsSchema = z.object({
  positions: z
    .array(
      z.object({
        id: objectId,
        x: z.number().finite(),
        y: z.number().finite(),
        width: z.number().finite().positive().optional(),
        height: z.number().finite().positive().optional(),
        rotation: z.number().finite().optional(),
        zoneId: z.string().trim().optional().nullable(),
        xRatio: z.number().finite().optional(),
        yRatio: z.number().finite().optional(),
        widthRatio: z.number().finite().optional(),
        heightRatio: z.number().finite().optional(),
      })
    )
    .min(1)
    .max(200),
});

const floorZoneSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  code: z.string().trim().optional().default(''),
  description: z.string().trim().optional().default(''),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  rotation: z.number().finite().optional().default(0),
  xRatio: z.number().finite().optional(),
  yRatio: z.number().finite().optional(),
  widthRatio: z.number().finite().optional(),
  heightRatio: z.number().finite().optional(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  opacity: z.number().min(0).max(1).optional().default(1),
  locked: z.boolean().optional().default(false),
  hidden: z.boolean().optional().default(false),
  zIndex: z.number().int().optional().default(0),
});

export const floorLayoutUpdateSchema = z.object({
  expectedVersion: z.number().int().positive(),
  canvas: z
    .object({
      coordinateWidth: z.number().finite().positive().optional(),
      coordinateHeight: z.number().finite().positive().optional(),
      gridEnabled: z.boolean().optional(),
      gridSize: z.number().int().positive().optional(),
      snapEnabled: z.boolean().optional(),
      guidesEnabled: z.boolean().optional(),
      rackPlacementRule: z.enum(['must_be_inside_zone', 'allow_unzoned']).optional(),
    })
    .optional(),
  backgroundImage: z
    .object({
      opacity: z.number().min(0).max(1).optional(),
      visible: z.boolean().optional(),
      locked: z.boolean().optional(),
    })
    .optional(),
  zones: z.array(floorZoneSchema).optional(),
});

export const rackPositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive().optional(),
  height: z.number().finite().positive().optional(),
  rotation: z.number().finite().optional(),
  zoneId: z.string().trim().optional().nullable(),
  xRatio: z.number().finite().optional(),
  yRatio: z.number().finite().optional(),
  widthRatio: z.number().finite().optional(),
  heightRatio: z.number().finite().optional(),
});

export const zoneRackAssignSchema = z.object({
  rackIds: z.array(objectId).min(1).max(100),
  layoutVersion: z.number().int().positive(),
});

export const zoneRackRemoveSchema = z.object({
  rackIds: z.array(objectId).min(1).max(100),
  layoutVersion: z.number().int().positive(),
});

export const zoneRackMoveSchema = z.object({
  rackId: objectId,
  fromZoneId: z.string().trim().min(1),
  layoutVersion: z.number().int().positive(),
});

export function formatZodError(error) {
  return error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
}
