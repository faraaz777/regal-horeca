/**
 * Enquiry Messages API Route
 * 
 * POST /api/enquiries/[id]/messages - Add a communication log entry
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import EnquiryMessage from '@/lib/models/EnquiryMessage';
import Enquiry from '@/lib/models/Enquiry';

/**
 * POST /api/enquiries/[id]/messages
 * Add a communication log entry (note, WhatsApp message, etc.)
 */
export async function POST(request, { params }) {
  try {
    await connectToDatabase();

    const { id } = params;
    const body = await request.json();

    const {
      sender = 'admin',
      channel = 'internal-note',
      message,
      createdBy = '',
    } = body;

    // Validate required fields
    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Verify enquiry exists
    const enquiry = await Enquiry.findById(id);
    if (!enquiry) {
      return NextResponse.json(
        { error: 'Enquiry not found' },
        { status: 404 }
      );
    }

    // Create message
    const enquiryMessage = new EnquiryMessage({
      enquiryId: id,
      sender,
      channel,
      message: message.trim(),
      createdBy,
    });

    await enquiryMessage.save();

    return NextResponse.json({
      success: true,
      message: enquiryMessage,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating enquiry message:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return NextResponse.json(
        { error: 'Validation error', details: errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create message', details: error.message },
      { status: 500 }
    );
  }
}

