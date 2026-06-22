import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import User from '@/lib/server/models/User';
import { verifyPassword } from '@/lib/server/auth/password';
import { signAccessToken, ACCESS_MAX_AGE_SECONDS } from '@/lib/server/auth/jwt';
import {
  generateRefreshToken,
  storeRefreshToken,
  getCookieOptions,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} from '@/lib/server/auth/refreshToken';
import { writeAuditLog } from '@/lib/server/audit/writeAuditLog';

export async function POST(request) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = body?.password;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await User.findOne({ email, isActive: true }).lean();
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

    const accessToken = await signAccessToken({
      userId: user._id,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
      email: user.email,
      name: user.name,
    });

    const refreshToken = generateRefreshToken();
    await storeRefreshToken({
      userId: user._id,
      token: refreshToken,
      userAgent: request.headers.get('user-agent') || '',
    });

    await writeAuditLog({
      userId: user._id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user._id,
      request,
    });

    const res = NextResponse.json({
      success: true,
      user: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    res.cookies.set(ACCESS_COOKIE, accessToken, getCookieOptions(ACCESS_MAX_AGE_SECONDS, '/'));
    res.cookies.set(REFRESH_COOKIE, refreshToken, getCookieOptions(60 * 60 * 24 * 30, '/api/auth'));

    return res;
  } catch (error) {
    console.error('Auth login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
