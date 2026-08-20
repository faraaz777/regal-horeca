import { z } from 'zod';
import { USER_ROLES } from '@/lib/shared/roles';
import { MIN_PASSWORD_LENGTH } from '@/lib/server/auth/password';
import { formatZodError } from '@/lib/server/inventory/schemas';

export { formatZodError };

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const roleField = z
  .string()
  .refine((r) => USER_ROLES.includes(r), { message: 'Invalid role' });

export const createUserSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(1, 'Name is required').max(120),
  role: roleField.optional().default('data_entry'),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    role: roleField.optional(),
    isActive: z.boolean().optional(),
    resetPassword: z.literal(true).optional(),
    transferToUserId: objectId.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'No fields to update',
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `New password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      .max(128),
    confirmPassword: z.string().optional(),
  })
  .refine((data) => !data.confirmPassword || data.confirmPassword === data.newPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const usersListQuerySchema = z.object({
  status: z.enum(['active', 'inactive', 'all']).optional().default('active'),
});
