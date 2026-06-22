/**
 * @deprecated Use POST /api/auth/login with cookie session instead.
 */
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'This login endpoint is deprecated. Use POST /api/auth/login instead.' },
    { status: 410 }
  );
}
