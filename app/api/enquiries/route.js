/**
 * Enquiries API Route
 * 
 * Handles CRUD operations for customer enquiries.
 * 
 * POST /api/enquiries - Create a new enquiry
 * GET /api/enquiries - Get all enquiries (admin only)
 */

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connect';
import Enquiry from '@/lib/models/Enquiry';

/**
 * POST /api/enquiries
 * Creates a new enquiry
 */
export async function POST(request) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { name, email, phone, company, categories, category, message, cartItems } = body;

    // Validate required fields
    if (!name || !email || !phone) {
      return NextResponse.json(
        { error: 'Name, email, and phone are required fields' },
        { status: 400 }
      );
    }

    // Handle backward compatibility: if category (singular) is provided, convert to categories array
    const categoriesArray = categories || (category ? [category] : []);

    // Create new enquiry
    const enquiry = new Enquiry({
      name,
      email,
      phone,
      company: company || '',
      categories: categoriesArray,
      message: message || '',
      cartItems: cartItems || [],
      status: 'new',
    });

    await enquiry.save();

    return NextResponse.json({
      success: true,
      enquiry: {
        _id: enquiry._id,
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone,
        company: enquiry.company,
        categories: enquiry.categories,
        message: enquiry.message,
        cartItems: enquiry.cartItems,
        status: enquiry.status,
        createdAt: enquiry.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating enquiry:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return NextResponse.json(
        { error: 'Validation error', details: errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create enquiry', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/enquiries
 * Get all enquiries (for admin dashboard)
 * Query parameters:
 * - status: Filter by status
 * - limit: Limit results (default: 50)
 * - skip: Skip results for pagination
 */
export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }

    // Get enquiries
    const enquiries = await Enquiry.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    // Get total count for pagination
    const total = await Enquiry.countDocuments(query);

    return NextResponse.json({
      success: true,
      enquiries,
      total,
      limit,
      skip,
    });
  } catch (error) {
    console.error('Error fetching enquiries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enquiries', details: error.message },
      { status: 500 }
    );
  }
}

