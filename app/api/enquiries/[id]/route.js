/**
 * Single Enquiry API Route
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Enquiry from '@/lib/models/Enquiry';
import EnquiryItem from '@/lib/models/EnquiryItem';
import EnquiryMessage from '@/lib/models/EnquiryMessage';
import EnquiryActivity from '@/lib/server/models/EnquiryActivity';
import { normalizePhone } from '@/lib/utils/phone';
import { requireAuth } from '@/lib/server/auth/requireAuth';
import {
  canAccessEnquiry,
  applyEnquiryUpdate,
} from '@/lib/server/enquiries/enquiryAccess';

export async function GET(request, { params }) {
  const auth = await requireAuth(request, { permission: 'enquiries:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();

    const { id } = params;

    let enquiry;
    try {
      enquiry = await Enquiry.findById(id)
        .populate('customerId')
        .populate('assignedToUserId', 'name email role')
        .lean();
    } catch {
      enquiry = await Enquiry.findById(id).lean();
    }

    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    if (!(await canAccessEnquiry(auth.session, enquiry))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let enquiryItems = [];
    try {
      enquiryItems = await EnquiryItem.find({ enquiryId: id })
        .populate('productId', 'title heroImage slug price')
        .lean();
    } catch {
      enquiryItems = await EnquiryItem.find({ enquiryId: id }).lean();
    }

    const messages = await EnquiryMessage.find({ enquiryId: id })
      .sort({ createdAt: -1 })
      .lean();

    const activities = await EnquiryActivity.find({ enquiryId: id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    let customerEnquiriesCount = 0;
    if (enquiry.customerId) {
      const customerIdValue = enquiry.customerId?._id || enquiry.customerId;
      if (customerIdValue) {
        customerEnquiriesCount = await Enquiry.countDocuments({
          customerId: customerIdValue,
        });
      }
    }

    const relatedEnquiriesQuery = {
      _id: { $ne: enquiry._id },
    };

    if (enquiry.customerId) {
      const customerIdValue = enquiry.customerId?._id || enquiry.customerId;
      if (customerIdValue) {
        relatedEnquiriesQuery.customerId = customerIdValue;
      }
    } else if (enquiry.phone) {
      const normalizedPhone = normalizePhone(enquiry.phone);
      if (normalizedPhone && normalizedPhone.length > 0) {
        relatedEnquiriesQuery.phone = normalizedPhone;
      }
    }

    let relatedEnquiries = [];
    if (relatedEnquiriesQuery.customerId || relatedEnquiriesQuery.phone) {
      relatedEnquiries = await Enquiry.find(relatedEnquiriesQuery)
        .select('enquiryId source type status createdAt phone name assignedToName assignedToUserId')
        .populate('assignedToUserId', 'name')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
    }

    return NextResponse.json({
      success: true,
      enquiry: {
        ...enquiry,
        items: enquiryItems,
        messages,
        activities,
        customerEnquiriesCount,
        relatedEnquiries,
      },
    });
  } catch (error) {
    console.error('Error fetching enquiry:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enquiry', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  const auth = await requireAuth(request, { permission: 'enquiries:write' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();
    const { id } = params;
    const body = await request.json();

    const result = await applyEnquiryUpdate({
      enquiryId: id,
      session: auth.session,
      body,
      request,
    });

    if (result.error === 'not_found') {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }
    if (result.error === 'forbidden' || result.error === 'forbidden_assign') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (result.error === 'invalid_assignee') {
      return NextResponse.json({ error: result.message || 'Invalid assignee' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      enquiry: result.enquiry,
    });
  } catch (error) {
    console.error('Error updating enquiry:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return NextResponse.json({ error: 'Validation error', details: errors }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to update enquiry', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request, { roles: ['super_admin'] });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();

    const { id } = params;

    await EnquiryItem.deleteMany({ enquiryId: id });
    await EnquiryMessage.deleteMany({ enquiryId: id });
    await EnquiryActivity.deleteMany({ enquiryId: id });

    const enquiry = await Enquiry.findByIdAndDelete(id);

    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Enquiry deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting enquiry:', error);
    return NextResponse.json(
      { error: 'Failed to delete enquiry', details: error.message },
      { status: 500 }
    );
  }
}
