import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import User from '@/lib/server/models/User';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { hashPassword, generateTempPassword } from '@/lib/server/auth/password';
import { writeAuditLog } from '@/lib/server/audit/writeAuditLog';
import { updateUserSchema, formatZodError } from '@/lib/server/users/schemas';
import {
  sanitizeUser,
  invalidateSessions,
  getLiveOwnership,
  getHistoricalActivityCount,
  reassignLiveWork,
  closeActiveSalesSession,
} from '@/lib/server/users/userService';

/**
 * GET /api/users/[id]
 *
 * User detail plus live ownership counts for the deactivate flow.
 *
 * Permissions: super_admin
 */
export async function GET(request, { params }) {
  const auth = await requireAuth(request, { roles: ['super_admin'] });
  if (auth.error) return auth.error;

  await connectToDatabase();
  const user = await User.findById(params.id).lean();
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const [ownership, historicalCount] = await Promise.all([
    getLiveOwnership(user._id),
    getHistoricalActivityCount(user._id),
  ]);

  return NextResponse.json({
    success: true,
    user: sanitizeUser(user),
    ownership,
    canHardDelete: historicalCount === 0,
  });
}

/**
 * PATCH /api/users/[id]
 *
 * Updates name/role, deactivates (with required reassignment of live work),
 * or issues a one-time temp password.
 *
 * Permissions: super_admin
 */
export async function PATCH(request, { params }) {
  const auth = await requireAuth(request, { roles: ['super_admin'] });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const user = await User.findById(params.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const patch = parsed.data;
    const isSelf = String(user._id) === String(auth.session.userId);

    if (isSelf && patch.isActive === false) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
    }

    if (user.role === 'super_admin' && patch.isActive === false) {
      const activeSuperAdmins = await User.countDocuments({
        role: 'super_admin',
        isActive: true,
        _id: { $ne: user._id },
      });
      if (activeSuperAdmins === 0) {
        return NextResponse.json({ error: 'Cannot deactivate the last super admin' }, { status: 400 });
      }
    }

    const before = { role: user.role, isActive: user.isActive, email: user.email, name: user.name };
    let temporaryPassword = null;
    let shouldInvalidate = false;

    if (patch.name !== undefined) user.name = patch.name;

    if (patch.role !== undefined && patch.role !== user.role) {
      user.role = patch.role;
      shouldInvalidate = true;
    }

    if (patch.isActive === false && user.isActive) {
      const ownership = await getLiveOwnership(user._id);
      if (ownership.needsTransfer) {
        if (!patch.transferToUserId) {
          return NextResponse.json(
            {
              error: 'Reassign live work before deactivating this user',
              code: 'TRANSFER_REQUIRED',
              ownership,
            },
            { status: 400 }
          );
        }
        try {
          await reassignLiveWork(user._id, patch.transferToUserId);
        } catch (e) {
          return NextResponse.json({ error: e.message || 'Transfer failed' }, { status: 400 });
        }
      } else if (ownership.activeSession > 0) {
        await closeActiveSalesSession(user._id);
      }
      user.isActive = false;
      shouldInvalidate = true;
    } else if (patch.isActive === true && !user.isActive) {
      user.isActive = true;
    }

    if (patch.resetPassword) {
      temporaryPassword = generateTempPassword();
      user.passwordHash = await hashPassword(temporaryPassword);
      user.mustChangePassword = true;
      shouldInvalidate = true;
    }

    if (shouldInvalidate) {
      await invalidateSessions(user);
    }

    await user.save();

    await writeAuditLog({
      userId: auth.session.userId,
      action: 'user.updated',
      entityType: 'User',
      entityId: user._id,
      before,
      after: {
        role: user.role,
        isActive: user.isActive,
        email: user.email,
        name: user.name,
        passwordReset: Boolean(patch.resetPassword),
      },
      request,
    });

    return NextResponse.json({
      success: true,
      user: sanitizeUser(user),
      ...(temporaryPassword ? { temporaryPassword } : {}),
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

/**
 * DELETE /api/users/[id]
 *
 * Hard-deletes only accounts with no historical records (typo / unused).
 *
 * Permissions: super_admin
 */
export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, { roles: ['super_admin'] });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const user = await User.findById(params.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (String(user._id) === String(auth.session.userId)) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const historicalCount = await getHistoricalActivityCount(user._id);
    if (historicalCount > 0) {
      return NextResponse.json(
        {
          error: 'This user has history in the system. Deactivate them instead of deleting.',
          code: 'HAS_HISTORY',
        },
        { status: 409 }
      );
    }

    if (user.role === 'super_admin') {
      const otherSuper = await User.countDocuments({
        role: 'super_admin',
        isActive: true,
        _id: { $ne: user._id },
      });
      if (otherSuper === 0) {
        return NextResponse.json({ error: 'Cannot delete the last super admin' }, { status: 400 });
      }
    }

    await invalidateSessions(user);
    await User.deleteOne({ _id: user._id });

    await writeAuditLog({
      userId: auth.session.userId,
      action: 'user.deleted',
      entityType: 'User',
      entityId: user._id,
      before: { email: user.email, role: user.role, name: user.name },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
