/**
 * Single Enquiry API Route
 * 
 * GET /api/enquiries/[id] - Get single enquiry details
 * PUT /api/enquiries/[id] - Update enquiry (status, priority, notes, etc.)
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Enquiry from '@/lib/models/Enquiry';
import EnquiryItem from '@/lib/models/EnquiryItem';
import EnquiryMessage from '@/lib/models/EnquiryMessage';
import { normalizePhone } from '@/lib/utils/phone';

/**
 * GET /api/enquiries/[id]
 * Get single enquiry with all related data
 */
export async function GET(request, { params }) {
  try {
    await connectToDatabase();

    const { id } = params;

    // Get enquiry with customer details - handle populate failure gracefully
    let enquiry;
    try {
      enquiry = await Enquiry.findById(id)
        .populate('customerId')
        .lean();
    } catch (populateError) {
      // If populate fails, try without populate
      enquiry = await Enquiry.findById(id).lean();
    }

    if (!enquiry) {
      return NextResponse.json(
        { error: 'Enquiry not found' },
        { status: 404 }
      );
    }

    // Get enquiry items (cart products) - handle populate failure gracefully
    let enquiryItems = [];
    try {
      enquiryItems = await EnquiryItem.find({ enquiryId: id })
        .populate('productId', 'title heroImage slug price')
        .lean();
    } catch (populateError) {
      // If populate fails, try without populate
      enquiryItems = await EnquiryItem.find({ enquiryId: id }).lean();
    }

    // Get communication log
    const messages = await EnquiryMessage.find({ enquiryId: id })
      .sort({ createdAt: -1 })
      .lean();

    // Get customer's total enquiries count
    let customerEnquiriesCount = 0;
    if (enquiry.customerId) {
      const customerIdValue = enquiry.customerId?._id || enquiry.customerId;
      if (customerIdValue) {
        customerEnquiriesCount = await Enquiry.countDocuments({
          customerId: customerIdValue
        });
      }
    }

    // Get related enquiries - by customerId (primary) or phone (fallback for legacy data)
    const relatedEnquiriesQuery = {
      _id: { $ne: enquiry._id }, // Exclude current enquiry
    };

    // Build query: prioritize customerId, fallback to phone matching
    if (enquiry.customerId) {
      const customerIdValue = enquiry.customerId?._id || enquiry.customerId;
      if (customerIdValue) {
        relatedEnquiriesQuery.customerId = customerIdValue;
      }
    } else if (enquiry.phone) {
      // Fallback: find by normalized phone for legacy enquiries without customerId
      const normalizedPhone = normalizePhone(enquiry.phone);
      // Only add phone query if normalization returned a valid value
      if (normalizedPhone && normalizedPhone.length > 0) {
        relatedEnquiriesQuery.phone = normalizedPhone;
      }
    }

    // Only query if we have a valid condition
    let relatedEnquiries = [];
    if (relatedEnquiriesQuery.customerId || relatedEnquiriesQuery.phone) {
      relatedEnquiries = await Enquiry.find(relatedEnquiriesQuery)
        .select('enquiryId source type status createdAt phone name')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
    }

    return NextResponse.json({
      success: true,
      enquiry: {
        ...enquiry,
        items: enquiryItems,
        messages: messages,
        customerEnquiriesCount,
        relatedEnquiries, // NEW: All related enquiries from same customer
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

/**
 * PUT /api/enquiries/[id]
 * Update enquiry (status, priority, assignedTo, notes, etc.)
 */
export async function PUT(request, { params }) {
  try {
    await connectToDatabase();

    const { id } = params;
    const body = await request.json();

    const {
      status,
      priority,
      assignedTo,
      notes,
      phone,
      userType,
    } = body;

    // Build update object
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (notes !== undefined) updateData.notes = notes;
    if (phone !== undefined) updateData.phone = phone;
    if (userType !== undefined) updateData.userType = userType;

    // Update enquiry
    const enquiry = await Enquiry.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('customerId')
      .lean();

    if (!enquiry) {
      return NextResponse.json(
        { error: 'Enquiry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      enquiry,
    });
  } catch (error) {
    console.error('Error updating enquiry:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return NextResponse.json(
        { error: 'Validation error', details: errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update enquiry', details: error.message },
      { status: 500 }
    );
  }
}

