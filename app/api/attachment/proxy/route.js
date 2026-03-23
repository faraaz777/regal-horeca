import { NextResponse } from 'next/server';

function isAllowedAttachmentUrl(rawUrl) {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    if (!['https:', 'http:'].includes(parsed.protocol)) return false;

    const publicBase = process.env.R2_PUBLIC_URL;
    if (!publicBase) return true;

    const parsedBase = new URL(publicBase);
    return parsed.origin === parsedBase.origin;
  } catch {
    return false;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const src = searchParams.get('src');
    const forceDownload = searchParams.get('download') === '1';

    if (!src || !isAllowedAttachmentUrl(src)) {
      return NextResponse.json({ error: 'Invalid attachment URL.' }, { status: 400 });
    }

    const upstream = await fetch(src, { cache: 'no-store' });
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Failed to fetch attachment.' }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length') || undefined;
    const pathName = new URL(src).pathname;
    const fileName = pathName.split('/').pop() || 'attachment';
    const disposition = `${forceDownload ? 'attachment' : 'inline'}; filename="${fileName}"`;

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', disposition);
    headers.set('Cache-Control', 'private, no-store');
    if (contentLength) headers.set('Content-Length', contentLength);

    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to stream attachment.', details: error.message || String(error) },
      { status: 500 }
    );
  }
}

