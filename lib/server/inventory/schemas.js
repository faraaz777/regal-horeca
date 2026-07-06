import { z } from 'zod';
import {
  STOCK_UNITS,
  PRODUCT_STATUSES,
  STATUS_BUCKETS,
  OPENING_REASONS,
  DEAD_STOCK_PERIODS,
} from '@/lib/shared/inventoryConstants';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const productMasterSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required'),
  sku: z.string().trim().min(1, 'SKU is required'),
  barcode: z.string().trim().min(1, 'Barcode is required'),
  colour: z.string().trim().optional().default(''),
  brand: z.string().trim().min(1, 'Brand is required'),
  departmentId: objectId,
  categoryId: objectId,
  unit: z.enum(STOCK_UNITS),
  hsnCode: z.string().trim().min(1, 'HSN code is required'),
  gstPercent: z.number().min(0).max(100),
  costPaise: z.number().int().min(0),
  mrpPaise: z.number().int().min(0),
  sellingPricePaise: z.number().int().min(0),
  maxDiscountPercent: z.number().min(0).max(100).default(0),
  vendorId: objectId.optional().nullable(),
  productStatus: z.enum(PRODUCT_STATUSES).default('active'),
  heroImage: z.string().trim().optional().default(''),
});

export const openingGateSchema = z
  .object({
    minStock: z.number().int().min(0),
    maxStock: z.number().int().min(0),
    reorderQty: z.number().int().min(0).optional().default(0),
    deadStockPeriod: z.enum(DEAD_STOCK_PERIODS),
    deadStockQty: z.number().int().positive('Dead stock quantity must be at least 1'),
    locationId: objectId,
    openingQty: z.number().int().positive('Opening quantity must be at least 1'),
    openingStatusBucket: z.enum(STATUS_BUCKETS).default('sellable'),
    markAsDeadStock: z.boolean().optional().default(false),
    openingReason: z.enum(OPENING_REASONS),
    openingRatePaise: z.number().int().min(0).optional().nullable(),
    remark: z.string().trim().optional().default(''),
  })
  .superRefine((data, ctx) => {
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

export const createWithOpeningSchema = z.object({
  product: productMasterSchema,
  opening: openingGateSchema,
});

export const addOpeningSchema = z.object({
  productId: objectId,
  opening: openingGateSchema,
});

/** Additional intake at a new location when rules already exist. */
export const additionalOpeningSchema = z
  .object({
    productId: objectId,
    locationId: objectId,
    openingQty: z.number().int().positive(),
    openingStatusBucket: z.enum(STATUS_BUCKETS).default('sellable'),
    markAsDeadStock: z.boolean().optional().default(false),
    openingReason: z.enum(OPENING_REASONS),
    openingRatePaise: z.number().int().min(0).optional().nullable(),
    remark: z.string().trim().optional().default(''),
  })
  .superRefine((data, ctx) => {
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
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export function formatZodError(error) {
  return error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
}
