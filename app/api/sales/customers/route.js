import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/connect';

import { requireAuth } from '@/lib/server/auth/requireAuth';

import { searchCustomers } from '@/lib/server/sales/customerService';

import { customerSearchSchema, formatZodError } from '@/lib/server/sales/schemas';



export const dynamic = 'force-dynamic';



export async function GET(request) {

  const auth = await requireAuth(request, { permission: 'sales:buckets:write' });

  if (auth.error) return auth.error;



  try {

    await connectToDatabase();

    const { searchParams } = new URL(request.url);

    const parsed = customerSearchSchema.safeParse({

      q: searchParams.get('q') || '',

      limit: searchParams.get('limit') || 10,

    });



    if (!parsed.success) {

      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

    }



    const data = await searchCustomers(parsed.data);

    return NextResponse.json({ success: true, ...data });

  } catch (error) {

    console.error('Customer search:', error);

    return NextResponse.json({ error: 'Failed to search customers' }, { status: 500 });

  }

}

