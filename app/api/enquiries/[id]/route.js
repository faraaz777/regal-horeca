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

/**
 * GET /api/enquiries/[id]
 * Get single enquiry with all related data
 */
export async function GET(request, { params }) {
  try {
    await connectToDatabase();

    const { id } = params;

    // Get enquiry with customer details
    const enquiry = await Enquiry.findById(id)
      .populate('customerId')
      .lean();

    if (!enquiry) {
      return NextResponse.json(
        { error: 'Enquiry not found' },
        { status: 404 }
      );
    }

    // Get enquiry items (cart products)
    const enquiryItems = await EnquiryItem.find({ enquiryId: id })
      .populate('productId', 'title heroImage slug price')
      .lean();

    // Get communication log
    const messages = await EnquiryMessage.find({ enquiryId: id })
      .sort({ createdAt: -1 })
      .lean();

    // Get customer's total enquiries count
    let customerEnquiriesCount = 0;
    if (enquiry.customerId) {
      customerEnquiriesCount = await Enquiry.countDocuments({
        customerId: enquiry.customerId._id || enquiry.customerId
      });
    }

    return NextResponse.json({
      success: true,
      enquiry: {
        ...enquiry,
        items: enquiryItems,
        messages: messages,
        customerEnquiriesCount,
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
    } = body;

    // Build update object
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (notes !== undefined) updateData.notes = notes;

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

