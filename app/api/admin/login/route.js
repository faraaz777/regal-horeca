/**
 * POST /api/admin/login
 * Body: { email?: string, password: string }
 * Returns JWT stored by the client as regal_admin_token for Bearer auth on admin APIs.
 */

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { generateToken } from '@/lib/utils/auth';

function safeEqualString(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export async function POST(request) {
  try {
    const expectedPassword = process.env.ADMIN_PASSWORD;
    if (!expectedPassword) {
      return NextResponse.json(
        { error: 'Admin login is not configured (set ADMIN_PASSWORD in the environment).' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const password = body?.password;
    const email = body?.email || 'admin';

    const expectedEmail = process.env.ADMIN_EMAIL;
    if (expectedEmail && email !== expectedEmail) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!safeEqualString(password, expectedPassword)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = generateToken(email);

    return NextResponse.json({
      success: true,
      token,
      email,
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
