import { z } from 'zod';
import { formatZodError } from '@/lib/server/inventory/schemas';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export { formatZodError };

export const catalogQuerySchema = z.object({
  q: z.string().trim().optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(24),
  sort: z.enum(['availability', 'price_asc', 'price_desc', 'title']).optional().default('title'),
  brands: z.string().trim().optional().default(''),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  stock: z.enum(['all', 'in_stock', 'out']).optional().default('all'),
  category: z.string().trim().optional().default(''),
});

export const bucketPatchSchema = z.object({
  customerName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const bucketLineSchema = z.object({
  productId: objectId,
  quantity: z.number().int().min(1),
  offeredRatePaise: z.number().int().min(0).optional(),
  notes: z.string().trim().optional().default(''),
});

export const bucketLinesSchema = z.object({
  lines: z.array(bucketLineSchema).min(0),
});

export const requestReviewSchema = z.object({
  action: z.enum(['approve', 'reject', 'fulfill', 'cancel']),
  comment: z.string().trim().optional().default(''),
  lines: z
    .array(
      z.object({
        lineId: objectId,
        approvedQty: z.number().int().min(0),
      })
    )
    .optional(),
});

export const requestsListSchema = z.object({
  status: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  q: z.string().trim().optional().default(''),
  /** Limit to requests created within the last N days (e.g. 7, 30). Omit for all time. */
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export const customerSearchSchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters'),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
});

const thumbnailUrlField = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .default('');

export const collectionCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(500).optional().default(''),
  thumbnailUrl: thumbnailUrlField,
});

export const collectionPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  thumbnailUrl: thumbnailUrlField.optional(),
  pinned: z.boolean().optional(),
});

export const collectionItemSchema = z.object({
  productId: objectId,
  note: z.string().trim().optional().default(''),
  suggestedQty: z.number().int().min(1).optional().default(1),
});

export const collectionAddToBucketSchema = z.object({
  bucketId: objectId,
});
