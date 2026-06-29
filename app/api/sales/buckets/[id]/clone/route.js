import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db/connect';

import { requireAuth } from '@/lib/server/auth/requireAuth';

import { cloneBucketToDraft } from '@/lib/server/sales/bucketService';



export const dynamic = 'force-dynamic';



/** Clone a submitted/completed bucket into a new editable draft (audit-safe). */

export async function POST(request, { params }) {

  const auth = await requireAuth(request, { permission: 'sales:buckets:write' });

  if (auth.error) return auth.error;



  try {

    await connectToDatabase();

    const result = await cloneBucketToDraft(auth.session, params.id, request);



    if (result.error === 'not_found') {

      return NextResponse.json({ error: 'Bucket not found' }, { status: 404 });

    }

    if (result.error === 'forbidden') {

      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    }

    if (result.error === 'not_cloneable') {

      return NextResponse.json(

        { error: 'Only submitted buckets can be cloned into a new request' },

        { status: 400 }

      );

    }



    return NextResponse.json({ success: true, bucket: result.bucket }, { status: 201 });

  } catch (error) {

    console.error('Clone bucket:', error);

    return NextResponse.json({ error: 'Failed to clone bucket' }, { status: 500 });

  }

}

