import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import User, { USER_ROLES } from '@/lib/server/models/User';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { hashPassword } from '@/lib/server/auth/password';
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

export async function GET(request) {
  const auth = await requireAuth(request, { roles: ['super_admin'] });
  if (auth.error) return auth.error;

  await connectToDatabase();
  const users = await User.find({}).sort({ createdAt: -1 }).lean();

  return NextResponse.json({
    success: true,
    users: users.map(sanitizeUser),
  });
}

export async function POST(request) {
  const auth = await requireAuth(request, { roles: ['super_admin'] });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const body = await request.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const name = String(body?.name || '').trim();
    const password = body?.password;
    const role = body?.role || 'viewer';

    if (!email || !name || !password) {
      return NextResponse.json({ error: 'Email, name, and password are required' }, { status: 400 });
    }

    if (!USER_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      email,
      name,
      passwordHash,
      role,
      isActive: true,
      createdBy: auth.session.userId,
    });

    await writeAuditLog({
      userId: auth.session.userId,
      action: 'user.created',
      entityType: 'User',
      entityId: user._id,
      after: { email, role, name },
      request,
    });

    return NextResponse.json({ success: true, user: sanitizeUser(user) }, { status: 201 });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
