/**
 * GET /api/admin/company-profile — current active PDF (super admin)
 * POST /api/admin/company-profile — upload and activate a new PDF (super admin)
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import CompanyProfile from '@/lib/models/CompanyProfile';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { uploadToR2 } from '@/lib/utils/r2Upload';

const COMPANY_PROFILE_FOLDER = 'company-profile';
const MAX_PDF_SIZE = 25 * 1024 * 1024;

function extractFileKey(fileUrl) {
  try {
    const url = new URL(fileUrl);
    const publicBase = process.env.R2_PUBLIC_URL;
    if (publicBase) {
      const basePath = new URL(publicBase).pathname.replace(/\/$/, '');
      const path = url.pathname.replace(/^\//, '');
      if (basePath && path.startsWith(basePath.replace(/^\//, ''))) {
        return path.slice(basePath.replace(/^\//, '').length).replace(/^\//, '');
      }
    }
    return url.pathname.replace(/^\//, '');
  } catch {
    const parts = fileUrl.split('/');
    return parts.slice(3).join('/');
  }
}

export async function GET(request) {
  const auth = await requireAuth(request, { roles: ['super_admin'] });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();

    const profile = await CompanyProfile.findOne({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      profile: profile || null,
    });
  } catch (error) {
    console.error('Error fetching admin company profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch company profile' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const auth = await requireAuth(request, { roles: ['super_admin'] });
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }

    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json({ error: 'PDF size exceeds 25MB limit' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileUrl = await uploadToR2(buffer, file.name, COMPANY_PROFILE_FOLDER, {
      contentDisposition: 'inline',
    });
    const fileKey = extractFileKey(fileUrl);

    await connectToDatabase();

    await CompanyProfile.updateMany({ isActive: true }, { $set: { isActive: false } });

    const profile = await CompanyProfile.create({
      fileKey,
      fileUrl,
      originalFileName: file.name,
      uploadedBy: auth.session.userId,
      isActive: true,
    });

    return NextResponse.json({
      success: true,
      profile: profile.toObject(),
    });
  } catch (error) {
    console.error('Error uploading company profile:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to upload company profile' },
      { status: 500 }
    );
  }
}
