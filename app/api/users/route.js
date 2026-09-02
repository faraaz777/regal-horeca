import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import User from '@/lib/server/models/User';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { hashPassword, generateTempPassword } from '@/lib/server/auth/password';
import { writeAuditLog } from '@/lib/server/audit/writeAuditLog';
import { createUserSchema, usersListQuerySchema, formatZodError } from '@/lib/server/users/schemas';
import { sanitizeUser } from '@/lib/server/users/userService';

/**
 * GET /api/users
 *
 * Lists staff accounts. Default is active only so former staff do not
 * clutter the team list.
 *
 * Permissions: super_admin
 */
export async function GET(request) {
  const auth = await requireAuth(request, { roles: ['super_admin'] });
  if (auth.error) return auth.error;

  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const parsed = usersListQuerySchema.safeParse({
    status: searchParams.get('status') || 'active',
  });
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const query =
    parsed.data.status === 'all'
      ? {}
      : { isActive: parsed.data.status === 'active' };

  const users = await User.find(query).sort({ createdAt: -1 }).limit(100).lean();

  return NextResponse.json({
    success: true,
    users: users.map(sanitizeUser),
  });
}

/**
 * POST /api/users
 *
 * Creates a staff account with a one-time temp password. The plaintext
 * is returned once so the admin can share it; it is never stored.
 *
 * Permissions: super_admin
 */
export async function POST(request) {
  const auth = await requireAuth(request, { roles: ['super_admin'] });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const { email, name, role } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const temporaryPassword = generateTempPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const user = await User.create({
      email: normalizedEmail,
      name,
      passwordHash,
      role,
      isActive: true,
      mustChangePassword: true,
      createdBy: auth.session.userId,
    });

    await writeAuditLog({
      userId: auth.session.userId,
      action: 'user.created',
      entityType: 'User',
      entityId: user._id,
      after: { email: normalizedEmail, role, name },
      request,
    });

    return NextResponse.json(
      { success: true, user: sanitizeUser(user), temporaryPassword },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
