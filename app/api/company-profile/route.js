/**
 * GET /api/company-profile
 *
 * Returns the active company profile PDF for public display.
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import CompanyProfile from '@/lib/models/CompanyProfile';

export async function GET() {
  try {
    await connectToDatabase();

    const profile = await CompanyProfile.findOne({ isActive: true })
      .sort({ createdAt: -1 })
      .select('fileUrl originalFileName updatedAt createdAt')
      .lean();

    return NextResponse.json({
      success: true,
      profile: profile || null,
    });
  } catch (error) {
    console.error('Error fetching company profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch company profile' },
      { status: 500 }
    );
  }
}
