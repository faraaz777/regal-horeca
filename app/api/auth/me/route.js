import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth/requireAuth';

/**
 * GET /api/auth/me
 *
 * Current session from access token, re-checked against the User row
 * (active + tokenVersion). Allowed during forced password change.
 */
export async function GET(request) {
  const auth = await requireAuth(request, { allowMustChangePassword: true });
  if (auth.error) return auth.error;

  const { session } = auth;
  return NextResponse.json({
    success: true,
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
      mustChangePassword: Boolean(session.mustChangePassword),
    },
  });
}
