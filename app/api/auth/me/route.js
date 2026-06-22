import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth/requireAuth';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { session } = auth;
  return NextResponse.json({
    success: true,
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
    },
  });
}
