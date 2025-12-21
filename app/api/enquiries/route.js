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
import Customer from '@/lib/models/Customer';
import EnquiryItem from '@/lib/models/EnquiryItem';
import { normalizePhone } from '@/lib/utils/phone';

/**
 * POST /api/enquiries
 * Creates a new enquiry with customer linking and cart items
 */
export async function POST(request) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { 
      name, 
      email, 
      phone, 
      company, 
      state, 
      categories, 
      category, 
      message, 
      cartItems,
      source = 'website-form',
      userType = 'unknown',
      products = [],
    } = body;

    // Validate required fields - phone is minimum required
    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Normalize phone number for consistent matching
    const normalizedPhone = normalizePhone(phone);

    // For light capture flow, name and email are optional
    // If not provided, use defaults
    const enquiryName = name || 'Guest User';
    const enquiryEmail = email || `${normalizedPhone}@temp.regal-horeca.com`;

    // Handle backward compatibility: if category (singular) is provided, convert to categories array
    const categoriesArray = categories || (category ? [category] : []);

    // Prepare cart items - use products array if cartItems not provided
    const finalCartItems = cartItems && cartItems.length > 0 
      ? cartItems 
      : products.map(p => ({
          productId: p.productId || p._id || p.id,
          productName: p.productName || p.title || p.name || 'Product',
          quantity: p.quantity || 1,
        }));

    // Find or create customer - ALWAYS link by phone if phone exists
    // This ensures all enquiries from the same phone number are linked
    let customer = null;
    if (normalizedPhone) {
      customer = await Customer.findOrCreate({
        name: enquiryName,
        email: enquiryEmail,
        phone: normalizedPhone,
        companyName: company || '',
      });
    }

    // Determine enquiry type
    const hasCartItems = finalCartItems && finalCartItems.length > 0;
    const enquiryType = hasCartItems ? 'cart + enquiry' : 'enquiry only';

    // Set priority: High for business enquiries from "whom we serve" pages
    const priority = (source === 'whom-we-serve' && userType === 'business') 
      ? 'high' 
      : 'normal';

    // Create new enquiry with normalized phone
    const enquiry = new Enquiry({
      customerId: customer?._id || null,
      name: enquiryName, // Keep for backward compatibility
      email: enquiryEmail,
      phone: normalizedPhone, // Store normalized phone for consistency
      company: company || '',
      state: state || '',
      source: source,
      userType: userType,
      type: enquiryType,
      categories: categoriesArray,
      message: message || '',
      cartItems: finalCartItems || [], // Keep for backward compatibility
      status: 'new',
      priority: priority,
    });

    await enquiry.save();

    // Create EnquiryItem records for cart products
    if (hasCartItems) {
      const enquiryItems = finalCartItems.map(item => ({
        enquiryId: enquiry._id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        notes: item.notes || '',
      }));

      await EnquiryItem.insertMany(enquiryItems);
    }

    return NextResponse.json({
      success: true,
      enquiry: {
        _id: enquiry._id,
        enquiryId: enquiry.enquiryId,
        customerId: enquiry.customerId,
        name: enquiry.name,
        email: enquiry.email,
        phone: enquiry.phone,
        company: enquiry.company,
        categories: enquiry.categories,
        message: enquiry.message,
        cartItems: enquiry.cartItems,
        status: enquiry.status,
        type: enquiry.type,
        source: enquiry.source,
        userType: enquiry.userType,
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
 * - priority: Filter by priority
 * - assignedTo: Filter by assigned admin
 * - category: Filter by category
 * - search: Search in name, email, phone, message
 * - limit: Limit results (default: 50)
 * - skip: Skip results for pagination
 */
export async function GET(request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const assignedTo = searchParams.get('assignedTo');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }
    if (priority) {
      query.priority = priority;
    }
    if (assignedTo) {
      query.assignedTo = assignedTo;
    }
    if (category) {
      query.categories = { $in: [category] };
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { enquiryId: { $regex: search, $options: 'i' } },
      ];
    }

    // Get enquiries with customer population
    const enquiries = await Enquiry.find(query)
      .populate('customerId', 'name companyName email phone tags')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    // Get total count for pagination
    const total = await Enquiry.countDocuments(query);

    // Get counts by status for badges
    const statusCounts = await Enquiry.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCountsMap = {};
    statusCounts.forEach(item => {
      statusCountsMap[item._id] = item.count;
    });

    return NextResponse.json({
      success: true,
      enquiries,
      total,
      limit,
      skip,
      statusCounts: statusCountsMap,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Error fetching enquiries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch enquiries', details: error.message },
      { status: 500 }
    );
  }
}

