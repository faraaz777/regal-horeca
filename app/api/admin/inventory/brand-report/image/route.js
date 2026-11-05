/**
 * GET /api/admin/inventory/brand-report/image?url=
 *
 * Same-origin proxy for product photos so the brand-report PDF can
 * embed them. R2 public URLs are not CORS-enabled for the browser,
 * so html-to-image otherwise captures empty circles.
 *
 * Only allows the configured R2 public host (and common r2.dev hosts).
 *
 * Permissions: inventory:read
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth/requireAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 2 * 1024 * 1024;

function allowedHosts() {
  const hosts = new Set();
  const publicUrl = String(process.env.R2_PUBLIC_URL || '').trim();
  if (publicUrl) {
    try {
      hosts.add(new URL(publicUrl).hostname.toLowerCase());
    } catch {
      // Ignore bad env.
    }
  }
  hosts.add('pub-83aac0f4bf7f4e08825bbcd70a863973.r2.dev');
  hosts.add('pub-f321790dd0774841a14d142aad52ade6.r2.dev');
  return hosts;
}

function isAllowedImageUrl(raw) {
  let parsed;
  try {
    parsed = new URL(String(raw || ''));
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (allowedHosts().has(host)) return true;
  return host.endsWith('.r2.dev') || host.endsWith('.r2.cloudflarestorage.com');
}

export async function GET(request) {
  const auth = await requireAuth(request, { permission: 'inventory:read' });
  if (auth.error) return auth.error;

  const url = new URL(request.url).searchParams.get('url') || '';
  if (!isAllowedImageUrl(url)) {
    return NextResponse.json({ error: 'Image host is not allowed' }, { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      headers: { Accept: 'image/*,*/*' },
      cache: 'force-cache',
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Image could not be loaded' }, { status: 502 });
    }

    const contentType = String(upstream.headers.get('content-type') || '').toLowerCase();
    if (contentType && !contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'URL is not an image' }, { status: 400 });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: 'Image is empty or too large' }, { status: 400 });
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Brand report image proxy error:', error);
    return NextResponse.json({ error: 'Image proxy failed' }, { status: 500 });
  }
}
