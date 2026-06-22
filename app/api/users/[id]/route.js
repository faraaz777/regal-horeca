import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import User, { USER_ROLES } from '@/lib/server/models/User';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { hashPassword } from '@/lib/server/auth/password';
import { revokeAllRefreshTokens } from '@/lib/server/auth/refreshToken';
import { writeAuditLog } from '@/lib/server/audit/writeAuditLog';

function sanitizeUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export async function PATCH(request, { params }) {
  const auth = await requireAuth(request, { roles: ['super_admin'] });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { id } = params;
    const body = await request.json();

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (String(user._id) === String(auth.session.userId) && body.isActive === false) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
    }

    if (user.role === 'super_admin' && body.isActive === false) {
      const activeSuperAdmins = await User.countDocuments({
        role: 'super_admin',
        isActive: true,
        _id: { $ne: user._id },
      });
      if (activeSuperAdmins === 0) {
        return NextResponse.json({ error: 'Cannot deactivate the last super admin' }, { status: 400 });
      }
    }

    const before = { role: user.role, isActive: user.isActive, email: user.email };

    if (body.name !== undefined) user.name = String(body.name).trim();
    if (body.role !== undefined) {
      if (!USER_ROLES.includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      user.role = body.role;
    }
    if (body.isActive !== undefined) user.isActive = Boolean(body.isActive);

    if (body.password) {
      user.passwordHash = await hashPassword(body.password);
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await revokeAllRefreshTokens(user._id);
    }

    if (body.role !== undefined && body.role !== before.role) {
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await revokeAllRefreshTokens(user._id);
    }

    await user.save();

    await writeAuditLog({
      userId: auth.session.userId,
      action: 'user.updated',
      entityType: 'User',
      entityId: user._id,
      before,
      after: { role: user.role, isActive: user.isActive, email: user.email },
      request,
    });

    return NextResponse.json({ success: true, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
