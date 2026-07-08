import { NextResponse } from 'next/server';
import { uploadToR2 } from '@/lib/utils/r2Upload';
import { optimizeImage } from '@/lib/utils/imageOptimizer';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { hasPermission } from '@/lib/shared/permissions';
import { SALES_COLLECTION_THUMBNAIL_FOLDER } from '@/lib/shared/salesConstants';

const VALID_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const VALID_DOCUMENT_TYPES = ['application/pdf'];

async function assertUploadAccess(request, folder) {
  const auth = await requireAuth(request);
  if (auth.error) return { error: auth.error };

  const { session } = auth;
  if (hasPermission(session.role, 'products:write')) {
    return { session, imagesOnly: false };
  }

  if (
    folder === SALES_COLLECTION_THUMBNAIL_FOLDER &&
    hasPermission(session.role, 'sales:collections:write')
  ) {
    return { session, imagesOnly: true };
  }

  return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
}

export async function POST(request) {
  const url = new URL(request.url);
  const folder = url.searchParams.get('folder') || 'products';

  const access = await assertUploadAccess(request, folder);
  if (access.error) return access.error;

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const validTypes = access.imagesOnly
      ? VALID_IMAGE_TYPES
      : [...VALID_IMAGE_TYPES, ...VALID_DOCUMENT_TYPES];

    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: access.imagesOnly ? 'Only images are allowed.' : 'Invalid file type.' },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const SKIP_OPTIMIZATION_SIZE = 1.5 * 1024 * 1024;
    let optimizedBuffer = buffer;

    if (VALID_IMAGE_TYPES.includes(file.type) && file.size > SKIP_OPTIMIZATION_SIZE) {
      optimizedBuffer = await optimizeImage(buffer);
    }

    const publicUrl = await uploadToR2(optimizedBuffer, file.name, folder);

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error.message || 'Failed to upload file';
    return NextResponse.json(
      { success: false, error: errorMessage, details: error.message || String(error) },
      { status: 500 }
    );
  }
}
