/**
 * Next.js Middleware
 * 
 * Admin routes are now publicly accessible (no authentication required).
 */

import { NextResponse } from 'next/server';

export function middleware(request) {
  // No protection - admin routes are directly accessible
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
  ],
};

