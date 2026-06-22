/**
 * Enquiry Messages API Route
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import EnquiryMessage from '@/lib/models/EnquiryMessage';
import Enquiry from '@/lib/models/Enquiry';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import { canAccessEnquiry } from '@/lib/server/enquiries/enquiryAccess';

export async function POST(request, { params }) {
  const auth = await requireAuth(request, { permission: 'enquiries:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();

    const { id } = params;
    const body = await request.json();

    const { sender = 'admin', channel = 'internal-note', message } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const enquiry = await Enquiry.findById(id).lean();
    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    if (!(await canAccessEnquiry(auth.session, enquiry))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const enquiryMessage = new EnquiryMessage({
      enquiryId: id,
      sender,
      channel,
      message: message.trim(),
      createdBy: auth.session.name || auth.session.email,
      createdByUserId: auth.session.userId,
      createdByName: auth.session.name || auth.session.email,
    });

    await enquiryMessage.save();

    return NextResponse.json(
      {
        success: true,
        message: enquiryMessage,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating enquiry message:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return NextResponse.json({ error: 'Validation error', details: errors }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to create message', details: error.message },
      { status: 500 }
    );
  }
}
